/**
 * Shared helpers for Keew IA route handlers.
 */
import type { NextRequest } from "next/server";

export const APP_VERSION = "1.0.0";
export const STARTED_AT = Date.now();

export function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}

export function fail(status: number, message: string, extra?: Record<string, unknown>) {
  return json({ ok: false, error: message, ...extra }, { status });
}

/**
 * Lightweight access gate. When KEEW_ACCESS_KEY is set, mutating endpoints
 * (chat, knowledge, automations) require either the header or the cookie.
 */
export function isAuthorized(req: NextRequest): boolean {
  const key = (process.env.KEEW_ACCESS_KEY || "").trim();
  if (!key) return true;
  const header = req.headers.get("x-keew-key") || "";
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  const cookie = req.cookies.get("keew_key")?.value || "";
  return [header, bearer, cookie].some((v) => v && timingSafeEqual(v, key));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function guard(req: NextRequest): Response | null {
  if (isAuthorized(req)) return null;
  return fail(401, "Acesso restrito. Informe a chave do workspace (KEEW_ACCESS_KEY) para continuar.", {
    hint: "Configurações → Workspace → Chave de acesso",
  });
}

/** Cron endpoints accept either Vercel's cron header or a bearer secret. */
export function isCron(req: NextRequest): boolean {
  const secret = (process.env.KEEW_CRON_SECRET || "").trim();
  const cronHeader = req.headers.get("x-vercel-cron");
  if (cronHeader) return true;
  if (!secret) return true;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon"
  );
}

/** Simple in-memory rate limiter (per instance). Good enough for a solo workspace. */
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(id: string, limit = 40, windowMs = 60_000): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(id);
  if (!b || b.reset < now) {
    buckets.set(id, { count: 1, reset: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  b.count += 1;
  if (b.count > limit) return { ok: false, retryAfter: Math.ceil((b.reset - now) / 1000) };
  return { ok: true, retryAfter: 0 };
}
