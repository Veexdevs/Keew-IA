# Keew LM — modelo de linguagem próprio

Modelo de linguagem treinado **do zero** pela Keew IA. Cada parâmetro começa
em ruído gaussiano e é ajustado sobre texto real em português. Nenhum peso de
terceiro foi baixado, nenhum modelo pronto foi ajustado.

```
models/
├── fetch_corpus.py     baixa o corpus (Fake.br-Corpus, 7.137 textos reais)
├── train_tokenizer.py  treina o BPE próprio de 8.192 tokens
├── model.py            a arquitetura (transformer decoder-only, do zero)
├── train.py            o laço de treino
├── serve.py            servidor compatível com chat completions
├── checkpoints/        keew_lm.pt
└── tokenizer/          keew-bpe.json
```

## O que foi feito

| etapa | resultado |
|---|---|
| corpus | 7.137 notícias em português, 28,06 MB, 6,80M tokens |
| tokenizador | BPE próprio, 8.192 tokens, 3,21 chars/token |
| arquitetura | 6 camadas · 6 cabeças · d_model 384 · contexto 192 · RMSNorm · atenção causal · pesos amarrados |
| parâmetros | **13.841.280** (13,84M), contados do modelo, não estimados |
| treino | AdamW, aquecimento cosseno, 2 núcleos de CPU |

## O que este modelo é e o que ele não é

Ele é **real**: foi treinado, tem pesos, gera texto e tem uma curva de perda
medida. O que ele **não** é: um assistente. Um modelo deste tamanho, com
13,8M de parâmetros e 6,8M tokens de treino, aprende a forma do português —
ortografia, pontuação, artigos, o vocabulário do noticiário político — mas não
aprende a raciocinar, seguir instruções ou responder perguntas.

Para comparação: modelos que conversam de verdade têm entre 7 e 400 bilhões de
parâmetros e foram treinados em trilhões de tokens. A diferença é de quatro
ordens de grandeza em compute. **Não existe ajuste de código que feche essa
distância.**

Por isso o Keew LM entra no produto como **mais um motor**, servido atrás da
API da Keew — nunca como substituto de um modelo grande. Quando ele é o motor
conectado, a interface continua dizendo a verdade sobre o que está no ar.

## Rodar

```bash
pip install torch tokenizers fastapi uvicorn numpy
python3 models/fetch_corpus.py        # baixa o corpus (28 MB)
python3 models/train_tokenizer.py     # treina o BPE
python3 models/train.py --minutes 60  # treina o modelo
python3 models/serve.py               # sobe em :8080
```

O servidor responde:

```
GET  /health                 estado, parâmetros, perplexidade
GET  /v1/models              lista no formato esperado
POST /v1/chat/completions    { messages, stream, temperature, max_tokens }
```

## Ligar no site

O site fala com qualquer motor pelo protocolo de chat completions. Basta
apontar a variável de ambiente para o servidor do modelo:

```bash
KEEW_MODEL_BASE_URL=https://seu-modelo.exemplo.com/v1
KEEW_MODEL_NAME=keew-lm
```

`model: "keew-lm"` é reconhecido como motor próprio da casa e **não exige
chave de terceiro** — ver `isConfigured()` em `lib/provider.ts`.

## Hospedagem

O Google AI Studio **não hospeda modelos próprios**. Ele é o playground do
Gemini: aceita prompts e ajuste fino de modelos do Google, e a documentação
dele é explícita — "não é criar um modelo do zero como o Google fez com o
Gemini. Isso exigiria um datacenter". Não há upload de pesos, não há execução
de modelo de terceiro.

Onde este modelo pode rodar:

| opção | viável? | observação |
|---|---|---|
| Vercel (onde o site está) | **não** | funções serverless, sem processo longo nem GPU |
| Hugging Face Spaces | sim | plano gratuito tem CPU; o checkpoint tem ~55 MB |
| Fly.io / Railway / Render | sim | container com 1 GB de RAM basta |
| VPS comum | sim | 2 vCPU já geram alguns tokens por segundo |
| GPU alugada | sim, melhor | uma T4 gera rápido; é o caminho para uso real |

O `Dockerfile` em `models/` empacota tudo. Ele sobe o servidor na porta 8080
e serve tanto o site quanto qualquer cliente que fale o protocolo aberto.
