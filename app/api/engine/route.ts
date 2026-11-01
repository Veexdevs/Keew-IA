/**
 * GET /api/engine — o motor de linguagem está ligado?
 *
 * Endpoint público e leve: a interface usa isso para dizer a verdade sobre o
 * que a Keew consegue fazer agora, em vez de prometer conversa aberta.
 */
import { KEEW_API } from "@/lib/keew-api";
import { engineState } from "@/lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const state = engineState();
  return new Response(
    JSON.stringify({
      model: KEEW_API.model,
      ...state,
      /** o que funciona sem motor */
      offline: ["matemática", "datas", "unidades", "texto", "base de conhecimento"],
    }),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}
