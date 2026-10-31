"use client";

import { Check, Moon, Palette, RotateCcw, Sparkles, Sun, Type, Waves } from "lucide-react";

import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store";
import {
  ACCENTS, BACKDROPS, FONTS, THEMES, type BackdropId, type DensityId, type FontId,
  type RadiusId, type ThemeId,
} from "@/lib/themes";

export function AppearanceTab() {
  const { settings, setSettings, resetSettings, pushToast } = useStore();

  const dark = THEMES.filter((t) => t.mode === "dark");
  const light = THEMES.filter((t) => t.mode === "light");

  return (
    <div className="space-y-7">
      <Header
        icon={<Palette className="size-4" />}
        title="Aparência"
        subtitle="14 temas completos, acento livre, três raios, três densidades e tipografia — tudo aplicado na hora."
        action={
          <button
            onClick={() => { resetSettings(); pushToast("Aparência restaurada ao padrão", "ok"); }}
            className="inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border border-line px-2 py-1 text-[11px] text-muted transition-colors hover:border-line-strong hover:text-fg"
          >
            <RotateCcw className="size-3" /> Restaurar
          </button>
        }
      />

      <Section title="Temas escuros" icon={<Moon className="size-3.5" />} hint={`${dark.length} disponíveis`}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {dark.map((t) => (
            <ThemeCard key={t.id} theme={t} active={settings.theme === t.id} onSelect={() => setSettings({ theme: t.id, accentOverride: null })} />
          ))}
        </div>
      </Section>

      <Section title="Temas claros" icon={<Sun className="size-3.5" />} hint={`${light.length} disponíveis`}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {light.map((t) => (
            <ThemeCard key={t.id} theme={t} active={settings.theme === t.id} onSelect={() => setSettings({ theme: t.id, accentOverride: null })} />
          ))}
        </div>
      </Section>

      <Section title="Cor de destaque" icon={<Sparkles className="size-3.5" />} hint={settings.accentOverride ? "personalizada" : "segue o tema"}>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSettings({ accentOverride: null })}
            className={`flex h-8 items-center gap-1.5 rounded-[var(--r-sm)] border px-2 text-[11px] transition-colors ${
              !settings.accentOverride ? "border-accent text-fg" : "border-line text-muted hover:border-line-strong"
            }`}
          >
            <span className="grid size-4 place-items-center rounded-full border border-dashed border-current">
              <span className="size-1.5 rounded-full bg-current" />
            </span>
            Do tema
          </button>
          {ACCENTS.map((a) => {
            const active = settings.accentOverride === a.hex;
            return (
              <button
                key={a.id}
                title={a.name}
                onClick={() => setSettings({ accentOverride: a.hex })}
                className={`group relative grid size-8 place-items-center rounded-[var(--r-sm)] border transition-all ${
                  active ? "border-fg scale-105" : "border-transparent hover:scale-105"
                }`}
              >
                <span className="size-5 rounded-full shadow-inner" style={{ background: a.hex }} />
                {active && <Check className="absolute size-3 text-white drop-shadow" />}
              </button>
            );
          })}
          <label className="ml-1 flex cursor-pointer items-center gap-1.5 rounded-[var(--r-sm)] border border-line px-2 py-1.5 text-[11px] text-muted transition-colors hover:border-line-strong hover:text-fg">
            <input
              type="color"
              value={settings.accentOverride || "#0b5cff"}
              onChange={(e) => setSettings({ accentOverride: e.target.value })}
              className="size-4 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            Custom
          </label>
        </div>
      </Section>

      <div className="grid gap-5 sm:grid-cols-2">
        <Section title="Cantos" icon={<Palette className="size-3.5" />}>
          <Segmented<RadiusId>
            value={settings.radius}
            onChange={(radius) => setSettings({ radius })}
            options={[
              { id: "sharp", label: "Reto" },
              { id: "soft", label: "Suave" },
              { id: "round", label: "Arredondado" },
            ]}
          />
          <div className="mt-3 flex gap-2">
            {(["sharp", "soft", "round"] as RadiusId[]).map((r) => (
              <div key={r} className="flex-1 text-center">
                <div
                  className={`mx-auto h-12 w-full border bg-elev ${
                    r === "sharp" ? "rounded-[3px]" : r === "soft" ? "rounded-[10px]" : "rounded-[18px]"
                  } ${settings.radius === r ? "border-accent" : "border-line"}`}
                />
                <span className="mt-1 block text-[9.5px] text-subtle">{r === "sharp" ? "reto" : r === "soft" ? "suave" : "redondo"}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Densidade" icon={<Waves className="size-3.5" />}>
          <Segmented<DensityId>
            value={settings.density}
            onChange={(density) => setSettings({ density })}
            options={[
              { id: "compact", label: "Compacta" },
              { id: "comfortable", label: "Média" },
              { id: "spacious", label: "Espaçosa" },
            ]}
          />
          <div className="mt-3 space-y-1.5">
            {([0, 1, 2] as const).map((i) => (
              <div
                key={i}
                className={`rounded-[var(--r-sm)] border border-line bg-elev ${
                  settings.density === "compact" ? "h-3" : settings.density === "comfortable" ? "h-5" : "h-7"
                }`}
              />
            ))}
          </div>
        </Section>
      </div>

      <Section title="Tipografia" icon={<Type className="size-3.5" />} hint={FONTS.find((f) => f.id === settings.font)?.note}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {FONTS.map((f) => (
            <button
              key={f.id}
              onClick={() => setSettings({ font: f.id })}
              className={`rounded-[var(--r-md)] border px-2.5 py-2 text-left transition-colors ${
                settings.font === f.id ? "border-accent bg-accent/5" : "border-line hover:border-line-strong"
              }`}
            >
              <span className="block text-[13px] font-medium text-fg" style={{ fontFamily: f.stack }}>
                {f.name}
              </span>
              <span className="block text-[10px] text-subtle" style={{ fontFamily: f.stack }}>
                Keew IA · 0123
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Fundo do chat" icon={<Sparkles className="size-3.5" />}>
        <div className="flex flex-wrap gap-1.5">
          {BACKDROPS.map((b) => (
            <button
              key={b.id}
              onClick={() => setSettings({ backdrop: b.id as BackdropId })}
              className={`rounded-[var(--r-sm)] border px-2.5 py-1.5 text-[11px] transition-colors ${
                settings.backdrop === b.id ? "border-accent bg-accent/5 text-fg" : "border-line text-muted hover:border-line-strong"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Interface">
        <div className="divide-y divide-line">
          <Switch label="Avatares nas mensagens" hint="Mostra o monograma do usuário e a marca Keew" checked={settings.showAvatars} onChange={(v) => setSettings({ showAvatars: v })} />
          <Switch label="Bolinhas compactas" hint="Reduz o espaço interno das mensagens" checked={settings.compactBubbles} onChange={(v) => setSettings({ compactBubbles: v })} />
          <Switch label="Mostrar raciocínio" hint="Exibe a trilha de pensamento do núcleo e do modelo" checked={settings.showReasoning} onChange={(v) => setSettings({ showReasoning: v })} />
          <Switch label="Quebrar linhas no código" hint="Ajusta blocos longos à largura da tela" checked={settings.codeWrap} onChange={(v) => setSettings({ codeWrap: v })} />
          <Switch label="Enter envia" hint="Desligado: ⌘+Enter envia e Enter quebra linha" checked={settings.sendOnEnter} onChange={(v) => setSettings({ sendOnEnter: v })} />
          <Switch label="Som ao concluir" hint="Um bipe curto quando a resposta termina" checked={settings.soundOnDone} onChange={(v) => setSettings({ soundOnDone: v })} />
        </div>
      </Section>
    </div>
  );
}

function ThemeCard({
  theme, active, onSelect,
}: {
  theme: (typeof THEMES)[number]; active: boolean; onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-[var(--r-md)] border p-0 text-left transition-all duration-200 ${
        active ? "border-accent ring-1 ring-accent/30" : "border-line hover:border-line-strong"
      }`}
    >
      {/* mini preview */}
      <div className="relative h-[62px] w-full" style={{ background: theme.swatch[0] }}>
        <div className="absolute inset-x-1.5 top-1.5 flex gap-1">
          <div className="h-8 w-1/4 rounded-[3px]" style={{ background: theme.swatch[1] }} />
          <div className="flex-1 space-y-1">
            <div className="h-1.5 w-3/4 rounded-full" style={{ background: theme.swatch[2], opacity: 0.85 }} />
            <div className="h-1.5 w-1/2 rounded-full" style={{ background: theme.swatch[1] }} />
            <div className="h-1.5 w-2/3 rounded-full" style={{ background: theme.swatch[1] }} />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-1 border-t border-line bg-panel px-2 py-1.5">
        <span className="min-w-0">
          <span className="block truncate text-[11.5px] font-medium text-fg">{theme.name}</span>
          <span className="block truncate text-[9.5px] text-subtle">{theme.hint}</span>
        </span>
        {active ? (
          <span className="grid size-3.5 shrink-0 place-items-center rounded-full bg-accent text-accent-fg">
            <Check className="size-2.5" strokeWidth={3} />
          </span>
        ) : (
          <span className="size-3.5 shrink-0 rounded-full border border-line-strong" />
        )}
      </div>
    </button>
  );
}

function Section({
  title, icon, hint, children,
}: {
  title: string; icon?: React.ReactNode; hint?: string; children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-1.5">
        {icon && <span className="text-accent">{icon}</span>}
        <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-fg">{title}</h3>
        {hint && <span className="ml-auto font-mono text-[9.5px] text-subtle">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Header({
  icon, title, subtitle, action,
}: {
  icon: React.ReactNode; title: string; subtitle: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
      <div>
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-fg">
          <span className="text-accent">{icon}</span>
          {title}
        </h2>
        <p className="mt-1 max-w-lg text-[11.5px] leading-relaxed text-muted">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export const APPEARANCE_HELPERS = { Header, Section, ThemeCard };
export type { ThemeId, FontId };
