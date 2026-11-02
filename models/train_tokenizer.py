#!/usr/bin/env python3
"""
Keew IA — passo 1: tokenizador.

Treina um BPE de 8192 tokens sobre o corpus em português. O tokenizador é
próprio (nada de vocabulário emprestado) para que o modelo aprenda a
frequência real do português brasileiro em vez de herdar o desequilíbrio
de um vocabulário multilíngue.

Uso:
    python3 models/train_tokenizer.py
"""
from pathlib import Path

from tokenizers import Tokenizer, decoders, models, pre_tokenizers, processors, trainers
from tokenizers.normalizers import NFKC

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "pt_corpus.jsonl"
OUT = ROOT / "tokenizer" / "keew-bpe.json"
VOCAB_SIZE = 8192
SPECIALS = ["<pad>", "<bos>", "<eos>", "<unk>"]


def read_texts():
    with DATA.open(encoding="utf-8") as f:
        for line in f:
            import json

            yield json.loads(line)["text"]


def main() -> None:
    if not DATA.exists():
        raise SystemExit(f"corpus ausente: {DATA} (rode models/fetch_corpus.py)")

    tok = Tokenizer(models.BPE(unk_token="<unk>"))
    tok.normalizer = NFKC()
    # ByteLevel: nenhuma palavra é "desconhecida"; acentos e cedilha são
    # representados em bytes, então o modelo nunca trava num "não sei".
    tok.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=True)
    tok.decoder = decoders.ByteLevel()
    tok.post_processor = processors.TemplateProcessing(
        single="<bos> $A <eos>",
        special_tokens=[("<bos>", 1), ("<eos>", 2)],
    )

    trainer = trainers.BpeTrainer(
        vocab_size=VOCAB_SIZE,
        special_tokens=SPECIALS,
        initial_alphabet=pre_tokenizers.ByteLevel.alphabet(),
        show_progress=True,
        min_frequency=2,
    )
    tok.train_from_iterator(read_texts(), trainer=trainer)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    tok.save(str(OUT))

    # relatório rápido: compressão e cobertura
    sample = "A Keew IA é uma inteligência artificial própria da Veexdevs, treinada em português do Brasil."
    enc = tok.encode(sample)
    print(f"\nvocabulário: {tok.get_vocab_size()} tokens")
    print(f"compressão : {len(sample)} chars -> {len(enc.ids)} tokens "
          f"({len(sample)/len(enc.ids):.2f} chars/token)")
    print(f"exemplo    : {enc.tokens[:18]}")
    print(f"salvo em   : {OUT}")


if __name__ == "__main__":
    main()
