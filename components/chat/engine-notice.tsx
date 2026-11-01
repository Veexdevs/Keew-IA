"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

import { useStore } from "@/lib/store";

/**
 * Aviso de motor.
 *
 * Aparece na tela inicial apenas quando o motor de linguagem não está
 * conectado, para a Keew não prometer uma conversa que ela não consegue ter.
 * Quando o motor está no ar, este componente não renderiza nada.
 */
export function EngineNotice() {
  const openSettings = useStore((s) => s.openSettings);
  const engineKey = useStore((s) => s.settings.engineKey);
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/engine", {
      headers: engineKey ? { "x-keew-engine-key": engineKey } : {},
    })
      .then((r) => r.json())
      .then((d) => alive && setReady(Boolean(d.ready)))
      .catch(() => alive && setReady(false));
    return () => {
      alive = false;
    };
  }, [engineKey]);

  if (ready !== false) return null;

  return (
    <div className="anim-rise mt-7 w-full max-w-[380px]">
      <div className="rounded-[var(--r-lg)] border border-line bg-panel px-4 py-3.5 text-center">
        <p className="text-[12.5px] leading-relaxed text-muted">
          Motor de linguagem não conectado.
          <br />
          Por enquanto eu resolvo conta, datas, conversões e seus documentos.
        </p>
        <button
          onClick={() => openSettings("motor")}
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-elev px-3.5 text-[12px] font-medium text-fg transition-colors hover:border-accent hover:text-accent"
        >
          <Zap className="size-3.5" />
          Conectar motor
        </button>
      </div>
    </div>
  );
}
