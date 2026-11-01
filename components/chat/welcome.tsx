"use client";

import { Mark } from "@/components/ui/mark";

import { EngineNotice } from "./engine-notice";

/**
 * Tela inicial — nada além da marca.
 *
 * Sem cartões de sugestão, sem chips de capacidade, sem texto de apresentação.
 * O usuário abre a Keew e vê o nome dela.
 */
export function Welcome() {
  return (
    <div className="relative mx-auto flex w-full max-w-[760px] flex-1 flex-col items-center justify-center px-4 pb-6">
      <div className="anim-rise flex flex-col items-center">
        <div
          className="grid size-[80px] place-items-center bg-accent text-accent-fg sm:size-[92px]"
          style={{
            borderRadius: 28,
            boxShadow: "0 18px 60px -22px rgb(var(--glow) / 0.9)",
          }}
        >
          <Mark size={46} />
        </div>

        <h1 className="mt-5 text-[26px] font-semibold tracking-[-0.03em] text-fg sm:text-[30px]">
          Keew <span className="text-accent">IA</span>
        </h1>
      </div>

      <EngineNotice />
    </div>
  );
}
