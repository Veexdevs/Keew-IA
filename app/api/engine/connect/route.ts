/**
 * POST /api/engine/connect
 *
 * Confere se uma chave de motor funciona, falando com o provedor uma vez.
 * **Não guarda nada.** A chave fica no navegador de quem colou e viaja em
 * cada pedido — o servidor é serverless e sem armazenamento durável, então
 * guardá-la aqui faria o usuário ver "conectado" e continuar sem resposta
 * no pedido seguinte. Prometer persistência que não existe seria a mesma
 * mentira que este produto está corrigindo.
 *
 * Corpo: { key: string }
 * Resposta: { ok: boolean, detail?: string }
 */
import type { NextRequest } from "next/server";

import { authorize } from "@/lib/keew-api";
import { resolveConfig } from "@/lib/provider";

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

  /* ── confere a chave falando com o provedor uma vez ─────────────────── */
  const config = resolveConfig(key);
  const baseUrl = config.baseUrl.replace(/\/$/, "");
  const anthropic = /anthropic\.com/.test(baseUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = anthropic
      ? await fetch(`${baseUrl}/messages`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: 4,
            messages: [{ role: "user", content: "ok" }],
          }),
          signal: controller.signal,
        })
      : await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: config.model,
            messages: [{ role: "user", content: "ok" }],
            max_tokens: 4,
            stream: false,
          }),
          signal: controller.signal,
        });

    if (!res.ok) {
      const detail =
        res.status === 401 || res.status === 403
          ? "O provedor recusou essa chave."
          : res.status === 404
            ? "A chave existe, mas o modelo configurado não respondeu."
            : res.status === 429
              ? "A chave funciona, mas o provedor está limitando o uso agora."
              : `O provedor respondeu ${res.status}. Tente de novo.`;
      // 429 e 404 ainda provam que a chave foi aceita na autenticação
      const accepted = res.status === 429 || res.status === 404;
      return json({ ok: accepted, detail });
    }
  } catch (err) {
    const aborted = (err as Error).name === "AbortError";
    return json({
      ok: false,
      detail: aborted
        ? "O provedor demorou demais para responder."
        : "Não consegui alcançar o provedor a partir deste servidor.",
    });
  } finally {
    clearTimeout(timer);
  }

  return json({ ok: true });
}
