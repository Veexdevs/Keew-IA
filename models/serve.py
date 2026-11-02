#!/usr/bin/env python3
"""
Keew IA — passo 3: servidor do modelo.

Sobe o Keew LM treinado atrás de uma API compatível com chat completions, para
que o site fale com ele exatamente como fala com qualquer motor: a Keew
continua sendo a única superfície, e este modelo é mais um backend dela.

Rotas:
    GET  /health          estado, parâmetros, checkpoint
    GET  /v1/models       lista no formato esperado pelo app
    POST /v1/chat/completions   { messages: [...], stream?: bool }

Uso:
    python3 models/serve.py            # porta 8080
    PORT=9000 python3 models/serve.py
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

import torch
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from tokenizers import Tokenizer

from model import KeewConfig, KeewLM, count_parameters

ROOT = Path(__file__).resolve().parent
CKPT = ROOT / "checkpoints" / "keew_lm.pt"
TOKENIZER = ROOT / "tokenizer" / "keew-bpe.json"

MODEL_NAME = "keew-lm"
BOS, EOS = 1, 2

app = FastAPI(title="Keew LM", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

state: dict = {}


class ChatRequest(BaseModel):
    messages: list[dict] = []
    stream: bool = False
    temperature: float = 0.85
    top_k: int = 40
    max_tokens: int = 120


def load() -> None:
    if "model" in state:
        return
    if not CKPT.exists():
        raise SystemExit(f"checkpoint ausente: {CKPT} (rode models/train.py)")
    torch.set_num_threads(int(os.environ.get("KEEW_THREADS", "2")))
    ck = torch.load(CKPT, map_location="cpu", weights_only=False)
    cfg = KeewConfig(**ck["config"])
    model = KeewLM(cfg)
    model.load_state_dict(ck["model"])
    model.eval()
    state.update(
        model=model,
        cfg=cfg,
        tok=Tokenizer.from_file(str(TOKENIZER)),
        step=ck["step"],
        val_loss=ck["val_loss"],
        params=count_parameters(model),
        tokens_seen=ck.get("tokens_seen", 0),
        preset=ck.get("preset", "small"),
        loaded_at=time.time(),
    )


@app.on_event("startup")
def _startup() -> None:
    load()


@app.get("/health")
def health() -> dict:
    load()
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "checkpoint_mtime": int(CKPT.stat().st_mtime),
        "params": state["params"],
        "params_m": round(state["params"] / 1e6, 2),
        "step": state["step"],
        "val_loss": round(state["val_loss"], 4),
        "perplexity": round(float(torch.tensor(state["val_loss"]).exp()), 1),
        "tokens_seen": state["tokens_seen"],
        "context": state["cfg"].block,
        "vocab": state["cfg"].vocab_size,
        "preset": state["preset"],
    }


@app.get("/v1/models")
def models() -> dict:
    return {
        "object": "list",
        "data": [{"id": MODEL_NAME, "object": "model", "owned_by": "Keew IA"}],
    }


def _prompt_from(messages: list[dict]) -> str:
    """
    Formata a conversa no mesmo formato que o corpus usa: parágrafos separados
    por linha em branco. O modelo é pequeno e não foi ajustado por instrução —
    então a conversa é apresentada como texto, que é o que ele aprendeu.
    """
    parts = []
    for m in messages[-8:]:
        role = m.get("role", "user")
        content = (m.get("content") or "").strip()
        if not content:
            continue
        if role == "user":
            parts.append(content)
        elif role == "assistant":
            parts.append(content)
        elif role == "system":
            parts.insert(0, content)
    return "\n\n".join(parts)


@torch.no_grad()
def _generate(prompt: str, temperature: float, top_k: int, max_tokens: int):
    tok: Tokenizer = state["tok"]
    model: KeewLM = state["model"]
    cfg: KeewConfig = state["cfg"]

    ids = tok.encode(prompt).ids[-(cfg.block - 1) :]
    idx = torch.tensor([ids])
    produced = []

    for _ in range(max_tokens):
        window = idx[:, -cfg.block :]
        logits, _ = model(window)
        logits = logits[:, -1, :] / max(temperature, 1e-5)
        k = min(top_k, logits.size(-1))
        thresh = torch.topk(logits, k).values[:, -1:]
        logits = logits.masked_fill(logits < thresh, float("-inf"))
        nxt = torch.multinomial(torch.softmax(logits, dim=-1), num_samples=1)
        token = int(nxt[0, 0])
        if token == EOS:
            break
        idx = torch.cat((idx, nxt), dim=1)
        produced.append(token)

    # decodifica incrementalmente para não repetir o prompt
    text = tok.decode(produced) if produced else ""
    return text.strip()


@app.post("/v1/chat/completions")
async def chat(req: ChatRequest):
    load()
    prompt = _prompt_from(req.messages)
    if not prompt:
        prompt = "O"

    t0 = time.time()
    text = _generate(prompt, req.temperature, req.top_k, req.max_tokens)
    elapsed = time.time() - t0
    created = int(time.time())

    if not req.stream:
        return {
            "id": f"chatcmpl-keew-{created}",
            "object": "chat.completion",
            "created": created,
            "model": MODEL_NAME,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": text},
                    "finish_reason": "stop",
                }
            ],
            "usage": {"prompt_tokens": len(prompt) // 4, "completion_tokens": len(text) // 4},
            "keew": {"elapsed_s": round(elapsed, 2), "params_m": round(state["params"] / 1e6, 2)},
        }

    def events():
        # transmite em pedaços para a interface mostrar o texto crescendo
        step = 6
        for i in range(0, len(text), step):
            chunk = text[i : i + step]
            if not chunk:
                continue
            yield "data: " + json.dumps(
                {
                    "id": f"chatcmpl-keew-{created}",
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": MODEL_NAME,
                    "choices": [{"index": 0, "delta": {"content": chunk}, "finish_reason": None}],
                },
                ensure_ascii=False,
            ) + "\n\n"
            time.sleep(0.02)
        yield "data: " + json.dumps(
            {
                "id": f"chatcmpl-keew-{created}",
                "object": "chat.completion.chunk",
                "created": created,
                "model": MODEL_NAME,
                "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
            }
        ) + "\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    load()
    print(
        f"Keew LM pronto · {state['params']/1e6:.2f}M parâmetros · "
        f"passo {state['step']} · val loss {state['val_loss']:.4f} · porta {port}"
    )
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")
