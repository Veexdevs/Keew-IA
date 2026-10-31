"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen, Bot, Command as CommandIcon, CornerDownLeft, Download, Palette, Plus, Search,
  Settings2, Sparkles, Terminal, Trash2, Zap,
} from "lucide-react";

import { useStore } from "@/lib/store";

type Item = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ReactNode;
  run: () => void;
};

export function CommandPalette() {
  const {
    commandOpen, setCommandOpen, newChat, openSettings, agents, chats, selectChat,
    settings, setSettings, exportAll, pushToast,
  } = useStore();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (commandOpen) {
      setQ("");
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [commandOpen]);

  const items = useMemo<Item[]>(() => {
    const base: Item[] = [
      {
        id: "new", label: "Nova conversa", hint: "⌘J", group: "Ações",
        icon: <Plus className="size-3.5" />, run: () => { newChat(); setCommandOpen(false); },
      },
      {
        id: "theme", label: "Personalizar aparência", hint: "temas, fonte, densidade", group: "Ações",
        icon: <Palette className="size-3.5" />, run: () => { openSettings("aparencia"); setCommandOpen(false); },
      },
      {
        id: "model", label: "Configurar modelo / provedor", group: "Ações",
        icon: <Zap className="size-3.5" />, run: () => { openSettings("modelo"); setCommandOpen(false); },
      },
      {
        id: "knowledge", label: "Base de conhecimento", group: "Ações",
        icon: <BookOpen className="size-3.5" />, run: () => { openSettings("conhecimento"); setCommandOpen(false); },
      },
      {
        id: "agents", label: "Agentes", group: "Ações",
        icon: <Bot className="size-3.5" />, run: () => { openSettings("agentes"); setCommandOpen(false); },
      },
      {
        id: "automations", label: "Automações 24/7", group: "Ações",
        icon: <Sparkles className="size-3.5" />, run: () => { openSettings("automacoes"); setCommandOpen(false); },
      },
      {
        id: "apps", label: "Baixar app (APK · IPA · EXE)", group: "Ações",
        icon: <Download className="size-3.5" />, run: () => { openSettings("apps"); setCommandOpen(false); },
      },
      {
        id: "settings", label: "Abrir configurações", hint: "⌘,", group: "Ações",
        icon: <Settings2 className="size-3.5" />, run: () => { openSettings(); setCommandOpen(false); },
      },
      {
        id: "export", label: "Exportar todo o workspace", group: "Dados",
        icon: <Download className="size-3.5" />,
        run: () => {
          const blob = new Blob([exportAll()], { type: "application/json" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `keew-workspace-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(a.href);
          pushToast("Workspace exportado", "ok");
          setCommandOpen(false);
        },
      },
      {
        id: "density-compact", label: "Densidade compacta", group: "Aparência",
        icon: <Terminal className="size-3.5" />,
        run: () => { setSettings({ density: "compact" }); pushToast("Densidade compacta", "ok"); setCommandOpen(false); },
      },
      {
        id: "density-spacious", label: "Densidade espaçosa", group: "Aparência",
        icon: <Terminal className="size-3.5" />,
        run: () => { setSettings({ density: "spacious" }); pushToast("Densidade espaçosa", "ok"); setCommandOpen(false); },
      },
      {
        id: "light", label: settings.theme === "arctic" ? "Voltar ao tema escuro" : "Mudar para tema claro",
        group: "Aparência",
        icon: <Palette className="size-3.5" />,
        run: () => { setSettings({ theme: settings.theme === "arctic" ? "onyx" : "arctic" }); setCommandOpen(false); },
      },
    ];

    const agentItems: Item[] = agents.map((a) => ({
      id: `agent-${a.id}`,
      label: `Novo chat com ${a.name}`,
      hint: a.description,
      group: "Agentes",
      icon: <span className="text-[11px]" style={{ color: a.accent }}>{a.emoji}</span>,
      run: () => { newChat(a.id); setCommandOpen(false); },
    }));

    const chatItems: Item[] = chats.slice(0, 8).map((c) => ({
      id: `chat-${c.id}`,
      label: c.title,
      hint: `${c.messages.filter((m) => m.role === "user").length} mensagens`,
      group: "Conversas",
      icon: <Search className="size-3.5" />,
      run: () => { selectChat(c.id); setCommandOpen(false); },
    }));

    return [...base, ...agentItems, ...chatItems];
  }, [agents, chats, exportAll, newChat, openSettings, pushToast, selectChat, setCommandOpen, setSettings, settings.theme]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (i) => i.label.toLowerCase().includes(needle) || (i.hint || "").toLowerCase().includes(needle),
    );
  }, [items, q]);

  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of filtered) {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group)!.push(item);
    }
    return [...map.entries()];
  }, [filtered]);

  const flat = groups.flatMap(([, list]) => list);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!commandOpen) return;
      if (e.key === "Escape") { setCommandOpen(false); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, flat.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
      if (e.key === "Enter") { e.preventDefault(); flat[sel]?.run(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commandOpen, flat, sel, setCommandOpen]);

  if (!commandOpen) return null;

  let idx = -1;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]">
      <button
        aria-label="Fechar"
        className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
        onClick={() => setCommandOpen(false)}
      />
      <div className="anim-scale relative w-full max-w-[560px] overflow-hidden rounded-[var(--r-xl)] border border-line-strong bg-panel shadow-[0_40px_100px_-30px_rgba(0,0,0,0.9)]">
        <div className="flex items-center gap-2.5 border-b border-line px-3.5">
          <CommandIcon className="size-4 shrink-0 text-accent" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            placeholder="Buscar comandos, agentes ou conversas…"
            className="h-12 w-full bg-transparent text-[13px] text-fg placeholder:text-subtle focus:outline-none"
          />
          <span className="hidden shrink-0 items-center gap-1 rounded border border-line px-1.5 py-0.5 font-mono text-[9.5px] text-subtle sm:flex">
            esc
          </span>
        </div>

        <div className="scroll-thin max-h-[52vh] overflow-y-auto p-1.5">
          {groups.length === 0 && (
            <p className="px-3 py-6 text-center text-[12px] text-subtle">Nada encontrado para “{q}”.</p>
          )}
          {groups.map(([group, list]) => (
            <div key={group} className="mb-1">
              <p className="px-2 py-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-subtle">{group}</p>
              {list.map((item) => {
                idx += 1;
                const active = idx === sel;
                return (
                  <button
                    key={item.id}
                    onMouseEnter={() => setSel(idx)}
                    onClick={item.run}
                    className={`flex w-full items-center gap-2.5 rounded-[var(--r-sm)] px-2 py-2 text-left transition-colors ${
                      active ? "bg-elev text-fg" : "text-muted hover:bg-elev/60"
                    }`}
                  >
                    <span className={`grid size-6 place-items-center rounded-[5px] border border-line ${active ? "text-accent" : "text-subtle"}`}>
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px]">{item.label}</span>
                      {item.hint && <span className="block truncate text-[10.5px] text-subtle">{item.hint}</span>}
                    </span>
                    {active && <CornerDownLeft className="size-3.5 shrink-0 text-subtle" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-line px-3 py-1.5 text-[10px] text-subtle">
          <span className="flex items-center gap-1.5">
            <Trash2 className="size-2.5 opacity-0" />
            ↑↓ navegar · ↵ executar
          </span>
          <span className="font-mono">keew · palette</span>
        </div>
      </div>
    </div>
  );
}
