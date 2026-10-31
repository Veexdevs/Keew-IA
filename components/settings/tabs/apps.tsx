"use client";

import {
  Apple, Check, ChevronRight, Download, ExternalLink, Globe, MonitorDown, Smartphone, Terminal,
} from "lucide-react";

import { platform } from "@/lib/flags";
import { useStore } from "@/lib/store";

const TARGETS = [
  {
    id: "web",
    name: "Web / PWA",
    icon: Globe,
    tag: "disponível agora",
    desc: "Abra no navegador e instale como app — funciona offline para o núcleo local.",
    steps: ["Abra o site no Chrome/Safari", "Menu → Instalar aplicativo / Adicionar à tela de início"],
    command: null,
  },
  {
    id: "android",
    name: "APK · Android",
    icon: Smartphone,
    tag: "Capacitor",
    desc: "Shell nativo com WebView, notificações e armazenamento local.",
    steps: ["npm run mobile:sync", "npm run mobile:android", "npx cap build android --keystore …"],
    command: "cd apps/mobile && npx cap add android",
  },
  {
    id: "ios",
    name: "IPA · iOS",
    icon: Apple,
    tag: "Capacitor",
    desc: "Projeto Xcode gerado — assine com sua conta de desenvolvedor e arquive.",
    steps: ["npm run mobile:sync", "npm run mobile:ios", "Product → Archive no Xcode"],
    command: "cd apps/mobile && npx cap add ios",
  },
  {
    id: "windows",
    name: "EXE · Windows",
    icon: MonitorDown,
    tag: "Electron",
    desc: "Instalador NSIS + portátil, ícone e assinatura opcional.",
    steps: ["npm --prefix apps/desktop install", "npm run desktop:win"],
    command: "npm run desktop:win",
  },
  {
    id: "macos",
    name: "DMG · macOS",
    icon: Apple,
    tag: "Electron",
    desc: "Universal (arm64 + x64), hardened runtime.",
    steps: ["npm --prefix apps/desktop install", "npm run desktop:mac"],
    command: "npm run desktop:mac",
  },
  {
    id: "linux",
    name: "AppImage · Linux",
    icon: Terminal,
    tag: "Electron",
    desc: "AppImage e .deb prontos para distribuir.",
    steps: ["npm --prefix apps/desktop install", "npm run desktop:linux"],
    command: "npm run desktop:linux",
  },
] as const;

export function AppsTab() {
  const pushToast = useStore((s) => s.pushToast);
  const here = platform();

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    pushToast("Comando copiado", "ok");
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-line pb-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-fg">
          <Download className="size-4 text-accent" /> Apps & distribuição
        </h2>
        <p className="mt-1 max-w-lg text-[11.5px] leading-relaxed text-muted">
          A mesma base de código gera web, APK, IPA, EXE, DMG e AppImage. Os ícones e splash screens já estão no
          repositório, gerados a partir da arte oficial.
        </p>
      </div>

      <div className="rounded-[var(--r-lg)] border border-line bg-panel/50 p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-fg">
          <Globe className="size-3.5 text-accent" /> Você está no{" "}
          <span className="rounded bg-elev px-1 font-mono text-[10px] uppercase">{here}</span>
        </p>
        <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
          Os shells nativos carregam a versão publicada na web. Configure{" "}
          <code className="rounded bg-elev px-1 font-mono">KEEW_APP_URL</code> no build para apontar a outro deploy.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {TARGETS.map((t) => {
          const Icon = t.icon;
          const current = t.id === here;
          return (
            <div
              key={t.id}
              className={`rounded-[var(--r-lg)] border p-3 transition-colors ${
                current ? "border-accent-line bg-accent/5" : "border-line bg-panel/40"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className={`grid size-8 shrink-0 place-items-center rounded-[var(--r-sm)] ${current ? "bg-accent/15 text-accent" : "bg-elev text-muted"}`}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[12px] font-medium text-fg">{t.name}</p>
                    <span className="shrink-0 rounded-[3px] border border-line bg-elev px-1 py-0.5 font-mono text-[8.5px] uppercase text-subtle">
                      {t.tag}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">{t.desc}</p>
                </div>
              </div>

              <ol className="mt-2 space-y-0.5">
                {t.steps.map((s, i) => (
                  <li key={s} className="flex items-start gap-1.5 text-[10px] leading-relaxed text-subtle">
                    <span className="mt-[1px] grid size-3 shrink-0 place-items-center rounded-full bg-elev font-mono text-[7.5px] text-muted">
                      {i + 1}
                    </span>
                    <span className="font-mono">{s}</span>
                  </li>
                ))}
              </ol>

              {t.command ? (
                <button
                  onClick={() => void copy(t.command!)}
                  className="mt-2 flex w-full items-center justify-between gap-2 rounded-[var(--r-sm)] border border-line bg-bg px-2 py-1.5 text-left transition-colors hover:border-accent-line"
                >
                  <code className="truncate font-mono text-[9.5px] text-accent">$ {t.command}</code>
                  <ChevronRight className="size-3 shrink-0 text-subtle" />
                </button>
              ) : (
                <div className="mt-2 flex items-center gap-1 text-[9.5px] text-emerald-400">
                  <Check className="size-3" /> instalável direto do navegador
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-[var(--r-lg)] border border-line bg-elev/40 p-3">
        <p className="text-[11px] font-medium text-fg">Guias completos no repositório</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {[
            ["docs/ANDROID.md", "APK Android"],
            ["docs/IOS.md", "IPA iOS"],
            ["docs/DESKTOP.md", "EXE / DMG"],
            ["docs/OWN-MODEL.md", "IA própria"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={`https://github.com/Veexdevs/Keew-IA/blob/main/${href}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-line bg-panel px-2 py-0.5 text-[10px] text-muted transition-colors hover:border-accent-line hover:text-fg"
            >
              {label} <ExternalLink className="size-2.5" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
