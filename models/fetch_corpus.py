#!/usr/bin/env python3
"""
Keew IA — passo 0: corpus.

Baixa o Fake.br-Corpus (notícias reais em português brasileiro, rotuladas
verdadeiro/falso) e monta o arquivo de treino. É clone raso via git porque
o download direto de arquivos exige um host que não está liberado aqui.

Uso:
    python3 models/fetch_corpus.py
"""
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "data" / "pt_corpus.jsonl"
REPO = "https://github.com/roneysco/Fake.br-Corpus.git"


def main() -> None:
    if OUT.exists():
        print(f"corpus já existe: {OUT} ({OUT.stat().st_size/1e6:.1f} MB)")
        return

    with tempfile.TemporaryDirectory() as tmp:
        dest = Path(tmp) / "fakebr"
        print("clonando o corpus…")
        subprocess.run(["git", "clone", "--depth", "1", "-q", REPO, str(dest)], check=True)

        docs = []
        for kind in ("true", "fake"):
            for p in sorted((dest / "full_texts" / kind).glob("*.txt")):
                text = p.read_text(encoding="utf-8", errors="ignore").strip()
                if len(text) > 200:
                    docs.append({"id": f"{kind}/{p.name}", "text": text})

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as f:
        for d in docs:
            f.write(json.dumps(d, ensure_ascii=False) + "\n")

    total = sum(len(d["text"]) for d in docs)
    print(f"pronto: {len(docs)} textos · {total/1e6:.2f} MB → {OUT}")


if __name__ == "__main__":
    main()
