/**
 * Keew IA — fontes.
 *
 * Depois que a resposta é montada, colhemos as origens que realmente
 * sustentam o texto: documentos da base de conhecimento, links que o modelo
 * citou e domínios reconhecidos no corpo da resposta. Cada fonte ganha um
 * favicon para aparecer como bolinha redonda na interface e o conteúdo
 * necessário para o painel de detalhes.
 */
import type { Citation } from "./types";

export type { Citation };

const DOMAIN_RE =
  /\b(?:https?:\/\/)?(?:www\.)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|com\.br|org|net|io|dev|ai|app|gov|edu|br|co|me|xyz|info|so|sh|tv))\b/gi;

const MD_LINK_RE = /\[([^\]]{2,120})\]\((https?:\/\/[^\s)]{4,300})\)/gi;

/** Domínios que nunca são "fonte" de nada. */
const IGNORE = new Set([
  "localhost",
  "example.com",
  "keew-ia.vercel.app",
]);

function host(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Rótulo humano a partir do host: docs.anthropic.com → anthropic.com */
function labelFor(h: string): string {
  const clean = h.replace(/^(www|docs|api|blog|m|pt|en)\./, "");
  return clean.split(".").slice(-2).join(".");
}

/**
 * Favicon de um domínio.
 * Usamos o serviço do Google porque ele devolve o ícone real do site; se
 * falhar, o componente mostra a inicial do domínio num círculo colorido.
 */
export function faviconFor(urlOrHost: string, size = 64): string {
  const h = host(urlOrHost) || urlOrHost.replace(/^www\./, "");
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=${size}`;
}

/**
 * Extrai fontes de uma resposta completa.
 * `docs` são os trechos da base que foram para o prompt; `answer` é o texto
 * final. Links explícitos ganham prioridade sobre domínios soltos.
 */
export function extractCitations(answer: string, docs: { title: string; content?: string }[] = []): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];

  const push = (c: Citation) => {
    const key = c.url ? `u:${host(c.url)}` : `d:${c.title}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(c);
  };

  // 1. documentos da base que alimentaram o prompt
  for (const d of docs.slice(0, 4)) {
    if (!d.title) continue;
    push({
      title: d.title,
      url: undefined,
      snippet: (d.content || "").replace(/\s+/g, " ").slice(0, 240),
      kind: "knowledge",
    });
  }

  // 2. links em markdown, com o texto do link como título
  for (const m of answer.matchAll(MD_LINK_RE)) {
    const [, text, url] = m;
    const h = host(url);
    if (!h || IGNORE.has(h)) continue;
    push({ title: text.trim(), url, snippet: h, kind: "web" });
  }

  // 3. domínios citados soltos no texto
  for (const m of answer.matchAll(DOMAIN_RE)) {
    const h = host(m[1]);
    if (!h || IGNORE.has(h)) continue;
    push({ title: labelFor(h), url: `https://${h}`, snippet: h, kind: "web" });
  }

  return out.slice(0, 6);
}

/** Cor estável por domínio, para o círculo de fallback. */
export function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const palette = ["#0b5cff", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];
  return palette[hash % palette.length];
}
