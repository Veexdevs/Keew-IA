"use client";

import { useEffect, useState } from "react";
import {
  Activity, Check, Cpu, Database, Globe, KeyRound, RefreshCw, Server, Shield,
  SlidersHorizontal, TriangleAlert, Wifi,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { isSupabaseReady } from "@/lib/flags";
import { useStore } from "@/lib/store";

type Health = {
  ok: boolean; version: string; uptimeSec: number; model: string; engine?: string;
  configured: boolean; supabase: boolean; region?: string; node?: string; at: string;
};

export function SystemTab() {
  const { settings, setSettings, accessKey, setAccessKey, pushToast, knowledge, automations } = useStore();
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      setHealth(await res.json());
    } catch {
      setHealth(null);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-6">
      <div className="border-b border-line pb-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-fg">
          <SlidersHorizontal className="size-4 text-accent" /> Sistema & workspace
        </h2>
        <p className="mt-1 max-w-lg text-[11.5px] leading-relaxed text-muted">
          Identidade no workspace, acesso, e o estado real do plano 24/7 no servidor.
        </p>
      </div>

      <section>
        <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-subtle">Identidade</p>
        <div className="space-y-2.5 rounded-[var(--r-lg)] border border-line bg-panel/50 p-3">
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-medium text-muted">Seu nome no workspace</span>
            <input
              value={settings.userNickname}
              onChange={(e) => setSettings({ userNickname: e.target.value })}
              placeholder="Como a Keew deve te chamar"
              className="h-9 w-full rounded-[var(--r-sm)] border border-line bg-bg px-2.5 text-[12px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-[10.5px] font-medium text-muted">
              <KeyRound className="size-3" /> Chave de acesso do workspace
              <span className="ml-auto font-mono text-[9px] text-subtle">KEEW_ACCESS_KEY</span>
            </span>
            <div className="flex gap-1.5">
              <input
                type="password"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder="vazio = sem senha"
                className="h-9 flex-1 rounded-[var(--r-sm)] border border-line bg-bg px-2.5 font-mono text-[11.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
              />
              <Button onClick={() => pushToast("Chave salva neste navegador", "ok")}>
                <Check className="size-3.5" /> Salvar
              </Button>
            </div>
            <span className="mt-1 block text-[10px] leading-relaxed text-subtle">
              Se o servidor tiver <code className="rounded bg-elev px-1 font-mono">KEEW_ACCESS_KEY</code> definido, esta
              chave é enviada em todo pedido ao serviço da Keew.
            </span>
          </label>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-subtle">Estado do servidor (24/7)</p>
          <button onClick={() => void load()} className="inline-flex items-center gap-1 text-[10px] text-muted hover:text-fg">
            <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          <StatCard
            icon={<Server className="size-3.5" />}
            label="Serviço"
            value={health?.ok ? "operacional" : health ? "degradado" : "sem resposta"}
            tone={health?.ok ? "ok" : "warn"}
          />
          <StatCard
            icon={<Cpu className="size-3.5" />}
            label="Inteligência"
            value={health ? `Keew 1${health.configured ? " · completa" : " · núcleo"} ` : "—"}
            tone={health?.configured ? "ok" : "warn"}
          />
          <StatCard
            icon={<Wifi className="size-3.5" />}
            label="Uptime da instância"
            value={health ? formatUptime(health.uptimeSec) : "—"}
          />
          <StatCard
            icon={<Database className="size-3.5" />}
            label="Memória (Supabase)"
            value={health?.supabase ? "conectada" : "local (offline-first)"}
            tone={health?.supabase ? "ok" : "warn"}
          />
          <StatCard icon={<Globe className="size-3.5" />} label="Região" value={health?.region || "local"} />
          <StatCard icon={<Activity className="size-3.5" />} label="Versão" value={health?.version ? `v${health.version}` : "1.0.0"} />
        </div>
        {!health && (
          <p className="mt-2 flex items-start gap-1.5 rounded-[var(--r-sm)] border border-amber-500/25 bg-amber-500/5 px-2.5 py-2 text-[10.5px] text-amber-300/90">
            <TriangleAlert className="mt-0.5 size-3 shrink-0" />
            Não consegui falar com <code className="font-mono">/api/health</code>. Rode <code className="font-mono">npm run dev</code> ou verifique o deploy.
          </p>
        )}
      </section>

      <section>
        <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-subtle">Workspace</p>
        <div className="rounded-[var(--r-lg)] border border-line bg-panel/50 p-3">
          <dl className="space-y-1.5 text-[11px]">
            <Line k="Agente padrão" v={settings.defaultAgentId} />
            <Line k="Inteligência" v={health?.configured ? "Keew 1 · completa" : "Keew Core"} />
            <Line k="Documentos na base" v={String(knowledge.length)} />
            <Line k="Automações registradas" v={String(automations.length)} />
            <Line k="Sincronização em nuvem" v={isSupabaseReady() ? "ativa" : "somente local"} />
            <Line k="Plano de execução" v="Vercel (hobby) + GitHub Actions" />
          </dl>
        </div>
      </section>

      <section>
        <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-subtle">Segurança</p>
        <div className="rounded-[var(--r-lg)] border border-line bg-elev/40 p-3">
          <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-fg">
            <Shield className="size-3.5 text-emerald-400" /> Como seus dados circulam
          </p>
          <ul className="mt-1.5 space-y-1 text-[10.5px] leading-relaxed text-muted">
            <li>• Conversas ficam no seu navegador (localStorage) — nada sai sem você enviar.</li>
            <li>• Ao enviar, o texto é processado pelo motor da Keew no servidor.</li>
            <li>• As chaves do motor nunca aparecem em logs nem chegam ao navegador.</li>
            <li>• Cálculos, datas, conversões e resumos rodam no núcleo local, sem chamada externa.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon, label, value, tone,
}: {
  icon: React.ReactNode; label: string; value: string; tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-[var(--r-md)] border border-line bg-panel/50 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-subtle">
        {icon}
        <span className="text-[9px] uppercase tracking-[0.1em]">{label}</span>
      </div>
      <p className={`mt-1 truncate text-[11.5px] font-medium ${tone === "ok" ? "text-emerald-400" : tone === "warn" ? "text-amber-400" : "text-fg"}`}>
        {value}
      </p>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-subtle">{k}</dt>
      <dd className="truncate text-right text-fg">{v}</dd>
    </div>
  );
}

function formatUptime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}min`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}min`;
  return `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`;
}
