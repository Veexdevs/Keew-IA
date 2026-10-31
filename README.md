<div align="center">

<img src="public/mark.svg" alt="Keew IA" width="96" />

# Keew IA

**Inteligência artificial própria — web, APK, IPA e EXE.**

Um modelo. Uma API. Nenhum menu de fornecedores.

</div>

---

## O que é

A Keew IA é uma inteligência artificial construída do zero pela Veexdevs, em duas camadas
que formam um único sistema:

| Camada | Onde roda | O que resolve | Precisa de rede |
| --- | --- | --- | --- |
| **Keew Core** | dentro do app e do motor | aritmética de precisão, porcentagem, unidades, datas, resumo extrativo, JSON/base64/slug, busca na base de conhecimento, planos | **não** |
| **Keew Reason** | servidor 24/7 | conversa aberta, código, redação, análise, raciocínio longo passo a passo | sim |

O mundo enxerga **um** modelo: `keew-1`. Não há seletor de modelo, nem catálogo de terceiros,
nem nome de fornecedor em lugar nenhum da interface ou das respostas — nem quando algo falha.
A Keew decide sozinha qual camada usar em cada pergunta.

```
pergunta
   │
   ├─▶ Keew Core   matemática · datas · unidades · texto · conhecimento · plano
   │      responde na hora quando tem certeza
   │
   ├─▶ Keew Reason raciocínio profundo com streaming
   │
   └─▶ se o motor oscilar, o Core assume — a Keew nunca fica muda
```

## A API da Keew

A Keew tem API própria, no formato que o mercado já conhece, para que qualquer cliente
funcione apontando a base URL para ela.

```bash
# catálogo — existe um modelo
curl $URL/api/v1/models

# conversa
curl -X POST $URL/api/v1/chat \
  -H "content-type: application/json" \
  -H "x-keew-key: $KEEW_ACCESS_KEY" \
  -d '{
    "model": "keew-1",
    "messages": [{"role":"user","content":"calcule 15% de 240"}]
  }'
```

```json
{
  "model": "keew-1",
  "engine": "keew-core",
  "choices": [{ "message": { "role": "assistant", "content": "**15% de 240 = 36**" } }]
}
```

| Rota | O que faz |
| --- | --- |
| `POST /api/v1/chat` | conversa em JSON, ou SSE com `"stream": true` |
| `GET /api/v1/models` | catálogo (só `keew-1`) |
| `GET /api/v1` | descrição da API |
| `GET /api/health` | status do serviço 24/7 |

Pedir outro modelo devolve erro — a API é nossa e serve só a Keew.

## 24/7 sem você

O servidor não depende do seu computador nem do navegador aberto:

- **GitHub Actions** acorda o serviço a cada 10 minutos e executa automações vencidas.
- **Vercel Cron** roda uma rede de segurança diária.
- **Supabase (Postgres)** guarda conversas, conhecimento, automações e telemetria.
- Se o motor de raciocínio falhar, o Keew Core responde — o serviço não sai do ar.

```bash
curl $URL/api/health
```

## O que tem dentro

**Conversa** — streaming de tokens com trilha de raciocínio recolhível, markdown completo
(GFM, tabelas, KaTeX, ~190 linguagens de highlight), anexos de texto, CSV, JSON, PDF e imagens.

**14 temas** — Onyx · Midnight · Obsidian · Aurora · Ember · Matrix · Cyber · Sakura ·
Graphite · Depth, e os claros Arctic · Papyrus · Linen · Solar. Cor de destaque livre,
raio, densidade, 5 tipografias e 5 fundos. Tudo aplicado antes do primeiro paint, sem flash.

**6 agentes** — Core, Engenheiro, Analista, Redator, Pesquisador, Tutor, cada um com prompt,
temperatura e ferramentas próprios. Clone, edite ou crie os seus.

**Conhecimento** — RAG com BM25 e stemming de português, sem infraestrutura extra.

**Automação** — agentes que rodam em horário definido, com histórico de execução.

**Plataformas** — Web/PWA offline, **APK** (Capacitor), **IPA** (Capacitor + Xcode),
**EXE** (Electron, NSIS + portable), DMG e AppImage.

## Rodar

```bash
git clone https://github.com/Veexdevs/Keew-IA.git
cd Keew-IA
npm install
npm run setup        # cria o .env.local e confere o motor
npm run dev          # http://localhost:3000
```

Sem chave do motor a Keew já funciona com o Keew Core. Com a chave, o Keew Reason entra e a
conversa fica completa.

```bash
npm test             # 19 testes do núcleo
npm run build
npm run mobile:android    # APK
npm run desktop:win       # EXE
```

## Variáveis de ambiente

Só três importam para a inteligência:

```env
KEEW_MODEL_BASE_URL=https://api.deepseek.com/v1   # onde o motor roda
KEEW_MODEL_NAME=deepseek-reasoner                 # pesos do motor
KEEW_MODEL_API_KEY=                               # chave do motor (nunca vai ao navegador)
```

Opcionais: `KEEW_ACCESS_KEY` (protege `/api/v1`), `KEEW_CRON_SECRET` (agendador),
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
(memória na nuvem).

## Deploy

```bash
vercel --prod
```

Depois, em *Settings → Environment Variables*, cole as três do motor. O cron vai junto com o
`vercel.json`. Para a memória na nuvem, rode `supabase/schema.sql` e preencha as três chaves.

## Estrutura

```
app/api/v1/             a API da Keew (chat, models, índice)
app/api/chat/           endpoint interno do workspace
app/api/health/         liveness 24/7
lib/keew-api.ts         identidade da API: keew-1, autorização, erros
lib/local-engine.ts     Keew Core — parser próprio, sem eval
lib/provider.ts         motor de raciocínio (interno; nunca exposto)
lib/themes.ts           14 temas
components/             interface
apps/mobile · apps/desktop   shells nativos
docs/OWN-MODEL.md       como servir o motor na sua infraestrutura
```

Stack: Next.js 15 · React 19 · TypeScript estrito · Tailwind 4 · Zustand · Supabase ·
Capacitor · Electron.

## Sobre os pesos

O raciocínio profundo da Keew é construído sobre a família **DeepSeek-R1** (licença MIT),
usada como base de pesos — a mesma liberdade que qualquer projeto tem ao partir de um modelo
aberto. A engenharia da Keew está na camada de produto, no roteamento entre as duas camadas,
nas 14 personalizações, nos agentes, na memória e na operação 24/7. Os detalhes de como servir
esses pesos na sua própria infraestrutura estão em [`docs/OWN-MODEL.md`](docs/OWN-MODEL.md).

<div align="center">
<sub>Feito por <b>Veexdevs</b> · Keew IA © 2026</sub>
</div>
