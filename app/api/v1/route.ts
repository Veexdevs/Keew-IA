/**
 * GET /api/v1 — descrição da API própria da Keew.
 * O único modelo servido é "keew-1". Não há catálogo de terceiros.
 */
import { KEEW_API } from "@/lib/keew-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (o: unknown) =>
  new Response(JSON.stringify(o, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export async function GET() {
  return json({
    object: "api",
    provider: KEEW_API.vendor,
    version: KEEW_API.version,
    model: KEEW_API.model,
    endpoints: {
      "POST /api/v1/chat": "conversa (JSON ou SSE com stream:true)",
      "GET /api/v1/models": "catálogo de modelos",
      "GET /api/health": "status do serviço",
    },
    auth: "x-keew-key: <sua chave>  ·  ou  Authorization: Bearer <sua chave>",
    example: {
      model: KEEW_API.model,
      messages: [{ role: "user", content: "Olá, Keew." }],
    },
  });
}
