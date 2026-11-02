#!/usr/bin/env python3
"""
Keew IA — passo 2: treino.

Treina o Keew LM do zero sobre o corpus em português. Sem pesos iniciais de
terceiros, sem ajuste fino de um modelo pronto: cada parâmetro começa em ruído
gaussiano e é ajustado por gradiente descendente sobre texto real.

Uso:
    python3 models/train.py --minutes 60 --preset small
    python3 models/train.py --minutes 20 --preset tiny   # mais rápido

O checkpoint é salvo a cada N passos, então interromper não perde o progresso.
"""
from __future__ import annotations

import argparse
import json
import math
import time
from pathlib import Path

import numpy as np
import torch
from tokenizers import Tokenizer

from model import KeewConfig, KeewLM, count_parameters

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "pt_corpus.jsonl"
TOKENIZER = ROOT / "tokenizer" / "keew-bpe.json"
CKPT = ROOT / "checkpoints"

PRESETS = {
    # nome      camadas cabeças d_model block batch
    "tiny": (4, 4, 256, 128, 16),
    "small": (6, 6, 384, 192, 8),
}


def build_token_stream(tok: Tokenizer, block: int) -> np.ndarray:
    """Tokeniza o corpus inteiro uma vez e guarda em disco (uint16)."""
    cache = ROOT / "data" / f"tokens_{tok.get_vocab_size()}.npy"
    if cache.exists():
        arr = np.load(cache)
        print(f"tokens em cache: {len(arr)/1e6:.1f}M")
        return arr

    ids: list[int] = []
    t0 = time.time()
    with DATA.open(encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            text = json.loads(line)["text"]
            ids.extend(tok.encode(text).ids)
            if i % 1000 == 0:
                print(f"  tokenizados {i} documentos ({len(ids)/1e6:.2f}M tokens)", flush=True)
    arr = np.array(ids, dtype=np.uint16)
    np.save(cache, arr)
    print(f"tokens: {len(arr)/1e6:.2f}M em {time.time()-t0:.0f}s")
    return arr


def batches(data: np.ndarray, block: int, batch_size: int, seed: int):
    rng = np.random.default_rng(seed)
    while True:
        ix = rng.integers(0, len(data) - block - 1, size=batch_size)
        x = np.stack([data[i : i + block] for i in ix]).astype(np.int64)
        y = np.stack([data[i + 1 : i + block + 1] for i in ix]).astype(np.int64)
        yield torch.from_numpy(x), torch.from_numpy(y)


def lr_at(step: int, total: int, peak: float, warmup: int) -> float:
    """Aquecimento linear e decaimento cosseno até 10% do pico."""
    if step < warmup:
        return peak * (step + 1) / warmup
    t = (step - warmup) / max(1, total - warmup)
    return 0.1 * peak + 0.9 * peak * 0.5 * (1 + math.cos(math.pi * min(1.0, t)))


@torch.no_grad()
def evaluate(model: KeewLM, data: np.ndarray, block: int, iters: int = 20) -> float:
    model.eval()
    gen = batches(data, block, 4, seed=1234)
    losses = []
    for _ in range(iters):
        x, y = next(gen)
        _, loss = model(x, y)
        losses.append(loss.item())
    model.train()
    return float(np.mean(losses))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--minutes", type=float, default=60)
    ap.add_argument("--preset", choices=PRESETS, default="small")
    ap.add_argument("--lr", type=float, default=6e-4)
    ap.add_argument("--tag", default="")
    args = ap.parse_args()

    torch.set_num_threads(2)
    torch.manual_seed(1337)
    CKPT.mkdir(parents=True, exist_ok=True)

    n_layer, n_head, d_model, block, batch = PRESETS[args.preset]
    cfg = KeewConfig(
        n_layer=n_layer, n_head=n_head, d_model=d_model, d_ff=4 * d_model, block=block
    )

    tok = Tokenizer.from_file(str(TOKENIZER))
    data = build_token_stream(tok, block)
    split = int(len(data) * 0.98)
    train, val = data[:split], data[split:]
    print(f"treino: {len(train)/1e6:.2f}M tokens · validação: {len(val)/1e6:.2f}M tokens")

    model = KeewLM(cfg)
    params = count_parameters(model)
    print(f"modelo: {params/1e6:.2f}M parâmetros ({args.preset})")
    print(f"contexto {block} · batch {batch} · lr pico {args.lr}")

    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, betas=(0.9, 0.95), weight_decay=0.1)

    deadline = time.time() + args.minutes * 60
    # estimativa de passos a partir da velocidade medida neste hardware
    steps_per_s = 5625 / (batch * block) if args.preset == "tiny" else 2097 / (batch * block)
    total = max(50, int(args.minutes * 60 * steps_per_s))
    warmup = max(10, total // 20)
    print(f"meta: ~{total} passos em {args.minutes:.0f} min (estimativa, ajustada pela velocidade real)\n")

    gen = batches(train, block, batch, seed=7)
    step, best = 0, float("inf")
    t_start = time.time()
    running = []

    for step in range(total):
        if time.time() > deadline:
            print(f"\n[tempo esgotado em {step} passos]")
            break

        lr = lr_at(step, total, args.lr, warmup)
        for g in opt.param_groups:
            g["lr"] = lr

        x, y = next(gen)
        _, loss = model(x, y)
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        running.append(loss.item())

        if (step + 1) % 25 == 0:
            avg = float(np.mean(running[-50:]))
            elapsed = time.time() - t_start
            ppl = math.exp(min(20, avg))
            print(
                f"passo {step+1:5d}/{total} · loss {avg:.4f} · ppl {ppl:7.1f} · "
                f"lr {lr:.1e} · {elapsed/60:.1f} min",
                flush=True,
            )

        if (step + 1) % 500 == 0 or step + 1 == total:
            vloss = evaluate(model, val, block)
            print(f"   validação: loss {vloss:.4f} · ppl {math.exp(min(20, vloss)):.1f}")
            if vloss < best:
                best = vloss
            torch.save(
                {
                    "config": cfg.__dict__,
                    "model": model.state_dict(),
                    "step": step + 1,
                    "val_loss": vloss,
                    "train_loss": float(np.mean(running[-100:])),
                    "tokens_seen": (step + 1) * batch * block,
                    "preset": args.preset,
                },
                CKPT / "keew_lm.pt",
            )
            print(f"   checkpoint salvo (melhor val {best:.4f})")

    # salva sempre, mesmo se interrompido
    torch.save(
        {
            "config": cfg.__dict__,
            "model": model.state_dict(),
            "step": step + 1,
            "val_loss": evaluate(model, val, block),
            "tokens_seen": (step + 1) * batch * block,
            "preset": args.preset,
        },
        CKPT / "keew_lm.pt",
    )
    total_min = (time.time() - t_start) / 60
    print(f"\nfim: {step+1} passos em {total_min:.1f} min · {params/1e6:.2f}M parâmetros")
    print(f"tokens vistos: {(step+1)*batch*block/1e6:.2f}M")


if __name__ == "__main__":
    main()
