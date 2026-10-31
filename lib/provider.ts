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
  | { t: "error"; v: string }
  | { t: "done" };

export const PROVIDER_PRESETS: Record<string, { baseUrl: string; model: string; label: string; docs: string }> = {
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-reasoner",
    label: "DeepSeek (R1 / V3)",
    docs: "https://api-docs.deepseek.com",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "deepseek/deepseek-r1",
    label: "OpenRouter",
    docs: "https://openrouter.ai/docs",
  },
  ollama: {
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "deepseek-r1:8b",
    label: "Ollama (local)",
    docs: "https://ollama.com",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    label: "OpenAI-compatible",
    docs: "https://platform.openai.com/docs",
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    model: "deepseek-r1-distill-llama-70b",
    label: "Groq",
    docs: "https://console.groq.com/docs",
  },
  together: {
    baseUrl: "https://api.together.xyz/v1",
    model: "deepseek-ai/DeepSeek-R1-Distill-Llama-70B",
    label: "Together AI",
    docs: "https://docs.together.ai",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash",
    label: "Google Gemini",
    docs: "https://ai.google.dev/gemini-api/docs",
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-5",
    label: "Anthropic",
    docs: "https://docs.anthropic.com",
  },
  local: {
    baseUrl: "http://127.0.0.1:8080/v1",
    model: "keew-local",
    label: "Inferência própria (vLLM/TGI)",
    docs: "docs/OWN-MODEL.md",
  },
};

/** Resolve the effective gateway config: server env ▸ client request ▸ preset defaults. */
export function resolveConfig(client?: Partial<GatewayConfig>): GatewayConfig {
  const envKind = (process.env.KEEW_MODEL_PROVIDER || "").trim();
  const envKey = (process.env.KEEW_MODEL_API_KEY || "").trim();
  const envBase = (process.env.KEEW_MODEL_BASE_URL || "").trim();
  const envModel = (process.env.KEEW_MODEL_NAME || "").trim();

  const kind = ((envKind || client?.kind || "deepseek") as ProviderKind);
  const preset = PROVIDER_PRESETS[kind === "openai-compatible" ? "openai" : kind];
  return {
    kind,
    baseUrl: envBase || client?.baseUrl || preset?.baseUrl || PROVIDER_PRESETS.deepseek.baseUrl,
    model: envModel || client?.model || preset?.model || PROVIDER_PRESETS.deepseek.model,
    apiKey: envKey || client?.apiKey || undefined,
  };
}

export function isConfigured(cfg: GatewayConfig): boolean {
  if (cfg.kind === "ollama" || cfg.kind === "openai-compatible") {
    // local endpoints usually need no key; treat a key or a loopback base URL as ready
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
  if (req.config.kind === "gemini") return streamGemini(req);
  if (req.config.kind === "anthropic") return streamAnthropic(req);
  return streamOpenAI(req);
}

/** OpenAI-compatible: DeepSeek, OpenRouter, Groq, Together, Ollama, vLLM, TGI, LM Studio… */
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
        if (config.kind === "openrouter") {
          headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL || "https://keew-ia.vercel.app";
          headers["X-Title"] = "Keew IA";
        }

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
            if (finish === "error") emit({ t: "error", v: "O provedor encerrou a resposta com erro." });
          }
        }
        if (usage.in || usage.out) emit({ t: "usage", v: usage });
        emit({ t: "done" });
        controller.close();
      } catch (err) {
        emit({ t: "error", v: (err as Error).message || "Falha de rede ao falar com o provedor." });
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
  if (status === 401 || status === 403)
    return `Credenciais recusadas pelo provedor (${status}). Verifique a chave de API em Configurações → Modelo.`;
  if (status === 402 || /insufficient|quota|credit/i.test(detail))
    return "O provedor informou saldo/quota insuficiente. Adicione créditos ou troque de modelo.";
  if (status === 404)
    return `Modelo ou endpoint não encontrado (404). Confira "${cfg.model}" e a base URL "${cfg.baseUrl}".`;
  if (status === 429)
    return "Limite de requisições atingido (429). A Keew vai tentar novamente — aguarde alguns segundos.";
  if (status >= 500)
    return `O provedor está instável (${status}). A Keew pode continuar em Modo Local enquanto isso.`;
  return `Falha do provedor (${status}). ${snippet}`;
}
