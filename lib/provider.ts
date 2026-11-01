/**
 * Keew IA — inference gateway.
 *
 * One interface, many providers. Server-side env always wins over a
 * client-supplied config (so the workspace owner keeps control of the keys).
 * Everything is streamed as normalized SSE frames:
 *
 *   data: {"t":"reasoning","v":"…"}   chain-of-thought / thinking tokens
 *   data: {"t":"text","v":"…"}        answer tokens
 *   data: {"t":"usage","v":{…}}       token accounting
 *   data: {"t":"error","v":"…"}       normalized error
 *   data: {"t":"done"}                terminal frame
 */

import type { ChatMessage, ProviderKind } from "./types";

export type GatewayConfig = {
  kind: ProviderKind;
  baseUrl: string;
  model: string;
  apiKey?: string;
};

export type GatewayRequest = {
  messages: Pick<ChatMessage, "role" | "content" | "attachments">[];
  system: string;
  temperature?: number;
  maxTokens?: number;
  config: GatewayConfig;
  signal?: AbortSignal;
};

export type StreamFrame =
  | { t: "reasoning"; v: string }
  | { t: "text"; v: string }
  | { t: "usage"; v: { in?: number; out?: number } }
  | { t: "sources"; v: { title: string; url?: string; snippet?: string; kind?: "knowledge" | "web" }[] }
  | { t: "error"; v: string }
  | { t: "done" };

/**
 * Backends de raciocínio aceitos pelo motor da Keew.
 * São detalhe de infraestrutura: nenhum nome daqui é exibido ao usuário, e o
 * modelo público é sempre "keew-1" (ver lib/keew-api.ts).
 */
type Backend = "deepseek" | "openai-compatible" | "gemini" | "anthropic" | "none";

type BackendPreset = { baseUrl: string; model: string; backend: Backend };

