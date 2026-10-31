/**
 * GET /api/v1/models
 * A Keew serve um modelo. É isso que qualquer cliente externo enxerga.
 */
import { KEEW_API } from "@/lib/keew-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(
    JSON.stringify(
      {
        object: "list",
        data: [
          {
            id: KEEW_API.model,
            object: "model",
            name: KEEW_API.displayName,
            owned_by: KEEW_API.vendor,
            created: 1767225600,
            context_window: 128000,
            capabilities: ["chat", "reasoning", "code", "vision", "tools", "knowledge"],
          },
        ],
      },
      null,
      2,
    ),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=300",
        "x-keew-version": KEEW_API.version,
      },
    },
  );
}
