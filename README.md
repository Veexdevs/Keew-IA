<div align="center">

<img src="brand/mark.svg" alt="Keew IA" width="112" />

# Keew IA

**Inteligência artificial própria — web, APK, IPA e EXE.**

Raciocínio local determinístico · modelos de ponta via gateway (DeepSeek-R1) ·
agentes · base de conhecimento · automação 24/7 · 14 temas de personalização.

</div>

---

## O que é

A Keew IA é um workspace de inteligência artificial completo, não um invólucro de API.
Ela tem **duas camadas de inteligência** que trabalham juntas:

| Camada | Onde roda | Resolve | Precisa de internet |
| --- | --- | --- | --- |
| **Núcleo de Raciocínio Local (KRL)** | dentro do app | aritmética de precisão, porcentagem, unidades, datas/prazos, resumo extrativo, JSON/base64/slug, busca na base de conhecimento, planos de execução, conversa social | **não** |
| **Gateway de inferência** | servidor `/api/chat` | linguagem aberta, código, redação, análise, chain-of-thought do DeepSeek-R1 | sim |

O roteamento é automático: o KRL responde primeiro o que ele resolve com confiança ≥ 0.8
(economiza tokens e nunca erra aritmética); o modelo entra no que exige linguagem. Se o
provedor cair no meio do stream, **o KRL assume** — a Keew não fica muda por causa de
quota, rate-limit ou rede.

```
pergunta
   │
   ├─▶ KRL: social · math · units · datetime · text · list · plan   ──▶ resposta imediata
   │            └─ sem cobertura
   ├─▶ recuperação híbrida (BM25 + corpus nativo)  ──▶ contexto do prompt
   └─▶ LLM (DeepSeek-R1 · OpenRouter · Groq · Together · Gemini · Anthropic · Ollama · vLLM)
              └─ falhou?  ──▶  KRL assume (degradação graciosa)
```

## Começar em 60 segundos

```bash
git clone https://github.com/Veexdevs/Keew-IA.git
cd Keew-IA
npm install
npm run setup        # assistente: escolhe o provedor e cria o .env.local
npm run dev          # http://localhost:3000
```

**Sem chave de API?** A Keew já funciona: cálculos, datas, conversões, resumos e a base
de conhecimento nativa respondem pelo núcleo local. Para conversa aberta, configure
qualquer provedor em **Configurações → Modelo**, ou rode um modelo em casa:

```bash
ollama run deepseek-r1:8b     # depois aponte o provedor para http://127.0.0.1:11434/v1
```

## Recursos

### Workspace
- Sidebar com agrupamento inteligente (**Hoje · Ontem · 7 dias · 30 dias**), busca full-text,
  renomear, fixar, duplicar, exportar `.md` e excluir.
- Streaming real de tokens com trilha de **raciocínio** recolhível.
- Anexos: texto, código, CSV, JSON, **PDF** (extração de texto) e **imagens** (visão).
- Composer com troca de agente, modo de inferência (Auto · Local · Modelo) e atalhos.
- Command palette (`⌘K`), painel de contexto, atalhos globais.
- Markdown completo: GFM, tabelas, tarefas, **KaTeX**, syntax highlight em ~190 linguagens.

### Personalização — 14 temas
`Onyx · Midnight · Obsidian · Aurora · Ember · Matrix · Cyber · Sakura · Graphite · Depth`
e claros `Arctic · Papyrus · Linen · Solar`, mais:

- **Cor de destaque** livre (12 presets + color picker) recalculando todos os tokens derivados
- **Raio** (reto · suave · redondo) e **densidade** (compacta · média · espaçosa)
- **5 tipografias**, 5 fundos de chat (aurora/grid/pontos/grão), avatares, quebra de código,
  som ao concluir, Enter vs ⌘+Enter
- Tema aplicado **antes do primeiro paint** (sem flash) e persistido

### Agentes
6 nativos — **Core, Engenheiro, Analista, Redator, Pesquisador, Tutor** — com prompt,
temperatura, cor, ícone e ferramentas próprios. Clone, edite, crie os seus, defina o
padrão do workspace.

### Conhecimento (RAG sem infraestrutura)
Upload de arquivos ou colagem de documentos, com busca híbrida (BM25 + stemming
português) e recorte do trecho mais relevante injetado no prompt. 4 documentos nativos
sobre a própria Keew (identidade, arquitetura, padrões, privacidade).

### Automação 24/7
- `vercel.json` agenda `/api/automations/run` **a cada 10 minutos** e `/api/health` de hora em hora.
- `.github/workflows/keep-alive.yml` é o agendador redundante (funciona mesmo se a cota de cron da Vercel acabar).
- Cada automação tem cron próprio, agente, instrução e histórico (`keew_runs` no Supabase).
- Healthcheck público em `/api/health` com uptime, provedor, model e região.