const BACKENDS: Record<Backend, BackendPreset> = {
  deepseek: { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-reasoner", backend: "deepseek" },
  "openai-compatible": { baseUrl: "http://127.0.0.1:8080/v1", model: "keew-local", backend: "openai-compatible" },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash",
    backend: "gemini",
  },
  anthropic: { baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-5", backend: "anthropic" },
  none: { baseUrl: "", model: "keew-1", backend: "none" },
};

/**
 * Lê o ambiente e monta o motor.
 *
 * A chave pode vir de dois lugares, nesta ordem de prioridade:
 *   1. `KEEW_MODEL_API_KEY` no ambiente — o dono do servidor decide
 *   2. a chave que o usuário colou na tela, enviada a cada pedido
 *
 * O segundo caminho é necessário porque o servidor não tem armazenamento
 * durável: guardar a chave em `process.env` numa função serverless faria o
 * usuário ver "conectado" e continuar sem resposta no pedido seguinte.
 */
export function resolveConfig(callerKey?: string): GatewayConfig {
  const envBase = (process.env.KEEW_MODEL_BASE_URL || "").trim();
  const envKey = (process.env.KEEW_MODEL_API_KEY || "").trim();
  const envModel = (process.env.KEEW_MODEL_NAME || "").trim();
  const envKind = (process.env.KEEW_MODEL_PROVIDER || "").trim();
  const key = envKey || (callerKey || "").trim();

  // qual backend usar: explícito no env, senão inferido pela base URL
  const backend: Backend =
    envKind === "gemini"
      ? "gemini"
      : envKind === "anthropic"
        ? "anthropic"
        : /anthropic\.com/.test(envBase)
          ? "anthropic"
          : /generativelanguage\.googleapis\.com/.test(envBase)
            ? "gemini"
            : envKind === "deepseek" || /api\.deepseek\.com/.test(envBase)
              ? "deepseek"
              : envBase
                ? "openai-compatible"
                : envKind
                  ? "openai-compatible"
                  : "deepseek";

  const preset = BACKENDS[backend];
  return {
    // o "kind" público é sempre keew; o backend real fica em baseUrl/model
    kind: "keew",
    baseUrl: envBase || preset.baseUrl,
    model: envModel || preset.model,
    apiKey: key || undefined,
  };
}

/** Qual protocolo de streaming usar para esta configuração. */
function backendOf(cfg: GatewayConfig): Backend {
  if (/anthropic\.com/.test(cfg.baseUrl)) return "anthropic";
  if (/generativelanguage\.googleapis\.com/.test(cfg.baseUrl)) return "gemini";
  if (!cfg.baseUrl) return "none";
  return "openai-compatible";
}

/** O motor está pronto para raciocinar com chave própria? */
export function isConfigured(cfg: GatewayConfig): boolean {
  const backend = backendOf(cfg);
  if (backend === "none") return false;
  // endpoints locais normalmente não exigem chave
  if (backend === "openai-compatible") {
    return Boolean(cfg.apiKey) || /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(cfg.baseUrl);
  }
  return Boolean(cfg.apiKey);
}

/* ─────────────────────────────────────────────────────────────── helpers */

function sse(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

function imageParts(attachments?: ChatMessage["attachments"]) {
  return (attachments || [])
    .filter((a) => a.dataUrl && a.mime.startsWith("image/"))
    .map((a) => ({ mime: a.mime, url: a.dataUrl as string }));
}

function textWithAttachments(m: GatewayRequest["messages"][number]): string {
  const files = (m.attachments || []).filter((a) => a.text);
  if (!files.length) return m.content;
  const ctx = files
    .map((f) => `\n\n<arquivo nome="${f.name}">\n${(f.text || "").slice(0, 24000)}\n</arquivo>`)
    .join("");
  return m.content + ctx;
}

/* ─────────────────────────────────────────────────────────────── streaming */

export function streamChat(req: GatewayRequest): ReadableStream<Uint8Array> {
  const backend = backendOf(req.config);
  if (backend === "gemini") return streamGemini(req);
  if (backend === "anthropic") return streamAnthropic(req);
  return streamOpenAI(req);
}

/** Protocolo de streaming compatível com o formato aberto mais usado. */
function streamOpenAI(req: GatewayRequest): ReadableStream<Uint8Array> {
  const { config, messages, system, temperature = 0.7, maxTokens = 4096, signal } = req;

  return new ReadableStream({
    async start(controller) {
      const emit = (f: StreamFrame) => controller.enqueue(sse(f));
      try {
        const prepared = messages.map((m) => {
          const imgs = m.role === "user" ? imageParts(m.attachments) : [];
          if (!imgs.length) return { role: m.role, content: textWithAttachments(m) };
          return {
            role: m.role,
            content: [
              { type: "text", text: textWithAttachments(m) },
              ...imgs.map((i) => ({ type: "image_url", image_url: { url: i.url } })),
            ],
          };
        });

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

        const res = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers,
          signal: signal ?? undefined,
          body: JSON.stringify({
            model: config.model,
            stream: true,
            temperature,
            max_tokens: maxTokens,
            messages: [{ role: "system", content: system }, ...prepared],
          }),
        });

        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "");
          emit({ t: "error", v: normalizeError(res.status, detail, config) });
          emit({ t: "done" });
          controller.close();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let usage: { in?: number; out?: number } = {};

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const raw of lines) {
            const line = raw.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            let json: any;
            try { json = JSON.parse(payload); } catch { continue; }

            const delta = json.choices?.[0]?.delta ?? {};
            const reasoning = delta.reasoning_content ?? delta.reasoning ?? delta.thinking;
            if (typeof reasoning === "string" && reasoning) emit({ t: "reasoning", v: reasoning });
            if (typeof delta.content === "string" && delta.content) emit({ t: "text", v: delta.content });

            if (json.usage) {
              usage = { in: json.usage.prompt_tokens, out: json.usage.completion_tokens };
            }
            const finish = json.choices?.[0]?.finish_reason;
            if (finish === "error") emit({ t: "error", v: "A Keew não concluiu esta resposta." });
          }
        }
        if (usage.in || usage.out) emit({ t: "usage", v: usage });
        emit({ t: "done" });
        controller.close();
      } catch (err) {
        emit({ t: "error", v: "A Keew não alcançou o motor de raciocínio." });
        emit({ t: "done" });
        controller.close();
      }
    },
  });
}

