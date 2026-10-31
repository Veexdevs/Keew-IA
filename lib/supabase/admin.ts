/**
 * Supabase server client (service role).
 * The workspace works fully without Supabase — every call is optional and
 * failures degrade to the local/offline store instead of breaking a request.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

export function supabaseAdmin(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    cached = null;
    return cached;
  }
  try {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-application-name": "keew-ia" } },
    });
  } catch {
    cached = null;
  }
  return cached;
}

export function isSupabaseReady(): boolean {
  return supabaseAdmin() !== null;
}
