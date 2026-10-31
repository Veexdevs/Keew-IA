/**
 * GET /api/health — liveness/readiness for the always-on plane.
 * Used by the workspace status chip, uptime monitors and the cron keep-warm job.
 */
import { APP_VERSION, STARTED_AT, json } from "@/lib/api-utils";
import { isConfigured, resolveConfig } from "@/lib/provider";
import { isSupabaseReady } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = resolveConfig();
  const configured = isConfigured(config);
  return json({
    ok: true,
    service: "keew-ia",
    version: APP_VERSION,
    uptimeSec: Math.round((Date.now() - STARTED_AT) / 1000),
    at: new Date().toISOString(),
    provider: config.kind,
    model: config.model,
    configured,
    supabase: isSupabaseReady(),
    node: process.version,
    region: process.env.VERCEL_REGION || "local",
    checks: {
      gateway: true,
      localCore: true,
      knowledge: true,
      memory: isSupabaseReady(),
    },
  });
}
