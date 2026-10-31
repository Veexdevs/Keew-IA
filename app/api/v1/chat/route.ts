/**
 * Keew IA — API pública v1.
 * ═════════════════════════════════════════════════════════════════════════
 * Esta é a API da própria Keew. Um único modelo (`keew-1`), uma única chave.
 *
 *   POST /api/v1/chat          → resposta completa (JSON)
 *   POST /api/v1/chat          + "stream": true → SSE
 *   GET  /api/v1/models        → catálogo (só a Keew)
 *   GET  /api/v1               → descrição da API
 *
 * Autenticação: header `x-keew-key` ou `Authorization: Bearer <KEEW_ACCESS_KEY>`.
 * Formato de entrada compatível com o que o mundo já conhece (messages[]),
 * para que qualquer cliente existente funcione apontando a base URL para a Keew.
 */
import type { NextRequest } from "next/server";

import { APP_VERSION, clientIp, guard, rateLimit } from "@/lib/api-utils";
import { KEEW_API, KEEW_ERRORS, authorize } from "@/lib/keew-api";
import { KEEW_CORPUS, buildIndex, search, toContext } from "@/lib/knowledge";
import { reason } from "@/lib/local-engine";
import { isConfigured, resolveConfig, streamChat, type StreamFrame } from "@/lib/provider";
import type { KnowledgeDoc } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Msg = { role: "user" | "assistant" | "system"; content: string };

type Body = {
  model?: string;
  messages: Msg[];
  stream?: boolean;
  temperature?: number;
  knowledge?: KnowledgeDoc[];
  system?: string;
};

const enc = (o: StreamFrame) => `data: ${JSON.stringify(o)}\n\n`;
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export async function GET() {
  return json({
    endpoint: "/api/v1/chat",
    method: "POST",
    model: KEEW_API.model,
    stream: "adicione \"stream\": true para SSE",
    example: {
      model: KEEW_API.model,
      messages: [{ role: "user", content: "Olá, Keew." }],
    },
  });
}

export async function POST(req: NextRequest) {
  const limited = guard(req);
  if (limited) return limited;

  const auth = authorize(req.headers);
  if (!auth.ok) return json({ error: { message: auth.error, type: "auth_error" } }, auth.status);

  const rl = rateLimit(`v1:${clientIp(req)}`, 60, 60_000);
  if (!rl.ok) {
    return json({ error: { message: KEEW_ERRORS.tooMany, type: "rate_limit" } }, 429);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: { message: KEEW_ERRORS.badRequest, type: "invalid_request" } }, 400);
  }

  const messages = (body.messages || [])
    .filter((m) => m && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }));

  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return json({ error: { message: KEEW_ERRORS.badRequest, type: "invalid_request" } }, 400);

  // Nome de modelo: qualquer coisa que não seja a Keew é recusada — a API é nossa.
  if (body.model && body.model !== KEEW_API.model && body.model !== "keew") {
    return json(
      {
        error: {
          message: `Modelo desconhecido. A Keew serve apenas "${KEEW_API.model}".`,
          type: "invalid_request",
          available: [KEEW_API.model],
        },
      },
      400,
    );
  }

  const docs: KnowledgeDoc[] = [...(body.knowledge || []), ...KEEW_CORPUS];
  const local = reason(last.content, docs);
  const config = resolveConfig();
  const ready = isConfigured(config);

  /* ── resposta não-streaming ─────────────────────────────────────────── */
  if (!body.stream) {
    if (local.terminal && local.confidence >= 0.8) {
      return json({
        id: `chatcmpl_${Date.now().toString(36)}`,
        object: "chat.completion",
        model: KEEW_API.model,
        engine: "keew-core",
        choices: [{ index: 0, message: { role: "assistant", content: local.answer }, finish_reason: "stop" }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      });
    }
    if (!ready) {
      return json({
        id: `chatcmpl_${Date.now().toString(36)}`,
        object: "chat.completion",
        model: KEEW_API.model,
        engine: "keew-core",
        choices: [{ index: 0, message: { role: "assistant", content: local.answer }, finish_reason: "stop" }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      });
    }

    try {
      let text = "";
      const upstream = streamChat({
        messages: messages.slice(-24),
        system: buildSystem(body.system, toContext(search(buildIndex(docs), last.content, 4)), local),
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
          try {
            const frame = JSON.parse(line.slice(5).trim()) as StreamFrame;
            if (frame.t === "text") text += frame.v;
          } catch {
            /* frame parcial, ignora */
          }
        }
      }
      if (text.trim()) {
        return json({
          id: `chatcmpl_${Date.now().toString(36)}`,
          object: "chat.completion",
          model: KEEW_API.model,
          engine: "keew-reason",
          choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
        });
      }
      // motor sem resposta → núcleo próprio assume
      return json({
        id: `chatcmpl_${Date.now().toString(36)}`,
        object: "chat.completion",
        model: KEEW_API.model,
        engine: "keew-core",
        choices: [{ index: 0, message: { role: "assistant", content: local.answer }, finish_reason: "stop" }],
      });
    } catch {
      return json({
        id: `chatcmpl_${Date.now().toString(36)}`,
        object: "chat.completion",
        model: KEEW_API.model,
        engine: "keew-core",
        choices: [{ index: 0, message: { role: "assistant", content: local.answer }, finish_reason: "stop" }],
      });
    }
  }

  /* ── resposta streaming (SSE) ───────────────────────────────────────── */
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (f: StreamFrame) => controller.enqueue(new TextEncoder().encode(enc(f)));

      const sayLocal = async (text: string) => {
        for (const c of chunk(text, 42)) {
          emit({ t: "text", v: c });
          await sleep(8);
        }
        emit({ t: "done" });
        controller.close();
      };

      if ((local.terminal && local.confidence >= 0.8) || !ready) {
        return sayLocal(local.answer);
      }

      let produced = "";
      let failed = false;
      try {
        emit({ t: "reasoning", v: "**Keew · raciocínio**\n\n" });
        const upstream = streamChat({
          messages: messages.slice(-24),
          system: buildSystem(body.system, toContext(search(buildIndex(docs), last.content, 4)), local),
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
            try {
              frame = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }
            if (frame.t === "error") {
              failed = true;
              continue;
            }
            if (frame.t === "text") produced += frame.v;
            emit(frame);
          }
        }
      } catch {
        failed = true;
      }

      if (failed && !produced.trim()) {
        for (const c of chunk(local.answer, 42)) {
          emit({ t: "text", v: c });
          await sleep(6);
        }
      }
      emit({ t: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-keew-model": KEEW_API.model,
      "x-keew-version": APP_VERSION,
      "x-accel-buffering": "no",
    },
  });
}

/* ───────────────────────────────────────────────────────────── helpers */

function buildSystem(userSystem: string | undefined, context: string, local: ReturnType<typeof reason>) {
  const parts = [
    userSystem?.trim() ||
      "Você é a Keew IA, uma inteligência artificial própria. Responda em português do Brasil, com precisão, sem rodeios e sem se apresentar como outro produto.",
    "Formato: markdown. Títulos curtos, listas e tabelas quando ajudarem. Código em blocos com linguagem.",
    "Nunca invente fatos, números ou fontes. Se não souber, diga exatamente o que falta.",
  ];
  if (context) {
    parts.push("Base de conhecimento do workspace (cite o título entre crases quando usar):\n" + context);
  }
  if (local.confidence >= 0.5 && local.skill !== "fallback") {
    parts.push(
      `O núcleo determinístico da Keew já analisou o pedido (${local.skill}). Raciocínio:\n${local.reasoning}\n` +
        "Use como base factual e complete o que faltar.",
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

