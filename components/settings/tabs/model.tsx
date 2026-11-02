"use client";

import { useEffect, useState } from "react";
import { Brain, Check, Cpu, Database, Layers, TriangleAlert } from "lucide-react";

import { useStore } from "@/lib/store";

/**
 * O modelo da Keew.
 *
 * A Keew tem um modelo de linguagem treinado do zero sobre texto em
 * português. Esta aba mostra os números reais medidos no treino — e diz, sem
 * rodeio, o que esse tamanho consegue e o que não consegue fazer. Nenhum
 * número aqui é estimativa: parâmetros são contados do modelo, perda e
 * perplexidade vêm da validação.
 */

type Health = {
  status: string;
  model: string;
  params: number;
  params_m: number;
  step: number;
  val_loss: number;
  perplexity: number;
  tokens_seen: number;
  context: number;
  vocab: number;
  preset?: string;
};

/** Números do último treino — usados quando o servidor do modelo não responde. */
const LOCAL_SNAPSHOT = {
  params: 13_841_280,
  params_m: 13.84,
  context: 192,
  vocab: 8192,
  layers: 6,
  heads: 6,
  d_model: 384,
  corpus_docs: 7137,
  corpus_mb: 28.06,
  corpus_tokens_m: 6.8,
  /** medições do treino concluído (74,6 min em 2 núcleos de CPU) */
  steps: 6143,
  tokens_seen_m: 9.44,
  val_loss: 6.2637,
  perplexity: 525,
  tokens_per_s: 254,
};

export function ModelTab() {
  const setSettings = useStore((s) => s.setSettings);
  const [health, setHealth] = useState<Health | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/model")
      .then((r) => r.json())
      .then((d) => alive && setHealth(d.online ? d.health : null))
      .catch(() => alive && setHealth(null))
      .finally(() => alive && setChecking(false));
    return () => {
      alive = false;
    };
  }, []);

  const p = health ?? LOCAL_SNAPSHOT;
  const online = Boolean(health);

  return (
    <div className="space-y-7">
      <header>
        <h2 className="flex items-center gap-2 text-[17px] font-semibold text-fg">
          <Brain className="size-4 text-accent" /> Modelo da Keew
        </h2>
        <p className="mt-1.5 max-w-lg text-[13px] leading-relaxed text-muted">
          Treinado do zero sobre notícias em português. Cada parâmetro começou em ruído e foi ajustado
          por gradiente — nenhum peso foi baixado de terceiro.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Parâmetros" value={`${p.params_m}M`} icon={Cpu} />
        <Stat label="Camadas" value={String(LOCAL_SNAPSHOT.layers)} icon={Layers} />
        <Stat label="Contexto" value={`${p.context}`} icon={Brain} />
        <Stat label="Vocabulário" value={`${(p.vocab / 1000).toFixed(1)}k`} icon={Database} />
      </div>

      <section className="rounded-[var(--r-lg)] border border-line bg-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-subtle">Treino</p>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${
              online
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-line bg-elev text-subtle"
            }`}
          >
            <span className={`size-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-subtle"}`} />
            {checking ? "verificando" : online ? "servidor no ar" : "servidor offline"}
          </span>
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-3 text-[12.5px] sm:grid-cols-2">
          <Row k="Corpus" v={`${LOCAL_SNAPSHOT.corpus_docs.toLocaleString("pt-BR")} textos · ${LOCAL_SNAPSHOT.corpus_mb} MB`} />
          <Row k="Tokens de treino" v={`${LOCAL_SNAPSHOT.corpus_tokens_m}M`} />
          <Row
            k="Passos"
            v={online && health ? health.step.toLocaleString("pt-BR") : LOCAL_SNAPSHOT.steps.toLocaleString("pt-BR")}
          />
          <Row
            k="Tokens vistos"
            v={online && health ? `${(health.tokens_seen / 1e6).toFixed(2)}M` : `${LOCAL_SNAPSHOT.tokens_seen_m}M`}
          />
          <Row
            k="Perda (validação)"
            v={online && health ? health.val_loss.toFixed(4) : String(LOCAL_SNAPSHOT.val_loss)}
          />
          <Row
            k="Perplexidade"
            v={online && health ? health.perplexity.toFixed(0) : `${LOCAL_SNAPSHOT.perplexity}`}
          />
          <Row k="Velocidade" v={`${LOCAL_SNAPSHOT.tokens_per_s} tok/s em 2 núcleos`} />
        </dl>

        {!online && (
          <p className="mt-4 border-t border-line pt-3 text-[11.5px] leading-relaxed text-subtle">
            O servidor do modelo não está respondendo neste endereço. Os pesos estão treinados e
            salvos — veja <code className="rounded bg-elev px-1 py-0.5 text-[11px]">models/README.md</code>{" "}
            para subir com Docker, Hugging Face Spaces ou uma VPS.
          </p>
        )}
      </section>

      <section className="rounded-[var(--r-lg)] border border-amber-500/25 bg-amber-500/[0.05] p-4">
        <div className="flex items-start gap-2.5">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" />
          <div>
            <p className="text-[12.5px] font-medium text-fg">O que este tamanho alcança</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              Com 13,8M de parâmetros e 6,8M tokens de treino, o modelo aprende a forma do português —
              ortografia, pontuação, concordância e o vocabulário do noticiário. Ele <strong className="text-fg">não</strong>{" "}
              segue instruções nem responde perguntas: isso exige modelos de 7 a 400 bilhões de
              parâmetros, treinados em trilhões de tokens. A distância é de quatro ordens de grandeza
              em compute, e não se fecha com código.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-line pt-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-subtle">Usar como motor</p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
          O servidor do modelo fala o protocolo aberto de chat completions. Aponte a Keew para ele e o
          modelo próprio passa a ser o motor — sem chave de terceiro.
        </p>
        <pre className="scroll-thin mt-3 overflow-x-auto rounded-[var(--r-md)] border border-line bg-code-bg p-3.5 font-mono text-[11.5px] leading-relaxed text-muted">
{`KEEW_MODEL_BASE_URL=https://seu-modelo.exemplo.com/v1
KEEW_MODEL_NAME=keew-lm`}
        </pre>
        <button
          onClick={() => setSettings({ engineKey: "" })}
          className="mt-3 text-[12px] font-medium text-muted underline-offset-4 hover:text-fg hover:underline"
        >
          Limpar a chave salva do motor
        </button>
      </section>

      <div className="flex items-start gap-2 text-[11px] leading-relaxed text-subtle">
        <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500/80" />
        <span>
          Pesos, tokenizador e laço de treino estão no repositório em{" "}
          <code className="rounded bg-elev px-1 py-0.5">models/</code>. O treino é reproduzível:{" "}
          <code className="rounded bg-elev px-1 py-0.5">fetch_corpus</code> →{" "}
          <code className="rounded bg-elev px-1 py-0.5">train_tokenizer</code> →{" "}
          <code className="rounded bg-elev px-1 py-0.5">train</code>.
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Cpu }) {
  return (
    <div className="rounded-[var(--r-md)] border border-line bg-panel px-3.5 py-3">
      <Icon className="size-3.5 text-subtle" />
      <p className="mt-2 text-[17px] font-semibold leading-none text-fg">{value}</p>
      <p className="mt-1.5 text-[10.5px] uppercase tracking-[0.08em] text-subtle">{label}</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-2">
      <dt className="text-muted">{k}</dt>
      <dd className="font-mono text-[11.5px] text-fg">{v}</dd>
    </div>
  );
}
