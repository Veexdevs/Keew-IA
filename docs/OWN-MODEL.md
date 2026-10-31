# Keew IA — modelo próprio e inferência

> Como a Keew IA é "uma IA de verdade" sem depender de uma única API: o **núcleo de
> raciocínio local (KRL)** responde sozinho, e o **gateway** conecta modelos de ponta
> (DeepSeek-R1 e derivados) quando há rede. Você escolhe — e a Keew continua de pé se
> o provedor cair.

---

## 1. As duas camadas de inteligência

| Camada | Onde roda | Resolve | Depende de internet |
| --- | --- | --- | --- |
| **Núcleo local (KRL)** | dentro do app (TypeScript) | matemática de precisão, conversão de unidades, datas/prazos, resumo extrativo, transformação de texto (base64, JSON, slug), busca na base de conhecimento, planos de execução | **não** |
| **Gateway de inferência** | servidor (`/api/chat`) | linguagem natural aberta, código, redação, raciocínio longo (chain-of-thought do DeepSeek-R1) | sim |

O roteamento é automático: se o KRL responde com confiança ≥ 0.8, a resposta sai na hora
e o modelo é poupado. Se o provedor falha no meio do stream, o KRL **assume** — por isso
a Keew não fica "muda" quando um limite de quota é atingido.

```
pergunta
   │
   ├─▶ KRL: math? units? datetime? text? knowledge?  ─── resposta determinística
   │                                        └─ confiança baixa
   ├─▶ recuperação (BM25 + corpus nativo)
   └─▶ LLM (DeepSeek-R1 / OpenRouter / Groq / Ollama / vLLM …)
             └─ falhou?  ──▶  KRL assume (degradação graciosa)
```

---

## 2. Rodar DeepSeek-R1 de verdade

O repositório oficial (`deepseek-ai/DeepSeek-R1`, MIT) distribui os pesos no Hugging Face.

### Tamanho x hardware

| Modelo | Params | VRAM aprox. (bf16) | Onde roda |
| --- | --- | --- | --- |
| DeepSeek-R1-Distill-Qwen-1.5B | 1.5B | ~3 GB | notebook, até celular high-end |
| DeepSeek-R1-Distill-Qwen-7B | 7B | ~15 GB | GPU 16 GB (RTX 4060 Ti/4070) |
| DeepSeek-R1-Distill-Llama-8B | 8B | ~17 GB | GPU 16–24 GB |
| DeepSeek-R1-Distill-Qwen-14B | 14B | ~28 GB | 2× GPU 16 GB / 1× 24 GB quantizado |
| DeepSeek-R1-Distill-Qwen-32B | 32B | ~64 GB | A100 40 GB quantizado / 2×3090 |
| DeepSeek-R1-Distill-Llama-70B | 70B | ~140 GB | 4× A100 40 GB / 2×80 GB |
| DeepSeek-R1 (full) | 671B (37B ativos) | ~1.3 TB | cluster — use via API |

> Para um app rodando 24/7 em servidor modesto, o caminho realista é **7B–8B quantizado**
> ou **1.5B na borda**, com o R1 completo via DeepSeek/OpenRouter.

### Opção A — Ollama (mais simples)

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama run deepseek-r1:8b            # baixa e abre o chat
ollama serve                         # expõe http://127.0.0.1:11434
```

No app: **Configurações → Modelo → Ollama (local)**, modelo `deepseek-r1:8b`,
base URL `http://127.0.0.1:11434/v1`. Nenhuma chave necessária.

### Opção B — vLLM (produção, OpenAI-compatible)

```bash
pip install vllm
vllm serve deepseek-ai/DeepSeek-R1-Distill-Qwen-7B \
  --host 0.0.0.0 --port 8080 \
  --max-model-len 16384 \
  --enable-reasoning --reasoning-parser deepseek_r1
```

Aponte `KEEW_MODEL_BASE_URL=http://SEU_HOST:8080/v1` e `KEEW_MODEL_NAME=keew-local`
(ou `deepseek-ai/DeepSeek-R1-Distill-Qwen-7B`).

### Opção C — Hugging Face TGI

```bash
docker run --gpus all -p 8080:80 \
  -v $PWD/data:/data \
  ghcr.io/huggingface/text-generation-inference:latest \
  --model-id deepseek-ai/DeepSeek-R1-Distill-Qwen-7B \
  --max-input-tokens 8192
```

### Opção D — DeepSeek API oficial (sem GPU)

```env
KEEW_MODEL_PROVIDER=deepseek
KEEW_MODEL_BASE_URL=https://api.deepseek.com/v1
KEEW_MODEL_NAME=deepseek-reasoner
KEEW_MODEL_API_KEY=sk-...
```

`deepseek-reasoner` devolve `reasoning_content` em streaming — a Keew mostra isso na
trilha "Raciocínio da Keew" antes da resposta final.

---

## 3. Recomendações oficiais do R1 (aplicadas no gateway)

O README do DeepSeek-R1 pede:

1. `temperature` entre **0.5 e 0.7** (0.6 é o recomendado) para evitar repetição infinita.
2. Evitar *system prompt* extenso — instruções dentro do turno do usuário funcionam melhor
   nos modelos destilados. O gateway envia um system prompt curto e objetivo.
3. Para matemática, pedir passo a passo e resultado final destacado.
4. Alguns modelos pulam o "thinking" (`<think></think>` vazio). Para forçar raciocínio,
   prefixar a saída com `<think>` — a Keew faz isso quando o agente tem a ferramenta
   *Raciocínio profundo*.

O núcleo local já cobre matemática de precisão (sem alucinação de aritmética do LLM),
então o modelo é usado para o que ele faz melhor: linguagem e raciocínio aberto.

---

## 4. Fine-tuning para a marca Keew (opcional)

Para a Keew falar com voz própria em qualquer modelo-base:

```bash
pip install unsloth
python - <<'PY'
from unsloth import FastLanguageModel
model, tok = FastLanguageModel.from_pretrained("deepseek-ai/DeepSeek-R1-Distill-Llama-8B", load_in_4bit=True)
model = FastLanguageModel.get_peft_model(model, r=16, lora_alpha=16)
# dataset: pares (instrução, resposta no tom Keew) em JSONL
model = FastLanguageModel.for_training(model)
# ... Trainer com seu dataset ...
model.save_pretrained("keew-lora")
PY
```

Depois sirva com vLLM (`--enable-lora --lora-modules keew=./keew-lora`) e use
`KEEW_MODEL_NAME=keew`. O prompt de marca já vive em `lib/agents.ts`, então o
fine-tune é refinamento — não requisito.

---

## 5. Licença

Os pesos e o código do DeepSeek-R1 são **MIT** (ver `docs/LICENSE-DeepSeek-R1.txt`).
A arquitetura, a marca, os agentes e o núcleo local da Keew são originais deste projeto.
