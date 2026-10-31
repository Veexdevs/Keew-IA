"use client";

import { useState } from "react";
import {
  ArrowRight, Braces, Calculator, CalendarDays, FileSearch, Languages, Lightbulb, Sparkles,
} from "lucide-react";

import { Mark } from "@/components/ui/mark";
import { useStore } from "@/lib/store";

const PROMPTS = [
  {
    icon: <Calculator className="size-4" />,
    title: "Cálculo de precisão",
    text: "Calcule (1847 × 23) / 7 + sqrt(256) e explique o passo a passo",
    tag: "núcleo local",
  },
  {
    icon: <Braces className="size-4" />,
    title: "Código de produção",
    text: "Crie um hook React de debounce com TypeScript estrito, testes e comentários no porquê",
    tag: "engenharia",
  },
  {
    icon: <FileSearch className="size-4" />,
    title: "Síntese de documento",
    text: "Resuma este texto em 5 bullets executivos e liste os riscos: (cole o texto aqui)",
    tag: "conhecimento",
  },
  {
    icon: <CalendarDays className="size-4" />,
    title: "Datas e prazos",
    text: "Quantos dias faltam entre 2026-10-31 e 2027-03-15?",
    tag: "núcleo local",
  },
  {
    icon: <Languages className="size-4" />,
    title: "Tradução técnica",
    text: "Traduza para inglês técnico mantendo termos de engenharia: (cole o texto)",
    tag: "idiomas",
  },
  {
    icon: <Lightbulb className="size-4" />,
    title: "Plano de execução",
    text: "Planeje o lançamento do app Keew IA em 4 semanas com time de 2 pessoas",
    tag: "estratégia",
  },
];

export function Welcome() {
  const { settings, agents, chats, currentChatId, pushToast, openSettings } = useStore();
  const chat = chats.find((c) => c.id === currentChatId) || chats[0];
  const agent = agents.find((a) => a.id === chat?.agentId) || agents[0];
  const [expanded, setExpanded] = useState(false);
  const hour = new Date().getHours();
  const greeting = hour < 6 ? "Boa madrugada" : hour < 12 ? "Bom dia" : hour < 19 ? "Boa tarde" : "Boa noite";
  const name = settings.userNickname && settings.userNickname !== "Você" ? `, ${settings.userNickname}` : "";

  const run = (text: string) => {
    if (text.includes("(cole")) {
      pushToast("Cole o texto no campo abaixo e envie.", "info");
      document.querySelector<HTMLTextAreaElement>("textarea")?.focus();
      return;
    }
    const el = document.querySelector<HTMLTextAreaElement>("textarea");
    if (el) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.focus();
    }
  };

  const shown = expanded ? PROMPTS : PROMPTS.slice(0, 4);

  return (
    <div className="relative mx-auto flex w-full max-w-[760px] flex-col items-center px-1 pb-4 pt-6 sm:pt-10">
      {/* mark + greeting */}
      <div className="anim-rise relative mb-5 grid place-items-center">
        <div
          className="absolute size-24 rounded-full blur-2xl"
          style={{ background: "radial-gradient(circle, rgb(var(--glow) / 0.28), transparent 70%)" }}
        />
        <div
          className="relative grid size-14 place-items-center bg-accent text-accent-fg"
          style={{
            borderRadius: 16,
            boxShadow: "0 8px 28px -8px rgb(var(--glow) / 0.85)",
          }}
        >
          <Mark size={30} />
        </div>
      </div>

      <h1 className="anim-rise delay-1 text-center text-[22px] font-semibold tracking-[-0.02em] text-fg sm:text-[26px]">
        {greeting}{name}.
      </h1>
      <p className="anim-rise delay-2 mt-1.5 max-w-md text-center text-[12.5px] leading-relaxed text-muted">
        Sou a <span className="font-medium text-fg">Keew IA</span> — raciocínio próprio, sempre online. Agente ativo:{" "}
        <button onClick={() => openSettings("agentes")} className="font-medium text-accent hover:underline">
          {agent?.name}
        </button>
        .
      </p>

      {/* capability strip */}
      <div className="anim-rise delay-2 mt-4 flex flex-wrap items-center justify-center gap-1.5">
        {[
          { label: "Raciocínio próprio", tone: "text-accent border-accent-line bg-accent/8" },
          { label: "Memória", tone: "text-emerald-400 border-emerald-500/25 bg-emerald-500/8" },
          { label: "Agentes", tone: "text-fuchsia-400 border-fuchsia-500/25 bg-fuchsia-500/8" },
          { label: "14 temas", tone: "text-amber-400 border-amber-500/25 bg-amber-500/8" },
        ].map((c) => (
          <span
            key={c.label}
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide ${c.tone}`}
          >
            {c.label}
          </span>
        ))}
      </div>

      {/* prompts */}
      <div className="mt-7 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {shown.map((p, i) => (
          <button
            key={p.title}
            onClick={() => run(p.text)}
            className="anim-rise group flex items-start gap-2.5 rounded-[var(--r-lg)] border border-line bg-panel/70 p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-line hover:bg-panel"
            style={{ animationDelay: `${0.03 * i + 0.08}s` }}
          >
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-[var(--r-sm)] border border-line bg-elev text-accent transition-colors group-hover:border-accent-line">
              {p.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="text-[12.5px] font-medium text-fg">{p.title}</span>
                <span className="rounded-[3px] bg-elev px-1 py-0.5 font-mono text-[8.5px] uppercase tracking-wide text-subtle">
                  {p.tag}
                </span>
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-muted line-clamp-2">{p.text}</span>
            </span>
            <ArrowRight className="mt-1 size-3.5 shrink-0 text-subtle opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
          </button>
        ))}
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 flex items-center gap-1.5 text-[11px] text-subtle transition-colors hover:text-fg"
      >
        <Sparkles className="size-3" />
        {expanded ? "Mostrar menos" : "Mais exemplos"}
      </button>
    </div>
  );
}
