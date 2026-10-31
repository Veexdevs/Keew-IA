"use client";

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

import { useStore } from "@/lib/store";

export function Toast() {
  const toast = useStore((s) => s.toast);
  const clear = useStore((s) => s.clearToast);
  if (!toast) return null;

  const Icon = toast.tone === "ok" ? CheckCircle2 : toast.tone === "error" ? TriangleAlert : Info;
  const tone =
    toast.tone === "ok"
      ? "text-emerald-400 border-emerald-500/30"
      : toast.tone === "error"
        ? "text-rose-400 border-rose-500/30"
        : "text-accent border-accent-line";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[120] flex justify-center px-4">
      <div
        role="status"
        className={`anim-scale pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl border bg-panel/95 px-3.5 py-2.5 text-[12px] shadow-2xl backdrop-blur ${tone}`}
      >
        <Icon className="size-4 shrink-0" />
        <span className="text-fg">{toast.message}</span>
        <button
          onClick={clear}
          className="ml-1 rounded p-0.5 text-muted transition-colors hover:text-fg"
          aria-label="Fechar aviso"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
