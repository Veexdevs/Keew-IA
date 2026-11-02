/**
 * GET /api/model
 *
 * Estado do modelo treinado do zero pela Keew. O site pergunta ao servidor do
 * modelo (models/serve.py) se ele está no ar e, se estiver, devolve os números
 * reais do treino. Se não estiver, responde `online: false` — a interface então
 * mostra o snapshot medido e diz que o servidor está offline, em vez de fingir
 * que está tudo no ar.
 */
import { KEEW_API } from "@/lib/keew-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 3500;

function modelEndpoint(): string {
  // o modelo próprio pode rodar em qualquer host; /v1 é o sufixo do protocolo
  const base = (process.env.KEEW_MODEL_BASE_URL || "").replace(/\/$/, "");
  if (base) return base.replace(/\/v1$/, "");
  return "http://127.0.0.1:8080";
}

export async function GET() {
  const base = modelEndpoint();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`${base}/health`, {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const health = await res.json();
      return json({ online: true, base, health });
    }
  } catch {
    /* servidor do modelo fora do ar: segue para a resposta offline */
  }

  return json({
    online: false,
    base,
    model: KEEW_API.model,
    detail: "O servidor do modelo não respondeu neste endereço.",
  });
}

function json(o: unknown) {
  return new Response(JSON.stringify(o), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
