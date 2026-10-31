/**
 * GET|POST /api/automations/run
 * ═════════════════════════════════════════════════════════════════════════
 * O plano 24/7. Invocado pelo Vercel Cron (diário, ver vercel.json) e pelo
 * GitHub Actions a cada 10 minutos como agendador principal.
 *
 * Responsibilities
 *   1. Mantém as funções aquecidas e prova que a Keew está no ar.
 *   2. Executa as automações vencidas do Supabase, registrando status e resultado.
 *   3. Nunca falha alto: uma automação quebrada não derruba o heartbeat.
 */
import type { NextRequest } from "next/server";

import { APP_VERSION, isCron, json } from "@/lib/api-utils";
import { KEEW_CORPUS, buildIndex, search, toContext } from "@/lib/knowledge";
import { reason } from "@/lib/local-engine";
import { isConfigured, resolveConfig, streamChat } from "@/lib/provider";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type StoredAutomation = {
  id: string;
  name: string;
  schedule: string;          // cron expression
  prompt: string;
  agent_id?: string;
  enabled: boolean;
  last_run_at?: string | null;
  last_status?: string | null;
  last_result?: string | null;
};

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}

async function run(req: NextRequest) {
  if (!isCron(req)) {
    return json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const config = resolveConfig();
  const sb = supabaseAdmin();
  const out = {
    ok: true,
    version: APP_VERSION,
    at: new Date().toISOString(),
    heartbeat: "alive" as const,
    provider: { kind: config.kind, model: config.model, configured: isConfigured(config) },
    executed: [] as { id: string; name: string; status: string; ms: number; preview?: string }[],
    skipped: [] as { id: string; name: string; reason: string }[],
    storage: sb ? "supabase" : "none",
  };

  // ── 1 · keep-warm: exercise the gateway so cold starts stay rare ───────
  try {
    const probe = reason("status do núcleo", KEEW_CORPUS);
    out.provider.configured = out.provider.configured && probe.skill !== "fallback";
  } catch {
    /* never fail the heartbeat */
  }

  if (!sb) {
    return json({ ...out, ms: Date.now() - started, note: "Supabase não configurado: apenas heartbeat." });
  }

  // ── 2 · due automations ────────────────────────────────────────────────
  let due: StoredAutomation[] = [];
  try {
    const { data, error } = await sb
      .from("keew_automations")
      .select("*")
      .eq("enabled", true)
      .order("last_run_at", { ascending: true, nullsFirst: true })
      .limit(10);
    if (error) throw error;
    due = (data || []).filter((a: StoredAutomation) => isDue(a));
  } catch (err) {
    return json({ ...out, ok: false, error: `Falha ao listar automações: ${(err as Error).message}` });
  }

  for (const job of due.slice(0, 4)) {
    const t0 = Date.now();
    let status = "ok";
    let preview = "";
    try {
      const local = reason(job.prompt, KEEW_CORPUS);
      if (isConfigured(config) && !local.terminal) {
        const index = buildIndex(KEEW_CORPUS);
        const ctx = toContext(search(index, job.prompt, 3));
        const upstream = streamChat({
          messages: [{ role: "user", content: job.prompt }],
          system: `Você é a Keew IA executando a automação "${job.name}" sem supervisão humana. Produza um relatório curto (até 250 palavras), objetivo, com o essencial e o próximo passo.${ctx ? `\n\nContexto:\n${ctx}` : ""}`,
          temperature: 0.4,
          maxTokens: 700,
          config,
        });
        const reader = upstream.getReader();
        const dec = new TextDecoder();
        let text = "";
        let raw = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          raw += dec.decode(value, { stream: true });
          const parts = raw.split("\n\n");
          raw = parts.pop() ?? "";
          for (const p of parts) {
            const line = p.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            try {
              const f = JSON.parse(line.slice(5).trim());
              if (f.t === "text") text += f.v;
              if (f.t === "error") status = "error";
            } catch { /* skip */ }
          }
        }
        preview = (text || local.answer).slice(0, 400);
      } else {
        preview = local.answer.replace(/[#*`>_]/g, "").slice(0, 400);
      }
    } catch (err) {
      status = "error";
      preview = (err as Error).message.slice(0, 200);
    }

    const ms = Date.now() - t0;
    out.executed.push({ id: job.id, name: job.name, status, ms, preview });
    try {
      await sb
        .from("keew_automations")
        .update({ last_run_at: new Date().toISOString(), last_status: status, last_result: preview, runs: undefined })
        .eq("id", job.id);
      await sb.from("keew_runs").insert({
        automation_id: job.id,
        status,
        ms,
        result: preview,
        created_at: new Date().toISOString(),
      });
    } catch {
      /* logging is best-effort */
    }
  }

  return json({ ...out, ms: Date.now() - started });
}

/** Very small cron matcher: supports "*" and exact numbers in the m h dom mon dow slots. */
function isDue(a: StoredAutomation): boolean {
  if (!a.last_run_at) return true;
  const last = new Date(a.last_run_at).getTime();
  const parts = (a.schedule || "*/15 * * * *").trim().split(/\s+/);
  const now = new Date();
  if (parts.length !== 5) return Date.now() - last > 6 * 3600_000;
  const [min, hour] = parts;
  const minuteNow = now.getUTCMinutes();
  const hourNow = now.getUTCHours();

  const matches = (spec: string, value: number): boolean => {
    if (spec === "*") return true;
    if (spec.startsWith("*/")) return value % parseInt(spec.slice(2), 10) === 0;
    return spec.split(",").some((s) => parseInt(s, 10) === value);
  };
  if (!matches(min, minuteNow) || !matches(hour, hourNow)) return false;
  return Date.now() - last > 9 * 60_000;
}
