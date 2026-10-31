"use client";

import { useState } from "react";
import { Bot, Check, Copy, Pencil, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { AGENT_TOOL_LABEL, BUILTIN_AGENTS } from "@/lib/agents";
import { uid, useStore } from "@/lib/store";
import type { Agent, AgentTool } from "@/lib/types";

const TOOLS: AgentTool[] = ["reasoning", "code", "search", "files", "math", "translate"];
const EMOJIS = ["◆", "⌘", "◎", "✎", "⌕", "◈", "✦", "▲", "☰", "⌬", "❖", "◉", "⬢", "✶"];
const COLORS = ["#0b5cff", "#22d3ee", "#a3e635", "#f59e0b", "#f472b6", "#8b5cf6", "#10b981", "#f43f5e"];

export function AgentsTab() {
  const { agents, upsertAgent, deleteAgent, resetAgents, pushToast, settings, setSettings } = useStore();
  const [editing, setEditing] = useState<Agent | null>(null);

  const create = () => {
    setEditing({
      id: uid("agent"),
      name: "Novo agente",
      emoji: "✦",
      description: "",
      systemPrompt: "Você é um agente da Keew IA. Responda em português do Brasil, com precisão e sem rodeios.",
      temperature: 0.7,
      tools: ["reasoning"],
      accent: COLORS[0],
    });
  };

  const duplicate = (a: Agent) => {
    setEditing({ ...a, id: uid("agent"), name: `${a.name} (cópia)`, builtin: false });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-fg">
            <Bot className="size-4 text-accent" /> Agentes
          </h2>
          <p className="mt-1 max-w-lg text-[11.5px] leading-relaxed text-muted">
            Cada agente tem prompt, temperatura e conjunto de ferramentas próprios. Agentes nativos são graváveis;
            clones são totalmente editáveis.
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button onClick={create} className="inline-flex items-center gap-1.5 rounded-[var(--r-sm)] bg-accent px-2 py-1.5 text-[11px] font-medium text-accent-fg hover:brightness-110">
            <Plus className="size-3" /> Novo
          </button>
          <button
            onClick={() => { resetAgents(); pushToast("Agentes restaurados", "ok"); }}
            className="rounded-[var(--r-sm)] border border-line p-1.5 text-muted hover:text-fg"
            title="Restaurar nativos"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-subtle">Agente padrão em novas conversas</p>
        <div className="flex flex-wrap gap-1.5">
          {agents.map((a) => (
            <button
              key={a.id}
              onClick={() => setSettings({ defaultAgentId: a.id })}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                settings.defaultAgentId === a.id ? "border-accent bg-accent/8 text-fg" : "border-line text-muted hover:border-line-strong"
              }`}
            >
              <span style={{ color: a.accent }}>{a.emoji}</span> {a.name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {agents.map((a) => (
          <div key={a.id} className="group flex items-start gap-3 rounded-[var(--r-lg)] border border-line bg-panel/50 p-3 transition-colors hover:border-line-strong">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-[var(--r-sm)] text-[15px]"
              style={{ background: `color-mix(in srgb, ${a.accent || "var(--accent)"} 15%, transparent)`, color: a.accent }}
            >
              {a.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-[12.5px] font-medium text-fg">{a.name}</p>
                {a.builtin && (
                  <span className="rounded-[3px] border border-line bg-elev px-1 py-0.5 font-mono text-[8.5px] uppercase text-subtle">nativo</span>
                )}
                <span className="font-mono text-[9.5px] text-subtle">T {a.temperature.toFixed(1)}</span>
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{a.description}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {a.tools.map((t) => (
                  <span key={t} className="rounded-[3px] bg-elev px-1.5 py-0.5 text-[9px] text-subtle">{AGENT_TOOL_LABEL[t]}</span>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
              <button onClick={() => setEditing(a)} className="rounded p-1.5 text-subtle hover:bg-elev hover:text-fg" title="Editar">
                <Pencil className="size-3.5" />
              </button>
              <button onClick={() => duplicate(a)} className="rounded p-1.5 text-subtle hover:bg-elev hover:text-fg" title="Clonar">
                <Copy className="size-3.5" />
              </button>
              {!a.builtin && (
                <button
                  onClick={() => { deleteAgent(a.id); pushToast("Agente removido", "ok"); }}
                  className="rounded p-1.5 text-subtle hover:bg-rose-500/10 hover:text-rose-400"
                  title="Excluir"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <AgentEditor
          agent={editing}
          onClose={() => setEditing(null)}
          onSave={(a) => {
            upsertAgent(a);
            setEditing(null);
            pushToast(`Agente "${a.name}" salvo`, "ok");
          }}
        />
      )}

      <p className="text-[10.5px] leading-relaxed text-subtle">
        Dica: agentes nativos da Keew são <span className="text-muted">{BUILTIN_AGENTS.length}</span> — Core, Engenheiro,
        Analista, Redator, Pesquisador e Tutor. Clone um deles para criar o seu sem perder o original.
      </p>
    </div>
  );
}

function AgentEditor({ agent, onClose, onSave }: { agent: Agent; onClose: () => void; onSave: (a: Agent) => void }) {
  const [draft, setDraft] = useState<Agent>(agent);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3">
      <button aria-label="Fechar" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="anim-scale relative flex max-h-[88vh] w-full max-w-[640px] flex-col overflow-hidden rounded-[var(--r-xl)] border border-line-strong bg-bg shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-[13px] font-semibold text-fg">{agent.name ? "Editar agente" : "Novo agente"}</h3>
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-elev hover:text-fg">
            <X className="size-4" />
          </button>
        </div>

        <div className="scroll-thin flex-1 space-y-3.5 overflow-y-auto p-4">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <label className="block">
              <span className="mb-1 block text-[10.5px] font-medium text-muted">Nome</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="h-9 w-full rounded-[var(--r-sm)] border border-line bg-panel px-2.5 text-[12px] text-fg focus:border-accent focus:outline-none"
              />
            </label>
            <div>
              <span className="mb-1 block text-[10.5px] font-medium text-muted">Ícone</span>
              <div className="flex h-9 items-center gap-0.5 rounded-[var(--r-sm)] border border-line bg-panel px-1">
                {EMOJIS.slice(0, 6).map((e) => (
                  <button
                    key={e}
                    onClick={() => setDraft({ ...draft, emoji: e })}
                    className={`grid size-6 place-items-center rounded text-[12px] ${draft.emoji === e ? "bg-elev text-fg" : "text-subtle"}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-[10.5px] font-medium text-muted">Descrição</span>
            <input
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Para que serve este agente"
              className="h-9 w-full rounded-[var(--r-sm)] border border-line bg-panel px-2.5 text-[12px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 flex items-center justify-between text-[10.5px] font-medium text-muted">
              Prompt de sistema
              <span className="font-mono text-[9px] text-subtle">{draft.systemPrompt.length} chars</span>
            </span>
            <textarea
              value={draft.systemPrompt}
              onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })}
              rows={9}
              className="w-full resize-y rounded-[var(--r-sm)] border border-line bg-panel px-2.5 py-2 font-mono text-[11px] leading-relaxed text-fg focus:border-accent focus:outline-none"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 flex items-center justify-between text-[10.5px] font-medium text-muted">
                Temperatura <span className="font-mono text-[10px] text-fg">{draft.temperature.toFixed(2)}</span>
              </span>
              <input
                type="range"
                min={0}
                max={1.2}
                step={0.05}
                value={draft.temperature}
                onChange={(e) => setDraft({ ...draft, temperature: Number(e.target.value) })}
                className="w-full accent-[var(--accent)]"
              />
            </label>
            <div>
              <span className="mb-1 block text-[10.5px] font-medium text-muted">Cor</span>
              <div className="flex gap-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setDraft({ ...draft, accent: c })}
                    className={`size-6 rounded-full ${draft.accent === c ? "ring-2 ring-fg ring-offset-2 ring-offset-bg" : ""}`}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <span className="mb-1 block text-[10.5px] font-medium text-muted">Ferramentas</span>
            <div className="grid grid-cols-2 gap-1">
              {TOOLS.map((t) => {
                const on = draft.tools.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        tools: on ? draft.tools.filter((x) => x !== t) : [...draft.tools, t],
                      })
                    }
                    className={`flex items-center gap-1.5 rounded-[var(--r-sm)] border px-2 py-1.5 text-left text-[11px] transition-colors ${
                      on ? "border-accent/50 bg-accent/8 text-fg" : "border-line text-muted"
                    }`}
                  >
                    <span className={`grid size-3.5 place-items-center rounded-sm border ${on ? "border-accent bg-accent text-accent-fg" : "border-line-strong"}`}>
                      {on && <Check className="size-2.5" strokeWidth={4} />}
                    </span>
                    {AGENT_TOOL_LABEL[t]}
                  </button>
                );
              })}
            </div>
          </div>

          <Switch
            label="Definir como agente padrão"
            checked={false}
            onChange={(v) => v && undefined}
            disabled
            hint="Configure na lista de agentes, acima."
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <button onClick={onClose} className="rounded-[var(--r-sm)] border border-line px-3 py-1.5 text-[11.5px] text-muted hover:text-fg">
            Cancelar
          </button>
          <button
            onClick={() => onSave(draft)}
            className="inline-flex items-center gap-1.5 rounded-[var(--r-sm)] bg-accent px-3 py-1.5 text-[11.5px] font-medium text-accent-fg hover:brightness-110"
          >
            <Save className="size-3.5" /> Salvar agente
          </button>
        </div>
      </div>
    </div>
  );
}
