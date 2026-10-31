"use client";

import { useEffect } from "react";
import {
  BookOpen, Bot, Check, Download, Eye, HardDrive, KeyRound, Palette, Rocket, Settings2,
  SlidersHorizontal, Sparkles, X,
} from "lucide-react";

import { useStore } from "@/lib/store";

import { AgentsTab } from "./tabs/agents";
import { AppearanceTab } from "./tabs/appearance";
import { AppsTab } from "./tabs/apps";
import { AutomationsTab } from "./tabs/automations";
import { DataTab } from "./tabs/data";
import { KnowledgeTab } from "./tabs/knowledge";
import { SystemTab } from "./tabs/system";

const TABS = [
  { id: "aparencia", label: "Aparência", icon: Palette, group: "Workspace" },
  { id: "agentes", label: "Agentes", icon: Bot, group: "Workspace" },
  { id: "conhecimento", label: "Conhecimento", icon: BookOpen, group: "Inteligência" },
  { id: "automacoes", label: "Automações 24/7", icon: Sparkles, group: "Inteligência" },
  { id: "sistema", label: "Sistema", icon: SlidersHorizontal, group: "Conta & dados" },
  { id: "dados", label: "Dados", icon: HardDrive, group: "Conta & dados" },
  { id: "apps", label: "Apps", icon: Download, group: "Conta & dados" },
] as const;

export function SettingsDialog() {
  const { settingsOpen, settingsTab, openSettings, closeSettings } = useStore();

  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSettings();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen, closeSettings]);

  if (!settingsOpen) return null;

  const groups = [...new Set(TABS.map((t) => t.group))];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 sm:p-6">
      <button aria-label="Fechar" className="absolute inset-0 bg-black/65 backdrop-blur-[3px]" onClick={closeSettings} />

      <div className="anim-scale relative flex h-full w-full max-w-[980px] overflow-hidden border border-line-strong bg-bg shadow-[0_50px_120px_-40px_rgba(0,0,0,1)] sm:h-[85vh] sm:rounded-[var(--r-2xl)]">
        {/* nav */}
        <aside className="hidden w-[212px] shrink-0 flex-col border-r border-line bg-panel sm:flex">
          <div className="flex h-14 items-center gap-2 px-4">
            <Settings2 className="size-4 text-accent" />
            <span className="text-[12.5px] font-semibold text-fg">Configurações</span>
          </div>
          <nav className="scroll-thin flex-1 overflow-y-auto px-2 pb-3">
            {groups.map((group) => (
              <div key={group} className="mb-3">
                <p className="px-2 pb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-subtle">{group}</p>
                {TABS.filter((t) => t.group === group).map((tab) => {
                  const Icon = tab.icon;
                  const active = settingsTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => openSettings(tab.id)}
                      className={`flex w-full items-center gap-2 rounded-[var(--r-sm)] px-2 py-[7px] text-left text-[12px] transition-colors ${
                        active ? "bg-elev font-medium text-fg" : "text-muted hover:bg-elev/60 hover:text-fg"
                      }`}
                    >
                      <Icon className={`size-3.5 ${active ? "text-accent" : ""}`} />
                      {tab.label}
                      {active && <Check className="ml-auto size-3 text-accent" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="border-t border-line px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-subtle">Keew IA · v1.0.0</p>
            <p className="mt-0.5 text-[10px] text-subtle">modelo próprio · sempre online</p>
          </div>
        </aside>

        {/* mobile tabs */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:hidden">
            <span className="text-[13px] font-semibold text-fg">Configurações</span>
            <button onClick={closeSettings} className="rounded p-1.5 text-muted hover:bg-elev">
              <X className="size-4" />
            </button>
          </div>
          <div className="scroll-none flex gap-1 overflow-x-auto border-b border-line px-2 py-1.5 sm:hidden">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => openSettings(t.id)}
                className={`shrink-0 rounded-[var(--r-sm)] px-2 py-1 text-[11px] ${
                  settingsTab === t.id ? "bg-elev text-fg" : "text-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[720px] px-4 py-5 sm:px-7 sm:py-6">
              {settingsTab === "aparencia" && <AppearanceTab />}
              {settingsTab === "agentes" && <AgentsTab />}
              {settingsTab === "conhecimento" && <KnowledgeTab />}
              {settingsTab === "automacoes" && <AutomationsTab />}
              {settingsTab === "sistema" && <SystemTab />}
              {settingsTab === "dados" && <DataTab />}
              {settingsTab === "apps" && <AppsTab />}
              {(settingsTab === "conta" || settingsTab === "workspace" || settingsTab === "modelo") && <SystemTab />}
            </div>
          </div>
        </div>

        <button
          onClick={closeSettings}
          className="absolute right-3 top-3 hidden rounded-[var(--r-sm)] p-1.5 text-muted transition-colors hover:bg-elev hover:text-fg sm:block"
          aria-label="Fechar configurações"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

export const SETTINGS_ICONS = { Eye, KeyRound, Rocket };
