/**
 * Client-safe capability flags.
 * Supabase public keys are exposed through NEXT_PUBLIC_* at build time.
 */
export function isSupabaseReady(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isDesktop(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as any).keewDesktop);
}

export function isNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as any).Capacitor?.isNativePlatform?.());
}

export function platform(): "web" | "android" | "ios" | "windows" | "macos" | "linux" {
  if (typeof window === "undefined") return "web";
  if (isNativeShell()) {
    const p = (window as any).Capacitor.getPlatform();
    return p === "ios" ? "ios" : "android";
  }
  if (isDesktop()) {
    const p = (window as any).keewDesktop?.platform || "";
    if (/win/i.test(p)) return "windows";
    if (/mac|darwin/i.test(p)) return "macos";
    return "linux";
  }
  return "web";
}
