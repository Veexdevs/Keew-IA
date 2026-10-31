"use client";

import { useEffect, useState } from "react";
import {
  BookOpen, Check, ChevronRight, Command, Menu, Monitor, Moon, PanelRight, Plus, Smartphone, Sun, Zap,
} from "lucide-react";

import { useStore } from "@/lib/store";
import { THEME_MAP, type ThemeId } from "@/lib/themes";

type Health = {
  ok: boolean;
  model: string;
  provider: string;
  configured: boolean;
  uptimeSec: number;
  region?: string;
};

export function Topbar() {
  const {
    chats, currentChatId, sidebarOpen, setSidebarOpen, settings, setSettings,
    setCommandOpen, setContextOpen, contextOpen, openSettings,
  } = useStore();
  const chat = chats.find((c) => c.id === currentChatId) || chats[0];
  const [health, setHealth] = useState<Health | null>(null);
  const [platform, setPlatform] = useState("web");

  useEffect(() => {
    let alive = true;
    const ping = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const data = await res.json();
        if (alive) setHealth(data);
      } catch {
        if (alive) setHealth(null);
      }
    };
    void ping();
    const id = setInterval(ping, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    void import("@/lib/flags").then((m) => setPlatform(m.platform()));
  }, []);

  const theme = THEME_MAP[settings.theme as ThemeId] || THEME_MAP.onyx;
  const toggleMode = () => {
    const next = theme.mode === "dark" ? "arctic" : "onyx";
    setSettings({ theme: next });
  };

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-bg/85 px-3 backdrop-blur-xl">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="rounded-[var(--r-sm)] p-1.5 text-muted transition-colors hover:bg-elev hover:text-fg"
        aria-label="Alternar menu"
      >
        <Menu className="size-4" />
      </button>

      {/* breadcrumb */}
      <div className="flex min-w-0 items-center gap-1.5 text-[12px]">
        <button
          onClick={() => openSettings("workspace")}
          className="hidden shrink-0 items-center gap-1.5 text-subtle transition-colors hover:text-fg sm:flex"
          title="Workspace"
        >
          <span className="grid size-4 place-items-center rounded-[3px] border border-line bg-elev font-mono text-[8px] text-accent">
            K
          </span>
          Workspace
        </button>
        <ChevronRight className="hidden size-3 shrink-0 text-subtle sm:block" />
        <span className="truncate font-medium text-fg">{chat?.title || "Nova conversa"}</span>
        <span className="hidden shrink-0 items-center gap-1 rounded-[3px] border border-line bg-elev px-1 py-0.5 font-mono text-[9px] uppercase text-subtle md:flex">
          {chat?.messages.length || 0} msg
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        {/* live status */}
        <button
          onClick={() => openSettings("sistema")}
          className="hidden items-center gap-1.5 rounded-full border border-line bg-panel px-2 py-1 text-[10.5px] transition-colors hover:border-line-strong sm:flex"
          title={health?.configured ? "Gateway conectado" : "Núcleo local ativo — configure um provedor para o modelo grande"}
        >
          <span
            className={`size-1.5 rounded-full ${
              health?.configured ? "bg-emerald-500" : health ? "bg-amber-500" : "bg-rose-500"
            } ${health?.configured ? "pulse-dot" : ""} ${health?.configured ? "text-emerald-500" : ""}`}
          />
          <span className="font-medium text-fg">
            {health?.configured ? "24/7 online" : health ? "local ativo" : "offline"}
          </span>
          <span className="hidden font-mono text-[9.5px] text-subtle lg:inline">
            {health?.configured ? health.model?.slice(0, 18) : "KRL"}
          </span>
        </button>

        <span className="hidden items-center gap-1 rounded-[var(--r-sm)] border border-line px-1.5 py-1 font-mono text-[9.5px] uppercase text-subtle lg:flex">
          {platform === "web" ? <Monitor className="size-3" /> : <Smartphone className="size-3" />}
          {platform}
        </span>

        <IconBtn label="Novo chat" onClick={() => useStore.getState().newChat()}>
          <Plus className="size-4" />
        </IconBtn>
        <IconBtn label={theme.mode === "dark" ? "Tema claro" : "Tema escuro"} onClick={toggleMode}>
          {theme.mode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </IconBtn>
        <IconBtn label="Base de conhecimento" onClick={() => openSettings("conhecimento")}>
          <BookOpen className="size-4" />
        </IconBtn>
        <IconBtn label="Comandos (⌘K)" onClick={() => setCommandOpen(true)} className="hidden sm:grid">
          <Command className="size-4" />
        </IconBtn>
        <IconBtn
          label="Painel de contexto"
          onClick={() => setContextOpen(!contextOpen)}
          active={contextOpen}
        >
          <PanelRight className="size-4" />
        </IconBtn>
      </div>
    </header>
  );
}

function IconBtn({
  children, label, onClick, active, className = "",
}: {
  children: React.ReactNode; label: string; onClick: () => void; active?: boolean; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`grid size-8 place-items-center rounded-[var(--r-sm)] transition-colors ${
        active ? "bg-elev text-fg" : "text-muted hover:bg-elev hover:text-fg"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export const TOPBAR_ICONS = { Check, Zap };
