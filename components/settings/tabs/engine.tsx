"use client";

import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, TriangleAlert, Zap } from "lucide-react";

import { useStore } from "@/lib/store";

/**
 * Conexão do motor de linguagem.
 *
 * Uma chave, um botão. Sem lista de fornecedores, sem nomes de terceiros.
 * A chave fica no navegador de quem colou (localStorage, que é do usuário) e
 * é enviada a cada pedido — o servidor não guarda nada.
 */
export function EngineTab() {
  const engineKey = useStore((s) => s.settings.engineKey);
  const setSettings = useStore((s) => s.setSettings);

  const [state, setState] = useState<{ ready: boolean; detail: string } | null>(null);
  const [key, setKey] = useState(engineKey);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  // o estado do motor é conferido com a chave que está salva
  useEffect(() => {
    fetch("/api/engine", {
      headers: engineKey ? { "x-keew-engine-key": engineKey } : {},
    })
      .then((r) => r.json())
      .then(setState)
      .catch(() => setState({ ready: false, detail: "Sem resposta do servidor." }));
  }, [engineKey]);

  const connect = async () => {
    const clean = key.trim();
    if (clean.length < 8) return;

    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/engine/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: clean }),
      });
      const data = await res.json();

      if (data.ok) {
        setSettings({ engineKey: clean });
        setResult({ ok: true, text: "Motor conectado. A Keew já responde qualquer assunto." });
      } else {
        setResult({ ok: false, text: data.detail || "Não consegui validar essa chave." });
      }
    } catch (err) {
      setResult({ ok: false, text: (err as Error).message });
    }
    setSaving(false);
  };

  const disconnect = () => {
    setSettings({ engineKey: "" });
    setKey("");
    setResult(null);
  };

  return (
    <div className="space-y-7">
      <header>
        <h2 className="flex items-center gap-2 text-[17px] font-semibold text-fg">
          <Zap className="size-4 text-accent" /> Motor da Keew
        </h2>
        <p className="mt-1.5 max-w-lg text-[13px] leading-relaxed text-muted">
          {state?.detail || "Verificando o estado do motor…"}
        </p>
      </header>

      {state?.ready ? (
        <div className="flex items-start gap-2.5 rounded-[var(--r-lg)] border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3.5">
          <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-fg">Motor conectado</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
              A Keew responde qualquer assunto, com raciocínio longo quando for preciso.
            </p>
            <button
              onClick={disconnect}
              className="mt-2.5 text-[12px] font-medium text-muted underline-offset-4 hover:text-fg hover:underline"
            >
              Desconectar e apagar a chave
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-[var(--r-lg)] border border-line bg-panel p-5">
          <div className="flex items-start gap-2.5">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" />
            <p className="text-[12.5px] leading-relaxed text-muted">
              Sem uma chave, a Keew só resolve conta, data, conversão, texto e busca nos seus documentos.
              Ela não redige nem conversa sobre assuntos abertos.
            </p>
          </div>

          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-fg">
              <KeyRound className="size-3.5" /> Chave do motor
            </span>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="cole a chave aqui"
                autoComplete="off"
                spellCheck={false}
                className="h-11 w-full rounded-[var(--r-md)] border border-line bg-bg px-3.5 pr-11 font-mono text-[12.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-subtle hover:text-fg"
                aria-label={show ? "Ocultar" : "Mostrar"}
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </label>

          <button
            onClick={() => void connect()}
            disabled={saving || key.trim().length < 8}
            className="inline-flex h-10 items-center gap-2 rounded-[var(--r-md)] bg-accent px-4 text-[13px] font-medium text-accent-fg transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-35"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
            {saving ? "Conferindo…" : "Conectar motor"}
          </button>

          <div className="flex items-start gap-2 border-t border-line pt-3.5">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-subtle" />
            <p className="text-[11px] leading-relaxed text-subtle">
              A chave fica no seu navegador e é enviada direto ao provedor a cada mensagem. O servidor da
              Keew só repassa o pedido — não guarda a chave e não a registra em log.
            </p>
          </div>
        </div>
      )}

      {result && (
        <div
          className={`flex items-start gap-2 rounded-[var(--r-lg)] border px-3.5 py-3 text-[12.5px] ${
            result.ok
              ? "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300"
              : "border-amber-500/25 bg-amber-500/[0.06] text-amber-300"
          }`}
        >
          {result.ok ? <Check className="mt-0.5 size-4 shrink-0" /> : <TriangleAlert className="mt-0.5 size-4 shrink-0" />}
          <span className="leading-relaxed">{result.text}</span>
        </div>
      )}

      <section className="border-t border-line pt-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-subtle">O que funciona sem chave</p>
        <ul className="mt-2.5 grid gap-1.5 text-[12.5px] text-muted sm:grid-cols-2">
          {[
            "Conta e porcentagem",
            "Datas e prazos",
            "Conversão de unidades",
            "Slug, base64, JSON",
            "Resumo por extração",
            "Busca nos seus documentos",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <Check className="size-3.5 shrink-0 text-emerald-500/80" />
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
