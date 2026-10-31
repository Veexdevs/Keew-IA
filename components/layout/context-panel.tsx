"use client";

import {
  Activity, BookOpen, Bot, ChevronRight, Cpu, Gauge, HardDrive, Layers, Sparkles, Timer, Trash2, X,
} from "lucide-react";

import { Mark } from "@/components/ui/mark";
import { AGENT_TOOL_LABEL } from "@/lib/agents";
import { useStore } from "@/lib/store";
import { THEME_MAP, type ThemeId } from "@/lib/themes";

export function ContextPanel() {
  const {
    contextOpen, setContextOpen, chats, currentChatId, agents, usage,
    knowledge, settings, openSettings, automations,
  } = useStore();

  if (!contextOpen) return null;

  const chat = chats.find((c) => c.id === currentChatId) || chats[0];
  const agent = agents.find((a) => a.id === chat?.agentId) || agents[0];
  const theme = THEME_MAP[settings.theme as ThemeId] || THEME_MAP.onyx;
  const msgs = chat?.messages || [];
  const userMsgs = msgs.filter((m) => m.role === "user").length;
  const words = msgs.reduce((n, m) => n + m.content.split(/\s+/).filter(Boolean).length, 0);
  const chars = msgs.reduce((n, m) => n + m.content.length, 0);
  const activeAutomations = automations.filter((a) => a.enabled).length;

  return (
    <aside className="anim-slide absolute inset-y-0 right-0 z-30 flex w-full max-w-[330px] flex-col border-l border-line bg-panel/95 backdrop-blur-xl lg:relative lg:inset-auto lg:z-auto">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-3">
        <div className="flex items-center gap-2">
          <Layers className="size-3.5 text-accent" />
          <span className="text-[12px] font-semibold text-fg">Contexto</span>
        </div>
        <button
          onClick={() => setContextOpen(false)}
          className="rounded-[var(--r-sm)] p-1.5 text-muted transition-colors hover:bg-elev hover:text-fg"
          aria-label="Fechar painel"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="scroll-thin flex-1 space-y-4 overflow-y-auto p-3">
        {/* agent card */}
        <section className="rounded-[var(--r-lg)] border border-line bg-elev/40 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-subtle">
            <Bot className="size-3" /> Agente
          </div>
          <div className="flex items-start gap-2.5">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-[var(--r-sm)] text-[14px]"
              style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)", color: agent?.accent }}
            >
              {agent?.emoji}
            </span>
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-fg">{agent?.name}</p>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">{agent?.description}</p>
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1">
            {agent?.tools?.map((t) => (
              <span key={t} className="rounded-[3px] border border-line bg-panel px-1.5 py-0.5 text-[9.5px] text-muted">
                {AGENT_TOOL_LABEL[t] || t}
              </span>
            ))}
          </div>
          <button
            onClick={() => openSettings("agentes")}
            className="mt-2.5 flex w-full items-center justify-between rounded-[var(--r-sm)] border border-line px-2 py-1.5 text-[10.5px] text-muted transition-colors hover:border-accent-line hover:text-fg"
          >
            Trocar / criar agente
            <ChevronRight className="size-3" />
          </button>
        </section>

        {/* engine — a Keew é a única, não há provedor para escolher */}
        <section className="rounded-[var(--r-lg)] border border-line bg-elev/40 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-subtle">
            <Cpu className="size-3" /> Inteligência
          </div>
          <dl className="space-y-1.5 text-[11px]">
            <Row k="Modelo" v="Keew 1" />
            <Row k="Raciocínio" v="próprio" tone="ok" />
            <Row k="Disponibilidade" v="24/7" tone="ok" />
            <Row k="Tema" v={theme.name} />
          </dl>
        </section>

        {/* conversation metrics */}
        <section className="rounded-[var(--r-lg)] border border-line bg-elev/40 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-subtle">
            <Activity className="size-3" /> Esta conversa
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat icon={<Timer className="size-3" />} label="mensagens" value={String(userMsgs)} />
            <Stat icon={<Gauge className="size-3" />} label="palavras" value={words.toLocaleString("pt-BR")} />
            <Stat icon={<HardDrive className="size-3" />} label="caracteres" value={chars.toLocaleString("pt-BR")} />
            <Stat icon={<Sparkles className="size-3" />} label="tokens ~" value={Math.round(chars / 4).toLocaleString("pt-BR")} />
          </div>
        </section>

        {/* knowledge */}
        <section className="rounded-[var(--r-lg)] border border-line bg-elev/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-subtle">
              <BookOpen className="size-3" /> Conhecimento
            </div>
            <span className="font-mono text-[10px] text-muted">{knowledge.length} docs</span>
          </div>
          {knowledge.length === 0 ? (
            <p className="text-[10.5px] leading-relaxed text-subtle">
              Nenhum documento no workspace. A Keew já usa a base nativa (identidade, arquitetura, padrões).
            </p>
          ) : (
            <ul className="space-y-1">
              {knowledge.slice(0, 4).map((k) => (
                <li key={k.id} className="flex items-center gap-1.5 text-[10.5px] text-muted">
                  <span className="size-1 shrink-0 rounded-full bg-accent" />
                  <span className="truncate">{k.title}</span>
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => openSettings("conhecimento")}
            className="mt-2.5 flex w-full items-center justify-between rounded-[var(--r-sm)] border border-line px-2 py-1.5 text-[10.5px] text-muted transition-colors hover:border-accent-line hover:text-fg"
          >
            Gerenciar base
            <ChevronRight className="size-3" />
          </button>
        </section>

        {/* usage */}
        <section className="rounded-[var(--r-lg)] border border-line bg-elev/40 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-subtle">
            <Gauge className="size-3" /> Uso do workspace
          </div>
          <dl className="space-y-1.5 text-[11px]">
            <Row k="Respostas geradas" v={String(usage.messages)} />
            <Row k="Tokens (saída)" v={usage.tokensOut.toLocaleString("pt-BR")} mono />
            <Row k="Automações ativas" v={String(activeAutomations)} />
          </dl>
        </section>

        <div className="flex items-center justify-center gap-1.5 pb-2 pt-1 text-[9.5px] text-subtle">
          <Mark size={9} title="" />
          Keew IA v1.0 · núcleo próprio
        </div>
      </div>
    </aside>
  );
}

function Row({ k, v, tone, mono }: { k: string; v: string; tone?: "ok" | "warn"; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-subtle">{k}</dt>
      <dd
        className={`truncate text-right ${mono ? "font-mono text-[10px]" : ""} ${
          tone === "ok" ? "text-emerald-400" : tone === "warn" ? "text-amber-400" : "text-fg"
        }`}
        title={v}
      >
        {v}
      </dd>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[var(--r-sm)] border border-line bg-panel px-2 py-1.5">
      <div className="flex items-center gap-1 text-subtle [&_svg]:size-3">{icon}</div>
      <p className="mt-1 font-mono text-[13px] font-medium leading-none text-fg">{value}</p>
      <p className="mt-0.5 text-[9px] uppercase tracking-wide text-subtle">{label}</p>
    </div>
  );
}

export const CONTEXT_ICONS = { Trash2 };
