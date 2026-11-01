/**
 * POST /api/engine/connect
 *
 * Recebe a chave do motor de linguagem e valida contra o provedor antes de
 * aceitar. A chave é guardada no servidor (memória do processo + escrita no
 * arquivo de ambiente quando o runtime permite) e nunca volta ao navegador.
 *
 * Corpo: { key: string }
 * Resposta: { ok: boolean, detail?: string }
 */
import type { NextRequest } from "next/server";

import { authorize } from "@/lib/keew-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export async function POST(req: NextRequest) {
  const auth = authorize(req.headers);
  if (!auth.ok) return json({ ok: false, detail: auth.error }, auth.status);

  let key = "";
  try {
    const body = (await req.json()) as { key?: string };
    key = (body.key || "").trim();
  } catch {
    return json({ ok: false, detail: "Pedido inválido." }, 400);
  }

  if (key.length < 8) {
    return json({ ok: false, detail: "Chave muito curta." }, 400);
  }

  /* ── valida a chave falando com o provedor ──────────────────────────── */
  const baseUrl = (process.env.KEEW_MODEL_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.KEEW_MODEL_NAME || "deepseek-chat",
        messages: [{ role: "user", content: "ok" }],
        max_tokens: 5,
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const detail =
        res.status === 401 || res.status === 403
          ? "O provedor recusou essa chave."
          : `O provedor respondeu ${res.status}. Tente de novo.`;
      return json({ ok: false, detail });
    }
  } catch (err) {
    const aborted = (err as Error).name === "AbortError";
    return json({
      ok: false,
      detail: aborted
        ? "O provedor demorou demais para responder."
        : "Não consegui alcançar o provedor a partir deste servidor.",
    });
  }

  /* ── chave válida: guarda no servidor ───────────────────────────────── */
  process.env.KEEW_MODEL_API_KEY = key;

  // Em ambientes onde o filesystem é gravável (self-host, VPS, docker),
  // persistimos para sobreviver a reinícios. Na Vercel isso falha em silêncio
  // e a variável de ambiente continua sendo o caminho recomendado.
  try {
    const { writeFileSync, existsSync, readFileSync } = await import("node:fs");
    const file = ".env.local";
    const line = `KEEW_MODEL_API_KEY=${key}`;
    let next = line + "\n";
    if (existsSync(file)) {
      const current = readFileSync(file, "utf8");
      next = current.match(/^KEEW_MODEL_API_KEY=.*$/m)
        ? current.replace(/^KEEW_MODEL_API_KEY=.*$/m, line)
        : `${current.replace(/\s*$/, "")}\n${line}\n`;
    }
    writeFileSync(file, next, "utf8");
  } catch {
    /* runtime só-leitura: a chave vive na memória do processo */
  }

  return json({ ok: true });
}
