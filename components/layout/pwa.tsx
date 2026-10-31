"use client";

import { useEffect } from "react";

/** Registers the offline shell so the local core keeps working without network. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (window.location.hostname === "localhost") return; // avoid dev-time cache noise
    const id = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }, 2500);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
