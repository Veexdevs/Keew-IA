"use client";

import { useEffect, useState } from "react";
import { Command, Menu, Moon, PanelRight, Plus, Sun } from "lucide-react";

import { useStore } from "@/lib/store";
import { THEME_MAP, type ThemeId } from "@/lib/themes";

type Engine = { ready: boolean; label: string; detail: string };

/**
 * Barra superior — só o necessário.
 *
 * Antes: breadcrumb de workspace, contador de mensagens, selo de plataforma,
 * status de saúde e cinco ícones. Agora: menu, título da conversa, e três
 * ações. O estado do motor fica visível como uma bolinha discreta.
 */
export function Topbar() {
  const { chats, currentChatId, sidebarOpen, setSidebarOpen, settings, setSettings, setCommandOpen, setContextOpen, contextOpen } =
    useStore();
  const chat = chats.find((c) => c.id === currentChatId) || chats[0];
  const [engine, setEngine] = useState<Engine | null>(null);

  const engineKey = settings.engineKey;

  useEffect(() => {
    let alive = true;
    const ping = () =>
      fetch("/api/engine", {
        cache: "no-store",
        headers: engineKey ? { "x-keew-engine-key": engineKey } : {},
      })
        .then((r) => r.json())
        .then((d) => alive && setEngine(d))
        .catch(() => alive && setEngine(null));
    void ping();
    const id = setInterval(ping, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [engineKey]);

  const theme = THEME_MAP[settings.theme as ThemeId] || THEME_MAP.onyx;
  const toggleMode = () => setSettings({ theme: theme.mode === "dark" ? "arctic" : "onyx" });

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-1.5 px-3 sm:px-4">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="grid size-9 place-items-center rounded-[var(--r-md)] text-muted transition-colors hover:bg-elev hover:text-fg"
        aria-label="Menu"
      >
        <Menu className="size-[18px]" />
      </button>

      <div className="flex min-w-0 items-center gap-2 pl-1">
        <span className="truncate text-[13.5px] font-medium text-fg">
          {chat?.title || "Nova conversa"}
        </span>
        {engine && (
          <span
            className="flex shrink-0 items-center gap-1.5"
            title={engine.ready ? "Motor de linguagem conectado" : engine.detail}
          >
            <span
              className={`size-1.5 rounded-full ${engine.ready ? "bg-emerald-500 pulse-dot text-emerald-500" : "bg-amber-500/70"}`}
            />
            <span className="hidden text-[11px] text-subtle sm:inline">
              {engine.ready ? "motor conectado" : "núcleo"}
            </span>
          </span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-0.5">
        <IconBtn label="Novo chat" onClick={() => useStore.getState().newChat()}>
          <Plus className="size-[18px]" />
        </IconBtn>
        <IconBtn label={theme.mode === "dark" ? "Tema claro" : "Tema escuro"} onClick={toggleMode}>
          {theme.mode === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </IconBtn>
        <IconBtn label="Comandos (⌘K)" onClick={() => setCommandOpen(true)} className="hidden sm:grid">
          <Command className="size-[18px]" />
        </IconBtn>
        <IconBtn label="Detalhes" onClick={() => setContextOpen(!contextOpen)} active={contextOpen}>
          <PanelRight className="size-[18px]" />
        </IconBtn>
      </div>
    </header>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  active,
  className = "",
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`grid size-9 place-items-center rounded-[var(--r-md)] transition-colors ${
        active ? "bg-elev text-fg" : "text-muted hover:bg-elev hover:text-fg"
      } ${className}`}
    >
      {children}
    </button>
  );
}
