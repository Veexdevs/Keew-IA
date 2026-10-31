"use client";

import { useState } from "react";
import { Clock, Info, Play, Plus, Sparkles, Trash2, X, Zap } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { uid, useStore } from "@/lib/store";
import type { Automation } from "@/lib/types";

const PRESETS: Omit<Automation, "id" | "enabled">[] = [
  {
    name: "Resumo diário do produto",
    schedule: "0 11 * * *",
    prompt:
      "Gere o briefing diário da Keew IA: 3 destaques, 1 risco, 1 ação para hoje. Seja específico e curto.",
    agentId: "analista",
  },
  {
    name: "Vigia de erros",
    schedule: "*/30 * * * *",
    prompt:
      "Analise riscos operacionais típicos de um app Next.js em produção (cold start, rate limit, timeout de provedor) e proponha uma mitigação para cada.",
    agentId: "engenheiro",
  },
  {
    name: "Revisão semanal de marca",
    schedule: "0 13 * * 1",
    prompt:
      "Revise a consistência da identidade Keew IA: tom de voz, vocabulário, promessas. Liste ajustes concretos.",
    agentId: "redator",
  },
];

export function AutomationsTab() {
  const { automations, upsertAutomation, deleteAutomation, toggleAutomation, runAutomation, agents, pushToast } = useStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Automation>({
    id: uid("auto"),
    name: "",
    schedule: "0 11 * * *",
    prompt: "",
    agentId: "keew-core",
    enabled: true,
  });

  const add = (preset?: Omit<Automation, "id" | "enabled">) => {
    const base = preset
      ? { ...preset, id: uid("auto"), enabled: true }
      : { ...draft, id: uid("auto") };
    if (!base.name.trim() || !base.prompt.trim()) {
      pushToast("Nome e instrução são obrigatórios", "error");
      return;
    }
    upsertAutomation(base);
    pushToast("Automação criada", "ok");
    setOpen(false);
    setDraft({ ...draft, id: uid("auto"), name: "", prompt: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-fg">
            <Sparkles className="size-4 text-accent" /> Automações 24/7
          </h2>
          <p className="mt-1 max-w-lg text-[11.5px] leading-relaxed text-muted">
            Agentes que rodam sozinhos, sem sua ajuda: o cron da Vercel (a cada 10 min) e o GitHub Actions chamam
            <code className="mx-1 rounded bg-elev px-1 font-mono text-[10px]">/api/automations/run</code>
            e executam o que estiver vencido.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--r-sm)] bg-accent px-2 py-1.5 text-[11px] font-medium text-accent-fg hover:brightness-110"
        >
          <Plus className="size-3" /> Nova
        </button>
      </div>

      <div className="flex items-start gap-2 rounded-[var(--r-md)] border border-accent-line bg-accent/5 px-3 py-2 text-[10.5px] leading-relaxed text-muted">
        <Info className="mt-0.5 size-3.5 shrink-0 text-accent" />
        <span>
          O agendamento real acontece no servidor (Supabase + cron). Aqui você define o que roda; o botão{" "}
          <span className="text-fg">Executar agora</span> dispara o agente imediatamente neste workspace.
        </span>
      </div>

      {open && (
        <div className="anim-scale space-y-2.5 rounded-[var(--r-lg)] border border-accent-line bg-panel/60 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11.5px] font-medium text-fg">Nova automação</p>
            <button onClick={() => setOpen(false)} className="rounded p-1 text-subtle hover:text-fg">
              <X className="size-3.5" />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_130px]">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Nome da automação"
              className="h-9 rounded-[var(--r-sm)] border border-line bg-bg px-2.5 text-[12px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
            <input
              value={draft.schedule}
              onChange={(e) => setDraft({ ...draft, schedule: e.target.value })}
              placeholder="0 11 * * *"
              className="h-9 rounded-[var(--r-sm)] border border-line bg-bg px-2.5 font-mono text-[11px] text-fg focus:border-accent focus:outline-none"
            />
          </div>
          <textarea
            value={draft.prompt}
            onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
            rows={4}
            placeholder="Instrução executada sem supervisão…"
            className="w-full resize-y rounded-[var(--r-sm)] border border-line bg-bg px-2.5 py-2 text-[11.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          <select
            value={draft.agentId}
            onChange={(e) => setDraft({ ...draft, agentId: e.target.value })}
            className="h-9 w-full rounded-[var(--r-sm)] border border-line bg-bg px-2 text-[11.5px] text-fg focus:border-accent focus:outline-none"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.emoji} {a.name}
              </option>
            ))}
          </select>
          <div className="flex justify-end">
            <button onClick={() => add()} className="rounded-[var(--r-sm)] bg-accent px-3 py-1.5 text-[11.5px] font-medium text-accent-fg hover:brightness-110">
              Criar automação
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {automations.length === 0 && (
          <p className="rounded-[var(--r-md)] border border-dashed border-line px-3 py-5 text-center text-[11.5px] text-subtle">
            Nenhuma automação ainda. Comece com um modelo:
          </p>
        )}
        {automations.map((a) => (
          <div key={a.id} className="flex items-start gap-2.5 rounded-[var(--r-md)] border border-line bg-panel/50 p-3">
            <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-[5px] ${a.enabled ? "bg-accent/10 text-accent" : "bg-elev text-subtle"}`}>
              <Zap className="size-3" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[12px] font-medium text-fg">{a.name}</p>
                <span className="flex shrink-0 items-center gap-1 rounded bg-elev px-1 py-0.5 font-mono text-[9px] text-subtle">
                  <Clock className="size-2.5" /> {a.schedule}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-relaxed text-muted">{a.prompt}</p>
              <div className="mt-1 flex items-center gap-2">
                <button
                  onClick={() => void runAutomation(a.id)}
                  className="inline-flex items-center gap-1 rounded-[var(--r-sm)] border border-line px-1.5 py-0.5 text-[9.5px] text-muted hover:border-accent-line hover:text-fg"
                >
                  <Play className="size-2.5" /> Executar agora
                </button>
                {a.lastRunAt && (
                  <span className="font-mono text-[9px] text-subtle">
                    último: {new Date(a.lastRunAt).toLocaleString("pt-BR")}
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Switch checked={a.enabled} onChange={() => toggleAutomation(a.id)} />
              <button
                onClick={() => { deleteAutomation(a.id); pushToast("Automação removida", "ok"); }}
                className="rounded p-1 text-subtle hover:bg-rose-500/10 hover:text-rose-400"
                aria-label="Excluir automação"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-subtle">Começar com um modelo</p>
        <div className="grid gap-1.5 sm:grid-cols-3">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => add(p)}
              className="rounded-[var(--r-md)] border border-line bg-panel/40 p-2.5 text-left transition-colors hover:border-accent-line hover:bg-panel"
            >
              <p className="text-[11px] font-medium text-fg">{p.name}</p>
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-subtle">{p.prompt}</p>
              <span className="mt-1 inline-block font-mono text-[9px] text-accent">{p.schedule}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
