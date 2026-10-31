/**
 * Keew IA — retrieval layer (RAG) without external infrastructure.
 *
 * Hybrid lexical search: BM25-ish scoring over the user's knowledge documents
 * plus the built-in Keew corpus. Pure TypeScript, edge-runtime safe, and
 * deterministic — a passed-in document set always yields the same context,
 * which keeps answers grounded and testable.
 */

import type { KnowledgeDoc } from "./types";

export type IndexedDoc = KnowledgeDoc & { score?: number; excerpt?: string };

const STOPWORDS = new Set(
  ("a o e é de da do das dos em no na nos nas um uma uns umas para por com como que se ao aos "
    + "à às ou mas and or the of to in on with for is are be it this that eu você voce me te "
    + "seu sua meu minha mais menos muito muito pode fazer qual quais onde quando porque porquê "
    + "hoje agora então entao sobre entre já ja ser estar ter tem foi são sao").split(/\s+/),
);

export function tokenize(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
    .map(stem);
}

/** Very light Portuguese/English stemmer — enough for recall, cheap to run. */
function stem(word: string): string {
  for (const suffix of ["amento", "imento", "ações", "acoes", "mente", "ções", "coes", "ando", "endo", "indo", "aram", "eram", "iram", "ou", "ar", "er", "ir", "es", "s"]) {
    if (word.length > suffix.length + 3 && word.endsWith(suffix)) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

type Entry = { id: string; title: string; tokens: string[]; tf: Map<string, number>; len: number; doc: KnowledgeDoc };

export type SearchIndex = {
  entries: Entry[];
  df: Map<string, number>;
  avgLen: number;
};

export function buildIndex(docs: KnowledgeDoc[]): SearchIndex {
  const entries: Entry[] = docs.map((doc) => {
    const tokens = tokenize(`${doc.title} ${doc.title} ${doc.content}`);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    return { id: doc.id, title: doc.title, tokens, tf, len: tokens.length || 1, doc };
  });
  const df = new Map<string, number>();
  for (const e of entries) for (const t of e.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  const avgLen = entries.reduce((s, e) => s + e.len, 0) / Math.max(entries.length, 1);
  return { entries, df, avgLen };
}

export function search(index: SearchIndex, query: string, k = 4, minScore = 0.6): IndexedDoc[] {
  const q = tokenize(query);
  if (!q.length || !index.entries.length) return [];
  const N = index.entries.length;
  const scored = index.entries.map((e) => {
    let score = 0;
    for (const term of q) {
      const tf = e.tf.get(term);
      if (!tf) continue;
      const df = index.df.get(term) || 0;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      const k1 = 1.4;
      const b = 0.75;
      const norm = 1 - b + (b * e.len) / (index.avgLen || 1);
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * norm));
      if (e.title.toLowerCase().includes(term)) score += 0.8;
    }
    return { ...e.doc, score };
  });
  return scored
    .filter((d) => (d.score || 0) >= minScore)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, k)
    .map((d) => ({ ...d, excerpt: excerptFor(d.content, q) }));
}

/** Pull the most query-relevant window of a document. */
export function excerptFor(content: string, queryTokens: string[], size = 900): string {
  const clean = content.replace(/\s+/g, " ").trim();
  if (clean.length <= size) return clean;
  const lower = clean.toLowerCase();
  let best = 0;
  let bestHits = -1;
  const step = 220;
  for (let i = 0; i < clean.length - size * 0.6; i += step) {
    const window = lower.slice(i, i + size);
    let hits = 0;
    for (const t of queryTokens) if (window.includes(t)) hits++;
    if (hits > bestHits) { bestHits = hits; best = i; }
  }
  const start = Math.max(0, best - 80);
  return (start > 0 ? "… " : "") + clean.slice(start, start + size) + " …";
}

/** Render retrieved documents into a compact, model-friendly context block. */
export function toContext(docs: IndexedDoc[], maxChars = 6000): string {
  if (!docs.length) return "";
  let out = "";
  for (const d of docs) {
    const block = `\n\n### ${d.title}\n${(d.excerpt || d.content).slice(0, 2200)}`;
    if (out.length + block.length > maxChars) break;
    out += block;
  }
  return out.trim();
}

/* ─────────────────────────────────────────────────── built-in Keew corpus */

export const KEEW_CORPUS: KnowledgeDoc[] = [
  {
    id: "keew-identity",
    title: "Quem é a Keew IA",
    content:
      "A Keew IA é uma inteligência artificial própria, criada pela Veexdevs. Ela roda em infraestrutura própria na web, " +
      "com gateway de inferência multi-provedor: usa modelos de raciocínio (DeepSeek R1 e derivados, além de modelos de " +
      "outros provedores quando configurados) e mantém um núcleo de raciocínio local que continua respondendo mesmo sem " +
      "conexão com o provedor. A marca é um K formado por duas vírgulas orbitais, azul #004CFD. " +
      "A Keew é objetiva, técnica e direta: responde em português do Brasil por padrão, sem floreios, com código " +
      "executável e passos verificáveis.",
    createdAt: 0,
    updatedAt: 0,
    tags: ["identidade", "marca"],
  },
  {
    id: "keew-architecture",
    title: "Arquitetura da plataforma Keew IA",
    content:
      "A plataforma tem quatro camadas. 1) Cliente: Next.js 15 (App Router) com React 19, funciona no navegador, como PWA, " +
      "APK Android (Capacitor), IPA iOS (Capacitor) e EXE Windows/macOS/Linux (Electron). 2) Gateway de inferência: " +
      "route handler /api/chat que normaliza streaming SSE de DeepSeek, OpenRouter, Groq, Together, Gemini, Anthropic, " +
      "Ollama e qualquer endpoint OpenAI-compatible. 3) Memória: Supabase (Postgres) para conversas, conhecimento e " +
      "telemetria; localStorage como fallback offline-first. 4) Automação 24/7: GitHub Actions (cron a cada 10 minutos) " +
      "e Vercel Cron chamando /api/automations/run, que executa agentes agendados, mantém o modelo aquecido e registra " +
      "saúde do serviço.",
    createdAt: 0,
    updatedAt: 0,
    tags: ["arquitetura", "engenharia"],
  },
  {
    id: "keew-code-style",
    title: "Padrão de código Keew",
    content:
      "Ao gerar código a Keew segue: TypeScript estrito, funções pequenas e nomeadas, zero dependências desnecessárias, " +
      "tratamento explícito de erro, acessibilidade (aria, foco visível), responsividade mobile-first e comentários " +
      "apenas onde o 'por quê' não é óbvio. Em Python: tipagem, pathlib, sem globals. Sempre entrega o arquivo completo " +
      "quando o usuário for colar o resultado, e explica o diff quando edita algo existente.",
    createdAt: 0,
    updatedAt: 0,
    tags: ["código"],
  },
  {
    id: "keew-privacy",
    title: "Privacidade e dados",
    content:
      "Nada é enviado a terceiros além do necessário para inferência: o texto da conversa e anexos vão ao provedor " +
      "configurado. Chaves de API ficam em variáveis de ambiente do servidor ou no armazenamento local do navegador, " +
      "nunca em logs. O usuário pode apagar todo o histórico em Configurações → Dados, exportar tudo em JSON e " +
      "desativar a telemetria de uso. A automação 24/7 guarda apenas status e resumo dos jobs, não conversas.",
    createdAt: 0,
    updatedAt: 0,
    tags: ["privacidade"],
  },
];