/** Google Gemini — streamGenerateContent. */
function streamGemini(req: GatewayRequest): ReadableStream<Uint8Array> {
  const { config, messages, system, temperature = 0.7, maxTokens = 4096, signal } = req;
  return new ReadableStream({
    async start(controller) {
      const emit = (f: StreamFrame) => controller.enqueue(sse(f));
      try {
        const contents = messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [
            { text: textWithAttachments(m) },
            ...imageParts(m.attachments).map((i) => ({
              inline_data: { mime_type: i.mime, data: (i.url.split(",")[1] || "") },
            })),
          ],
        }));
        const url = `${config.baseUrl.replace(/\/$/, "")}/models/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: signal ?? undefined,
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: system }] },
            generationConfig: { temperature, maxOutputTokens: maxTokens },
          }),
        });
        if (!res.ok || !res.body) {
          emit({ t: "error", v: normalizeError(res.status, await res.text().catch(() => ""), config) });
          emit({ t: "done" });
          controller.close();
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const raw of lines) {
            const line = raw.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            let json: any;
            try { json = JSON.parse(payload); } catch { continue; }
            for (const part of json.candidates?.[0]?.content?.parts ?? []) {
              if (part.thought && part.text) emit({ t: "reasoning", v: part.text });
              else if (part.text) emit({ t: "text", v: part.text });
            }
            const u = json.usageMetadata;
            if (u) emit({ t: "usage", v: { in: u.promptTokenCount, out: u.candidatesTokenCount } });
          }
        }
        emit({ t: "done" });
        controller.close();
      } catch (err) {
        emit({ t: "error", v: (err as Error).message });
        emit({ t: "done" });
        controller.close();
      }
    },
  });
}

/** Anthropic Messages API. */
function streamAnthropic(req: GatewayRequest): ReadableStream<Uint8Array> {
  const { config, messages, system, temperature = 0.7, maxTokens = 4096, signal } = req;
  return new ReadableStream({
    async start(controller) {
      const emit = (f: StreamFrame) => controller.enqueue(sse(f));
      try {
        const res = await fetch(`${config.baseUrl.replace(/\/$/, "")}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": config.apiKey || "",
            "anthropic-version": "2023-06-01",
          },
          signal: signal ?? undefined,
          body: JSON.stringify({
            model: config.model,
            max_tokens: maxTokens,
            temperature,
            system,
            stream: true,
            messages: messages.map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: textWithAttachments(m),
            })),
          }),
        });
        if (!res.ok || !res.body) {
          emit({ t: "error", v: normalizeError(res.status, await res.text().catch(() => ""), config) });
          emit({ t: "done" });
          controller.close();
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const raw of lines) {
            const line = raw.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            let json: any;
            try { json = JSON.parse(payload); } catch { continue; }
            if (json.type === "content_block_delta") {
              if (json.delta?.type === "thinking_delta") emit({ t: "reasoning", v: json.delta.thinking });
              else if (json.delta?.text) emit({ t: "text", v: json.delta.text });
            } else if (json.type === "message_delta" && json.usage) {
              emit({ t: "usage", v: { out: json.usage.output_tokens } });
            }
          }
        }
        emit({ t: "done" });
        controller.close();
      } catch (err) {
        emit({ t: "error", v: (err as Error).message });
        emit({ t: "done" });
        controller.close();
      }
    },
  });
}

/* ─────────────────────────────────────────────────────────────── errors */

export function normalizeError(status: number, detail: string, cfg: GatewayConfig): string {
  const snippet = detail.replace(/\s+/g, " ").slice(0, 320);
  // A voz é sempre da Keew: nada de nome de fornecedor, base URL ou modelo
  // interno. O usuário só precisa saber o que fazer a seguir.
  if (status === 401 || status === 403)
    return "A chave do motor foi recusada. Abra Configurações → Motor e confira a chave.";
  if (status === 402 || /insufficient|quota|credit/i.test(detail))
    return "A conta do motor está sem saldo ou cota. Sem isso eu não consigo raciocinar sobre assuntos abertos.";
  if (status === 404)
    return "O motor não encontrou o modelo configurado. Confira a chave em Configurações → Motor.";
  if (status === 429)
    return "O motor está limitando pedidos neste momento. Tente de novo em alguns segundos.";
  if (status >= 500)
    return "O motor está instável agora. O núcleo próprio continua respondendo conta, data e conversão.";
  return `O motor não concluiu este pedido (${status}). ${snippet}`;
}
