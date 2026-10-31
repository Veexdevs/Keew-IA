"use client";

import { useEffect, useState } from "react";
import { Check, Cpu, Eye, EyeOff, ExternalLink, KeyRound, Loader2, PlugZap, Server, Sparkles, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PROVIDER_PRESETS } from "@/lib/provider";
import { useStore } from "@/lib/store";
import type { ProviderKind } from "@/lib/types";

const GROUPS = [
  {
    label: "Recomendados",
    ids: ["deepseek", "openrouter", "groq", "together"],
  },
  {
    label: "Locais (sem custo por token)",
    ids: ["ollama", "local"],
  },
  {
    label: "Outros provedores",
    ids: ["openai", "gemini", "anthropic"],
  },
];

export function ModelTab() {
  const { provider, setProvider, pushToast, settings, setSettings } = useStore();
  const [preset, setPreset] = useState<string>(provider.kind || "deepseek");
  const [apiKey, setApiKey] = useState(provider.apiKey || "");
  const [show, setShow] = useState(false);
  const [model, setModel] = useState(provider.model || "");
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl || "");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const p = PROVIDER_PRESETS[preset];
    if (!p) return;
    setBaseUrl((cur) => cur || p.baseUrl);
    setModel((cur) => cur || p.model);
  }, [preset]);

  const save = () => {
    setProvider({ kind: preset as ProviderKind, apiKey, model, baseUrl });
    pushToast("Provedor salvo neste navegador", "ok");
  };

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Responda apenas: ok" }],
          system: "Responda com uma palavra.",
          client: { kind: preset, baseUrl, apiKey, model },
          mode: "model",
        }),
      });
      const text = await res.text();
      const ok = text.includes('"t":"text"') && !text.includes('"t":"error"');
      const errMatch = text.match(/"v":"([^"]{6,})"/g);
      setResult({
        ok,
        text: ok
          ? `Conexão estabelecida com ${model || PROVIDER_PRESETS[preset]?.model}.`
          : errMatch?.[0]?.replace(/"v":"|"/g, "") || "Não foi possível validar a conexão.",
      });
    } catch (err) {
      setResult({ ok: false, text: (err as Error).message });
    }
    setTesting(false);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-line pb-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-fg">
          <Cpu className="size-4 text-accent" /> Modelo & provedor
        </h2>
        <p className="mt-1 max-w-lg text-[11.5px] leading-relaxed text-muted">
          O gateway da Keew fala com qualquer endpoint compatível com OpenAI. A chave salva aqui fica apenas no seu
          navegador; se o servidor tiver <code className="rounded bg-elev px-1 font-mono text-[10px]">KEEW_MODEL_API_KEY</code>,
          ela tem prioridade e esta fica como reserva.
        </p>
      </div>

      {GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-subtle">{group.label}</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {group.ids.map((id) => {
              const p = PROVIDER_PRESETS[id];
              if (!p) return null;
              const active = preset === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    setPreset(id);
                    setBaseUrl(p.baseUrl);
                    setModel(p.model);
                  }}
                  className={`flex items-start gap-2.5 rounded-[var(--r-md)] border px-2.5 py-2 text-left transition-colors ${
                    active ? "border-accent bg-accent/5" : "border-line hover:border-line-strong"
                  }`}
                >
                  <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${active ? "border-accent text-accent" : "border-line-strong text-subtle"}`}>
                    {active ? <Check className="size-3" strokeWidth={3} /> : <Server className="size-2.5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12px] font-medium text-fg">{p.label}</span>
                    <span className="block truncate font-mono text-[9.5px] text-subtle">{p.model}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="space-y-3 rounded-[var(--r-lg)] border border-line bg-panel/60 p-3.5">
        <Field label="Chave de API" icon={<KeyRound className="size-3.5" />}>
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={preset === "ollama" || preset === "local" ? "não necessária em localhost" : "sk-…"}
              autoComplete="off"
              className="h-9 w-full rounded-[var(--r-sm)] border border-line bg-bg px-2.5 pr-9 font-mono text-[11.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-subtle hover:text-fg"
              aria-label={show ? "Ocultar chave" : "Mostrar chave"}
            >
              {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Modelo" hint="id exato do provedor">
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={PROVIDER_PRESETS[preset]?.model}
              className="h-9 w-full rounded-[var(--r-sm)] border border-line bg-bg px-2.5 font-mono text-[11.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
          </Field>
          <Field label="Base URL" hint="endpoint /v1">
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={PROVIDER_PRESETS[preset]?.baseUrl}
              className="h-9 w-full rounded-[var(--r-sm)] border border-line bg-bg px-2.5 font-mono text-[11.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
          </Field>
        </div>

        <Field label="Modelo padrão do workspace" hint="usado em novas conversas">
          <input
            value={settings.defaultModel}
            onChange={(e) => setSettings({ defaultModel: e.target.value })}
            placeholder="vazio = usar o do provedor"
            className="h-9 w-full rounded-[var(--r-sm)] border border-line bg-bg px-2.5 font-mono text-[11.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </Field>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button variant="primary" onClick={save}>
            <Check className="size-3.5" /> Salvar
          </Button>
          <Button onClick={test} disabled={testing}>
            {testing ? <Loader2 className="size-3.5 animate-spin" /> : <PlugZap className="size-3.5" />}
            Testar conexão
          </Button>
          <a
            href={PROVIDER_PRESETS[preset]?.docs}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-subtle transition-colors hover:text-fg"
          >
            Documentação <ExternalLink className="size-3" />
          </a>
        </div>

        {result && (
          <div
            className={`flex items-start gap-2 rounded-[var(--r-sm)] border px-2.5 py-2 text-[11px] ${
              result.ok ? "border-emerald-500/30 bg-emerald-500/8 text-emerald-300" : "border-amber-500/30 bg-amber-500/8 text-amber-300"
            }`}
          >
            {result.ok ? <Check className="mt-0.5 size-3.5 shrink-0" /> : <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />}
            <span className="leading-relaxed">{result.text}</span>
          </div>
        )}
      </div>

      <div className="rounded-[var(--r-lg)] border border-line bg-elev/40 p-3.5">
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-fg">
          <Sparkles className="size-3.5 text-accent" /> Sem chave? A Keew continua respondendo.
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          O núcleo de raciocínio local resolve matemática, datas, conversões, resumos e consultas à base de
          conhecimento sem nenhuma chamada externa. Para respostas gerais de linguagem, configure um provedor acima ou
          rode um modelo em casa com <code className="rounded bg-elev px-1 font-mono text-[10px]">ollama run deepseek-r1:8b</code>.
        </p>
        <a
          href="https://github.com/Veexdevs/Keew-IA/blob/main/docs/OWN-MODEL.md"
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-medium text-accent hover:underline"
        >
          Como servir o modelo próprio <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  );
}

function Field({ label, hint, icon, children }: { label: string; hint?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-[10.5px] font-medium text-muted">
        {icon}
        {label}
        {hint && <span className="ml-auto font-mono text-[9px] text-subtle">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
