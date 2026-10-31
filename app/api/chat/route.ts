/**
 * POST /api/chat
 * ═════════════════════════════════════════════════════════════════════════
 * The Keew IA gateway. Order of execution:
 *
 *   1. Local Reasoning Core (KRL) — deterministic skills answer instantly.
 *   2. Retrieval — knowledge base + built-in corpus ground the prompt.
 *   3. Keew engine — streamed as SSE.
 *   4. Resilience — if the engine fails mid-flight, the local core takes
 *      over so the assistant never goes dark (24/7 requirement).
 *
 * Response is always SSE with normalized frames (see lib/provider.ts).
 */
import type { NextRequest } from "next/server";

import { APP_VERSION, clientIp, guard, rateLimit } from "@/lib/api-utils";
import { KEEW_CORPUS, buildIndex, search, toContext } from "@/lib/knowledge";
import { reason } from "@/lib/local-engine";
import { extractCitations } from "@/lib/citations";
import { isConfigured, resolveConfig, streamChat, type StreamFrame } from "@/lib/provider";
import type { ChatMessage, KnowledgeDoc } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  messages: Pick<ChatMessage, "role" | "content" | "attachments">[];
  system?: string;
  agentId?: string;
  temperature?: number;
  knowledge?: KnowledgeDoc[];
  /** "local" força o núcleo determinístico; "auto" deixa a Keew decidir */
  mode?: "auto" | "local";
  think?: boolean;
};

const enc = (o: StreamFrame) => `data: ${JSON.stringify(o)}\n\n`;

export async function POST(req: NextRequest) {
  const limited = guard(req);
  if (limited) return limited;

  const rl = rateLimit(`chat:${clientIp(req)}`, 60, 60_000);
  if (!rl.ok) {
    return new Response(
      enc({ t: "error", v: `Muitas mensagens em pouco tempo. Tente novamente em ${rl.retryAfter}s.` }) + enc({ t: "done" }),
      { headers: { "content-type": "text/event-stream", "retry-after": String(rl.retryAfter) } },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "JSON inválido" }), { status: 400 });
  }

  const messages = (body.messages || []).filter((m) => m && typeof m.content === "string");
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) {
    return new Response(JSON.stringify({ ok: false, error: "Mensagem ausente" }), { status: 400 });
  }

  const config = resolveConfig();
  const ready = isConfigured(config);
  const mode = body.mode || "auto";

  // ── 1 · local reasoning core ───────────────────────────────────────────
  const localDocs: KnowledgeDoc[] = [...(body.knowledge || []), ...KEEW_CORPUS];
  const local = reason(last.content, localDocs);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (f: StreamFrame) => controller.enqueue(new TextEncoder().encode(enc(f)));
      const emitPrompt = (f: StreamFrame) => controller.enqueue(new TextEncoder().encode(enc(f)));

      // skill determinística resolvida com confiança alta → sem chamada externa
      if (local.terminal && local.confidence >= 0.8) {
        // stream the answer in readable chunks so the UI behaves like any reply
        const chunks = chunk(local.answer, 42);
        for (const c of chunks) {
          emit({ t: "text", v: c });
          await sleep(8);
        }
        if (local.skill === "knowledge") {
          const hitDocs = search(buildIndex(localDocs), last.content, 3).map((d) => ({
            title: d.title,
            snippet: (d.excerpt || d.content).slice(0, 240),
          }));
          if (hitDocs.length) emit({ t: "sources", v: hitDocs.map((d) => ({ ...d, kind: "knowledge" as const })) });
        }
        emit({ t: "usage", v: { in: 0, out: 0 } });
        emit({ t: "done" });
        controller.close();
        return;
      }

      if (mode === "local" || !ready) {
        for (const c of chunk(local.answer, 42)) {
          emit({ t: "text", v: c });
          await sleep(8);
        }
        emit({ t: "done" });
        controller.close();
        return;
      }

      // ── 2 · retrieval grounding ────────────────────────────────────────
      const index = buildIndex(localDocs);
      const hits = search(index, last.content, 4);
      const context = toContext(hits);

      const system = buildSystem(body.system, context, local);

      // ── 3 · raciocínio profundo ───────────────────────────────────────────
      let produced = "";
      let engineFailed = false;
      try {
        const upstream = streamChat({
          messages: messages.slice(-24),
          system,
          temperature: body.temperature ?? 0.7,
          config,
        });
        const reader = upstream.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            let frame: StreamFrame;
            try { frame = JSON.parse(line.slice(5).trim()); } catch { continue; }
            if (frame.t === "error") {
              engineFailed = true;
              emit({ t: "text", v: `\n\n> ${frame.v}\n` });
              continue;
            }
            if (frame.t === "text") produced += frame.v;
            emit(frame);
          }
        }
      } catch (err) {
        engineFailed = true;
        emit({ t: "text", v: `\n\n> A Keew oscilou na conexão.\n` });
      }

      // ── 4 · resilience: never leave the user with nothing ──────────────
      if (engineFailed && !produced.trim()) {
        const rescue = reason(last.content, localDocs);
        for (const c of chunk(rescue.answer, 42)) {
          emit({ t: "text", v: c });
          await sleep(6);
        }
      } else if (engineFailed) {
        emit({ t: "text", v: "\n\n> A conexão oscilou no meio da resposta. O que está acima foi entregue; o núcleo próprio continua disponível." });
      }

      // fontes: documentos da base + links citados na própria resposta
      const sources = extractCitations(
        produced,
        hits.map((d) => ({ title: d.title, content: d.excerpt || d.content })),
      );
      if (sources.length) emit({ t: "sources", v: sources.map((s) => ({ ...s, kind: s.kind ?? "web" })) });

      emit({ t: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-keew-version": APP_VERSION,
      "x-accel-buffering": "no",
    },
  });
}

/* ───────────────────────────────────────────────────────────── helpers */

function buildSystem(userSystem: string | undefined, context: string, local: ReturnType<typeof reason>) {
  const parts = [
    userSystem?.trim() ||
      "Você é a Keew IA, inteligência artificial própria da Veexdevs: engenharia, produto, redação técnica e análise. Responda em português do Brasil, com precisão e sem rodeios.",
    "Formato: markdown. Use títulos curtos, listas e tabelas. Código em blocos com linguagem.",
    "Nunca invente fatos, números ou fontes. Se não souber, diga o que falta saber.",
  ];
  if (context) {
    parts.push(
      "Base de conhecimento do workspace (use quando for relevante e cite o título do documento entre crases):\n" +
        context,
    );
  }
  if (local.confidence >= 0.5 && local.skill !== "fallback") {
    parts.push(
      `O núcleo determinístico da Keew já analisou o pedido (${local.skill}). Raciocínio dele:\n${local.reasoning}\n` +
        `Use isso como base factual quando fizer sentido e complete o que faltar.`,
    );
  }
  return parts.join("\n\n");
}

function chunk(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET() {
  return new Response(
    JSON.stringify({
      ok: true,
      endpoint: "/api/chat",
      method: "POST",
      stream: "sse",
      version: APP_VERSION,
    }),
    { headers: { "content-type": "application/json" } },
  );
}
