"""
Keew IA — a arquitetura.

Um transformer decoder-only escrito do zero: embeddings de token e de posição,
atenção causal multi-cabeça, MLP com GELU, normalização RMS e conexões
residuais. Nenhum código de terceiros, nenhum peso emprestado.

Parâmetros: a contagem é exata e é reportada ao final do arquivo para que a
interface nunca precise inventar um número.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import torch
import torch.nn as nn
import torch.nn.functional as F


@dataclass
class KeewConfig:
    vocab_size: int = 8192
    n_layer: int = 6
    n_head: int = 6
    d_model: int = 384
    d_ff: int = 1536
    block: int = 256
    dropout: float = 0.0

    @property
    def head_dim(self) -> int:
        return self.d_model // self.n_head


class RMSNorm(nn.Module):
    """Normalização pela raiz da média dos quadrados — estável e sem viés."""

    def __init__(self, dim: int, eps: float = 1e-6):
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(dim))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        norm = x.pow(2).mean(dim=-1, keepdim=True).add(self.eps).rsqrt()
        return x * norm * self.weight


class CausalSelfAttention(nn.Module):
    def __init__(self, cfg: KeewConfig):
        super().__init__()
        self.n_head = cfg.n_head
        self.head_dim = cfg.head_dim
        self.qkv = nn.Linear(cfg.d_model, 3 * cfg.d_model, bias=False)
        self.proj = nn.Linear(cfg.d_model, cfg.d_model, bias=False)
        self.dropout = cfg.dropout

    def forward(
        self, x: torch.Tensor, cache: tuple[torch.Tensor, torch.Tensor] | None = None
    ) -> tuple[torch.Tensor, tuple[torch.Tensor, torch.Tensor]]:
        b, t, c = x.shape
        q, k, v = self.qkv(x).split(c, dim=2)
        # (b, t, c) -> (b, n_head, t, head_dim)
        q = q.view(b, t, self.n_head, self.head_dim).transpose(1, 2)
        k = k.view(b, t, self.n_head, self.head_dim).transpose(1, 2)
        v = v.view(b, t, self.n_head, self.head_dim).transpose(1, 2)

        if cache is not None:
            # geração incremental: concatena o K/V novo ao já calculado e para
            # de recomputar o passado. É o que transforma O(T) em O(1) por token.
            pk, pv = cache
            k = torch.cat((pk, k), dim=2)
            v = torch.cat((pv, v), dim=2)
            # só a última posição é consultada, então não precisa de máscara
            causal = t > 1
        else:
            causal = True

        y = F.scaled_dot_product_attention(
            q, k, v, dropout_p=self.dropout if self.training else 0.0, is_causal=causal
        )
        y = y.transpose(1, 2).contiguous().view(b, t, c)
        return self.proj(y), (k, v)


class MLP(nn.Module):
    def __init__(self, cfg: KeewConfig):
        super().__init__()
        self.fc = nn.Linear(cfg.d_model, cfg.d_ff, bias=False)
        self.proj = nn.Linear(cfg.d_ff, cfg.d_model, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.proj(F.gelu(self.fc(x)))


class Block(nn.Module):
    """Pré-normalização: norma antes de cada subcamada, residual por fora."""

    def __init__(self, cfg: KeewConfig):
        super().__init__()
        self.norm1 = RMSNorm(cfg.d_model)
        self.attn = CausalSelfAttention(cfg)
        self.norm2 = RMSNorm(cfg.d_model)
        self.mlp = MLP(cfg)

    def forward(
        self, x: torch.Tensor, cache: tuple[torch.Tensor, torch.Tensor] | None = None
    ) -> tuple[torch.Tensor, tuple[torch.Tensor, torch.Tensor]]:
        a, new_cache = self.attn(self.norm1(x), cache)
        x = x + a
        x = x + self.mlp(self.norm2(x))
        return x, new_cache


class KeewLM(nn.Module):
    """Modelo de linguagem autorregressivo da Keew IA."""

    def __init__(self, cfg: KeewConfig):
        super().__init__()
        self.cfg = cfg
        self.tok_emb = nn.Embedding(cfg.vocab_size, cfg.d_model)
        self.pos_emb = nn.Embedding(cfg.block, cfg.d_model)
        self.blocks = nn.ModuleList([Block(cfg) for _ in range(cfg.n_layer)])
        self.norm_f = RMSNorm(cfg.d_model)
        self.head = nn.Linear(cfg.d_model, cfg.vocab_size, bias=False)
        # amarração de pesos: entrada e saída compartilham a mesma tabela,
        # economiza parâmetros e melhora o sinal em vocabulários pequenos
        self.head.weight = self.tok_emb.weight

        self.apply(self._init)
        # escala residual: mantém a variância estável ao empilhar blocos
        for name, p in self.named_parameters():
            if name.endswith("proj.weight") or name.endswith("fc.weight"):
                nn.init.normal_(p, mean=0.0, std=0.02 / math.sqrt(2 * cfg.n_layer))

    def _init(self, m: nn.Module) -> None:
        if isinstance(m, nn.Linear):
            nn.init.normal_(m.weight, mean=0.0, std=0.02)
            if m.bias is not None:
                nn.init.zeros_(m.bias)
        elif isinstance(m, nn.Embedding):
            nn.init.normal_(m.weight, mean=0.0, std=0.02)

    def forward(self, idx: torch.Tensor, targets: torch.Tensor | None = None, caches=None):
        b, t = idx.shape
        if t > self.cfg.block:
            raise ValueError(f"sequência de {t} excede o contexto de {self.cfg.block}")

        if caches is None:
            pos = torch.arange(t, device=idx.device)
        else:
            # posição absoluta a partir do tamanho do cache da primeira camada
            past = caches[0][0].size(2)
            pos = torch.arange(past, past + t, device=idx.device)

        x = self.tok_emb(idx) + self.pos_emb(pos)[None, :, :]
        new_caches = []
        for i, blk in enumerate(self.blocks):
            x, nc = blk(x, caches[i] if caches is not None else None)
            new_caches.append(nc)
        x = self.norm_f(x)
        logits = self.head(x)
        self._caches_out = new_caches

        if targets is None:
            return logits, None
        loss = F.cross_entropy(
            logits[:, :-1].reshape(-1, logits.size(-1)),
            targets[:, 1:].reshape(-1),
            ignore_index=-100,
        )
        return logits, loss

    @torch.no_grad()
    def generate(
        self,
        idx: torch.Tensor,
        max_new_tokens: int,
        temperature: float = 0.8,
        top_k: int = 40,
        eos_id: int = 2,
    ) -> torch.Tensor:
        """Geração com cache de K/V: o prompt entra uma vez, não a cada token."""
        caches = None
        for step in range(max_new_tokens):
            if caches is None:
                window = idx[:, -self.cfg.block :]
            else:
                window = idx[:, -1:]  # só o token novo

            logits, _ = self(window, caches=caches)
            if caches is None:
                caches = self._caches_out
            else:
                caches = self._caches_out

            logits = logits[:, -1, :]
            if temperature <= 0:
                nxt = logits.argmax(dim=-1, keepdim=True)
            else:
                logits = logits / temperature
                if top_k:
                    k = min(top_k, logits.size(-1))
                    thresh = torch.topk(logits, k).values[:, -1:]
                    logits = logits.masked_fill(logits < thresh, float("-inf"))
                probs = F.softmax(logits, dim=-1)
                nxt = torch.multinomial(probs, num_samples=1)
            idx = torch.cat((idx, nxt), dim=1)
            if int(nxt[0, 0]) == eos_id:
                break
        return idx


def count_parameters(model: nn.Module, non_embedding: bool = False) -> int:
    n = sum(p.numel() for p in model.parameters())
    if non_embedding:
        n -= model.pos_emb.weight.numel()
    return n


def describe(cfg: KeewConfig) -> str:
    model = KeewLM(cfg)
    total = count_parameters(model)
    return (
        f"Keew LM · {cfg.n_layer} camadas · {cfg.n_head} cabeças · d_model {cfg.d_model} · "
        f"contexto {cfg.block} · vocabulário {cfg.vocab_size} · {total/1e6:.2f}M parâmetros"
    )


if __name__ == "__main__":
    cfg = KeewConfig()
    print(describe(cfg))
    m = KeewLM(cfg)
    x = torch.randint(0, cfg.vocab_size, (2, 32))
    logits, loss = m(x, x)
    print(f"forward ok: logits {tuple(logits.shape)} · loss inicial {loss.item():.3f} (esperado ≈ {math.log(cfg.vocab_size):.3f})")
