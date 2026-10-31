"use client";

import { useMemo, useState } from "react";
import {
  Check, ChevronsUpDown, Command, Download, MoreHorizontal, Pencil, Pin, PinOff,
  Plus, Search, Settings2, Trash2, X,
} from "lucide-react";

import { Wordmark } from "@/components/ui/mark";
import { isSupabaseReady } from "@/lib/flags";
import { useStore } from "@/lib/store";

function groupLabel(ts: number): string {
  const day = 86_400_000;
  const now = Date.now();
  if (now - ts < day) return "Hoje";
  if (now - ts < day * 2) return "Ontem";
  if (now - ts < day * 7) return "Últimos 7 dias";
  if (now - ts < day * 30) return "Últimos 30 dias";
  return new Date(ts).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function Sidebar() {
  const {
    chats, currentChatId, agents, settings, sidebarOpen,
    newChat, selectChat, deleteChat, renameChat, togglePin, setSidebarOpen,
    openSettings, setCommandOpen, pushToast,
  } = useStore();

  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const current = chats.find((c) => c.id === currentChatId) || chats[0];
  const agent = agents.find((a) => a.id === current?.agentId) || agents[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q)),
    );
  }, [chats, query]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof chats>();
    const sorted = [...filtered].sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return Number(!!b.pinned) - Number(!!a.pinned);
      return b.updatedAt - a.updatedAt;
    });
    for (const chat of sorted) {
      const key = chat.pinned ? "Fixados" : groupLabel(chat.updatedAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(chat);
    }
    return [...map.entries()];
  }, [filtered]);

  const commitRename = (id: string) => {
    if (draft.trim()) renameChat(id, draft);
    setRenaming(null);
    setDraft("");
  };

  return (
    <>
      {sidebarOpen && (
        <button
          aria-label="Fechar menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[272px] shrink-0 flex-col border-r border-line bg-panel transition-transform duration-300 ease-[cubic-bezier(0.22,0.8,0.28,1)] lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:hidden"
        }`}
      >
        {/* header */}
        <div className="flex h-14 items-center justify-between px-3">
          <button
            onClick={() => {
              newChat();
              if (window.innerWidth < 1024) setSidebarOpen(false);
            }}
            className="rounded-[var(--r-sm)] p-1 transition-opacity hover:opacity-80"
            title="Keew IA"
          >
            <Wordmark showVersion />
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-[var(--r-sm)] p-1.5 text-muted transition-colors hover:bg-elev hover:text-fg lg:hidden"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* new chat + search */}
        <div className="space-y-1.5 px-2.5 pb-2">
          <button
            onClick={() => {
              newChat();
              if (window.innerWidth < 1024) setSidebarOpen(false);
            }}
            className="group flex w-full items-center gap-2 rounded-[var(--r-md)] bg-accent px-2.5 py-2 text-[12.5px] font-medium text-accent-fg shadow-[0_6px_20px_-10px_rgb(var(--glow)/0.9)] transition-all hover:brightness-110 active:scale-[0.99]"
          >
            <Plus className="size-4" strokeWidth={2.2} />
            <span>Nova conversa</span>
            <span className="ml-auto rounded border border-white/25 px-1 py-0.5 font-mono text-[9.5px] opacity-80">
              ⌘K
            </span>
          </button>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar conversas"
              className="h-8 w-full rounded-[var(--r-sm)] border border-transparent bg-elev/60 pl-8 pr-2 text-[12px] text-fg placeholder:text-subtle transition-colors focus:border-line-strong focus:bg-panel focus:outline-none"
            />
          </div>
        </div>

        {/* history */}
        <nav className="scroll-thin flex-1 overflow-y-auto px-2 pb-2">
          {groups.length === 0 && (
            <p className="px-2 py-6 text-center text-[11.5px] leading-relaxed text-subtle">
              Nenhuma conversa encontrada.
              <br />
              Comece uma nova ou limpe a busca.
            </p>
          )}

          {groups.map(([label, items]) => (
            <div key={label} className="mb-1">
              <p className="px-2 pb-1 pt-2 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-subtle">
                {label}
              </p>
              <ul className="space-y-px">
                {items.map((chat) => {
                  const active = chat.id === current?.id;
                  const isRenaming = renaming === chat.id;
                  const chatAgent = agents.find((a) => a.id === chat.agentId);
                  return (
                    <li key={chat.id} className="group/row relative">
                      {isRenaming ? (
                        <div className="flex items-center gap-1 px-1.5 py-1">
                          <input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={() => commitRename(chat.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename(chat.id);
                              if (e.key === "Escape") setRenaming(null);
                            }}
                            className="h-7 w-full rounded-[var(--r-xs)] border border-accent bg-panel px-2 text-[12px] text-fg outline-none"
                          />
                          <button onClick={() => commitRename(chat.id)} className="rounded p-1 text-accent hover:bg-elev">
                            <Check className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => selectChat(chat.id)}
                          className={`flex w-full items-center gap-2 rounded-[var(--r-sm)] py-[7px] pl-2 pr-7 text-left text-[12.5px] transition-colors ${
                            active
                              ? "bg-elev text-fg"
                              : "text-muted hover:bg-elev/60 hover:text-fg"
                          }`}
                        >
                          <span
                            className={`grid size-[18px] shrink-0 place-items-center rounded-[5px] text-[9px] ${
                              active ? "bg-accent/15 text-accent" : "bg-elev text-subtle group-hover/row:text-muted"
                            }`}
                          >
                            {chat.pinned ? <Pin className="size-2.5" /> : chatAgent?.emoji || "◆"}
                          </span>
                          <span className="truncate">{chat.title}</span>
                          {chat.messages.length > 0 && (
                            <span className="ml-auto shrink-0 font-mono text-[9.5px] text-subtle">
                              {chat.messages.filter((m) => m.role === "user").length}
                            </span>
                          )}
                        </button>
                      )}

                      {!isRenaming && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuFor(menuFor === chat.id ? null : chat.id);
                          }}
                          className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-subtle opacity-0 transition-all hover:bg-panel hover:text-fg focus:opacity-100 group-hover/row:opacity-100"
                          aria-label="Opções da conversa"
                        >
                          <MoreHorizontal className="size-3.5" />
                        </button>
                      )}

                      {menuFor === chat.id && (
                        <>
                          <button className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuFor(null)} aria-hidden />
                          <div className="anim-scale absolute right-1 top-8 z-50 w-44 overflow-hidden rounded-[var(--r-md)] border border-line bg-panel p-1 shadow-2xl">
                            <MenuItem
                              icon={<Pencil className="size-3.5" />}
                              label="Renomear"
                              onClick={() => {
                                setDraft(chat.title);
                                setRenaming(chat.id);
                                setMenuFor(null);
                              }}
                            />
                            <MenuItem
                              icon={chat.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                              label={chat.pinned ? "Desafixar" : "Fixar no topo"}
                              onClick={() => {
                                togglePin(chat.id);
                                setMenuFor(null);
                              }}
                            />
                            <MenuItem
                              icon={<Download className="size-3.5" />}
                              label="Exportar .md"
                              onClick={() => {
                                const md = chat.messages
                                  .map((m) => `## ${m.role === "user" ? "Você" : "Keew IA"}\n\n${m.content}`)
                                  .join("\n\n---\n\n");
                                const blob = new Blob([`# ${chat.title}\n\n${md}`], { type: "text/markdown" });
                                const a = document.createElement("a");
                                a.href = URL.createObjectURL(blob);
                                a.download = `${chat.title.replace(/[^\w\s-]/g, "").slice(0, 60) || "keew"}.md`;
                                a.click();
                                URL.revokeObjectURL(a.href);
                                setMenuFor(null);
                                pushToast("Conversa exportada em Markdown", "ok");
                              }}
                            />
                            <div className="my-1 h-px bg-line" />
                            <MenuItem
                              icon={<Trash2 className="size-3.5" />}
                              label="Excluir"
                              danger
                              onClick={() => {
                                deleteChat(chat.id);
                                setMenuFor(null);
                                pushToast("Conversa excluída", "ok");
                              }}
                            />
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* footer — agent switcher + account */}
        <div className="space-y-1 border-t border-line p-2">
          <button
            onClick={() => openSettings("agentes")}
            className="flex w-full items-center gap-2 rounded-[var(--r-sm)] px-2 py-1.5 text-left transition-colors hover:bg-elev"
          >
            <span
              className="grid size-6 shrink-0 place-items-center rounded-[6px] text-[11px]"
              style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)", color: agent?.accent || "var(--accent)" }}
            >
              {agent?.emoji || "◆"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium text-fg">{agent?.name}</span>
              <span className="block truncate text-[10px] text-subtle">Agente ativo · trocar</span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-subtle" />
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={() => openSettings("conta")}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--r-sm)] px-2 py-1.5 text-left transition-colors hover:bg-elev"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full border border-line-strong bg-elev text-[10px] font-semibold uppercase text-fg">
                {(settings.userNickname || "V").slice(0, 1)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11.5px] font-medium text-fg">{settings.userNickname || "Workspace"}</span>
                <span className="flex items-center gap-1 text-[9.5px] text-subtle">
                  <span className="size-1 rounded-full bg-emerald-500" />
                  {isSupabaseReady() ? "sincronizado" : "local"}
                </span>
              </span>
            </button>
            <button
              onClick={() => setCommandOpen(true)}
              className="rounded-[var(--r-sm)] p-1.5 text-muted transition-colors hover:bg-elev hover:text-fg"
              title="Comandos"
            >
              <Command className="size-4" />
            </button>
            <button
              onClick={() => openSettings("aparencia")}
              className="rounded-[var(--r-sm)] p-1.5 text-muted transition-colors hover:bg-elev hover:text-fg"
              title="Configurações"
            >
              <Settings2 className="size-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function MenuItem({
  icon, label, onClick, danger,
}: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-[var(--r-sm)] px-2 py-1.5 text-left text-[12px] transition-colors ${
        danger ? "text-rose-400 hover:bg-rose-500/10" : "text-muted hover:bg-elev hover:text-fg"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
