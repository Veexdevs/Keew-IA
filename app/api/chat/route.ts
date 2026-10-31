/**
 * POST /api/chat
 * ═════════════════════════════════════════════════════════════════════════
 * The Keew IA gateway. Order of execution:
 *
 *   1. Local Reasoning Core (KRL) — deterministic skills answer instantly.
 *   2. Retrieval — knowledge base + built-in corpus ground the prompt.
 *   3. LLM streaming — DeepSeek/OpenRouter/Gemini/… streamed as SSE.
 *   4. Resilience — if the provider fails mid-flight, the local core takes
 *      over so the assistant never goes dark (24/7 requirement).
 *
 * Response is always SSE with normalized frames (see lib/provider.ts).
 */
import type { NextRequest } from "next/server";

import { APP_VERSION, clientIp, guard, rateLimit } from "@/lib/api-utils";
import { KEEW_CORPUS, buildIndex, search, toContext } from "@/lib/knowledge";
import { reason } from "@/lib/local-engine";
import { isConfigured, resolveConfig, streamChat, type GatewayConfig, type StreamFrame } from "@/lib/provider";
import type { ChatMessage, KnowledgeDoc } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  messages: Pick<ChatMessage, "role" | "content" | "attachments">[];
  system?: string;
  agentId?: string;
  temperature?: number;
  model?: string;
  client?: Partial<GatewayConfig>;
  knowledge?: KnowledgeDoc[];
  /** "auto" tries the model first, "local" forces the KRL, "model" forces the LLM */
  mode?: "auto" | "local" | "model";
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

  const config = resolveConfig({ ...body.client, model: body.model || body.client?.model });
  const ready = isConfigured(config);
  const mode = body.mode || "auto";

  // ── 1 · local reasoning core ───────────────────────────────────────────
  const localDocs: KnowledgeDoc[] = [...(body.knowledge || []), ...KEEW_CORPUS];
  const local = reason(last.content, localDocs);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (f: StreamFrame) => controller.enqueue(new TextEncoder().encode(enc(f)));
      const emitPrompt = (f: StreamFrame) => controller.enqueue(new TextEncoder().encode(enc(f)));

      // deterministic skill answered with full confidence → no model needed
      if (mode !== "model" && local.terminal && local.confidence >= 0.8) {
        emitPrompt({ t: "reasoning", v: `**Núcleo local · ${local.skill}**\n\n${local.reasoning || ""}\n\n` });
        // stream the answer in readable chunks so the UI behaves like any reply
        const chunks = chunk(local.answer, 42);
        for (const c of chunks) {
          emit({ t: "text", v: c });
          await sleep(8);
        }
        emit({ t: "usage", v: { in: 0, out: 0 } });
        emit({ t: "done" });
        controller.close();
        return;
      }

      if (mode === "local" || !ready) {
        emitPrompt({ t: "reasoning", v: `**Núcleo local · ${local.skill}**\n\n${local.reasoning || ""}\n\n` });
        if (!ready) {
          emitPrompt({
            t: "reasoning",
            v: "Nenhum provedor configurado: rode **Configurações → Modelo** para ativar o modelo grande. Enquanto isso sigo com o núcleo próprio.\n\n",
          });
        }
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

      emitPrompt({
        t: "reasoning",
        v:
          `**Keew IA · ${config.kind === "deepseek" ? "DeepSeek R1" : config.model}**\n\n` +
          `- Rota: ${config.kind} · \`${config.model}\`\n` +
          `- Contexto recuperado: ${hits.length} documento(s)\n` +
          `- Núcleo local: ${local.skill} (confiança ${(local.confidence * 100).toFixed(0)}%)\n\n`,
      });

      const system = buildSystem(body.system, context, local);

      // ── 3 · stream the model ───────────────────────────────────────────
      let produced = "";
      let providerFailed = false;
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
              providerFailed = true;
              emit({ t: "reasoning", v: `\n> ⚠️ ${frame.v}\n\n` });
              continue;
            }
            if (frame.t === "text") produced += frame.v;
            emit(frame);
          }
        }
      } catch (err) {
        providerFailed = true;
        emit({ t: "reasoning", v: `\n> ⚠️ ${(err as Error).message}\n\n` });
      }

      // ── 4 · resilience: never leave the user with nothing ──────────────
      if (providerFailed && !produced.trim()) {
        emit({
          t: "reasoning",
          v: "Provedor indisponível — acionando o núcleo local para não interromper o atendimento.\n\n",
        });
        const rescue = reason(last.content, localDocs);
        for (const c of chunk(rescue.answer, 42)) {
          emit({ t: "text", v: c });
          await sleep(6);
        }
      } else if (providerFailed) {
        emit({ t: "text", v: "\n\n> A conexão com o provedor oscilou. Resposta parcial acima — o núcleo local está disponível como reserva." });
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