### Plataformas
| Alvo | Como | Onde |
| --- | --- | --- |
| Web / PWA | deploy Vercel + service worker offline | — |
| **APK** Android | Capacitor 6 | [`docs/ANDROID.md`](docs/ANDROID.md) |
| **IPA** iOS | Capacitor 6 + Xcode | [`docs/IOS.md`](docs/IOS.md) |
| **EXE** Windows | Electron 32 (NSIS + portable) | [`docs/DESKTOP.md`](docs/DESKTOP.md) |
| DMG / AppImage / deb | Electron 32 | idem |

```bash
npm run mobile:sync && npm run mobile:android    # APK
npm run desktop:win                              # EXE
```

Os ícones e splash screens de todas as plataformas são gerados da arte oficial com
`npm run brand` (vetorização + 20 tamanhos + `.ico` + card Open Graph).

## Arquitetura

```
app/
  layout.tsx              metadata, fontes self-hosted, prepaint de tema
  page.tsx                workspace (client)
  api/chat/route.ts       gateway SSE + roteamento KRL + resiliência
  api/health/route.ts     liveness/readiness 24/7
  api/knowledge/route.ts  CRUD + busca (Supabase ou memória)
  api/automations/run/    cron: jobs agendados + keep-warm
lib/
  local-engine.ts         núcleo de raciocínio (parser próprio, sem eval)
  provider.ts             adaptadores OpenAI-compatible / Gemini / Anthropic
  knowledge.ts            índice BM25 + corpus nativo
  agents.ts               prompts e políticas dos agentes
  store.ts                estado do workspace (zustand + persist)
  themes.ts               catálogo de temas
components/               UI (chat, settings, layout, primitivos)
tools/build_brand.py      pipeline de marca (potrace + Pillow)
apps/mobile · apps/desktop  shells nativos
supabase/schema.sql       tabelas, RLS, função de busca
docs/                     guias de plataforma e de modelo próprio
```

Stack: **Next.js 15** (App Router) · **React 19** · **TypeScript estrito** ·
**Tailwind 4** · **Zustand** · **Supabase** (opcional) · **Capacitor** · **Electron**.

## Variáveis de ambiente

```env
# provedor principal
KEEW_MODEL_PROVIDER=deepseek          # deepseek|openrouter|groq|together|openai|gemini|anthropic|ollama|local
KEEW_MODEL_BASE_URL=https://api.deepseek.com/v1
KEEW_MODEL_NAME=deepseek-reasoner
KEEW_MODEL_API_KEY=sk-...

# acesso ao workspace (vazio = aberto)
KEEW_ACCESS_KEY=

# memória na nuvem (opcional)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# jobs automáticos
KEEW_CRON_SECRET=
```

Nomes dos modelos válidos: `deepseek-reasoner` / `deepseek-chat`,
`deepseek-ai/DeepSeek-R1-Distill-Qwen-32B` (Together), `deepseek-r1:8b` (Ollama),
`deepseek-r1-distill-llama-70b` (Groq).

## Deploy

```bash
npm i -g vercel
vercel --prod
```

Depois, no painel da Vercel → *Settings → Environment Variables*, cole as variáveis acima.
O cron já vai junto com o `vercel.json`. Para o Supabase:

1. crie o projeto em [supabase.com](https://supabase.com);
2. rode `supabase/schema.sql` no SQL Editor;
3. copie as três chaves para a Vercel e redeploy.

## Qualidade

```bash
npm test        # 19 testes do núcleo local (aritmética, unidades, datas, texto, RAG, intenções)
npm run build   # build de produção
npx tsc --noEmit
```

Os testes cobrem os pontos onde um assistente costuma falhar de forma embaraçosa:
precedência de operadores, porcentagem em pt-BR, divisão por zero, datas com fuso,
e o caso de uma pergunta sem cobertura que **não** pode inventar resposta.

## Documentação

- [`docs/OWN-MODEL.md`](docs/OWN-MODEL.md) — rodar DeepSeek-R1 de verdade (Ollama, vLLM, TGI, API), tabela de VRAM e fine-tuning
- [`docs/ANDROID.md`](docs/ANDROID.md) · [`docs/IOS.md`](docs/IOS.md) · [`docs/DESKTOP.md`](docs/DESKTOP.md)
- [`docs/upstream/DeepSeek-R1-README.md`](docs/upstream/DeepSeek-R1-README.md) — referência oficial do modelo base

## Créditos e licença

O modelo base de raciocínio é o **[DeepSeek-R1](https://github.com/deepseek-ai/DeepSeek-R1)**
(MIT — ver [`docs/LICENSE-DeepSeek-R1.txt`](docs/LICENSE-DeepSeek-R1.txt)).
Código, marca, agentes, temas e núcleo local da Keew IA são originais — MIT.

<div align="center">
<sub>Feito por <b>Veexdevs</b> · Keew IA © 2026</sub>
</div>
