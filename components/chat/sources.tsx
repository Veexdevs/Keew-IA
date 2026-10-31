"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ExternalLink, Globe } from "lucide-react";

import { faviconFor, tintFor } from "@/lib/citations";
import type { Citation } from "@/lib/types";

/**
 * Fontes da resposta — pequenas, redondas, discretas.
 *
 * Fechado: uma linha de bolinhas com o favicon de cada origem.
 * Aberto: cada fonte com título, trecho e link para abrir.
 * Nenhuma fonte aparece quando a resposta não usou material externo.
 */
export function Sources({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState(false);
  if (!citations?.length) return null;

  return (
    <div className="mt-2.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="group inline-flex items-center gap-1.5 rounded-full py-0.5 pr-1 text-[10.5px] text-subtle transition-colors hover:text-fg"
        aria-expanded={open}
      >
        <span className="flex items-center">
          {citations.slice(0, 4).map((c, i) => (
            <span
              key={`${c.title}-${i}`}
              className="-ml-1 first:ml-0 ring-1 ring-bg"
              style={{ zIndex: citations.length - i }}
            >
              <Favicon citation={c} size={15} />
            </span>
          ))}
        </span>
        <span className="font-medium">
          {citations.length} {citations.length === 1 ? "fonte" : "fontes"}
        </span>
        <ChevronDown
          className={`size-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul className="anim-rise mt-2 space-y-1">
          {citations.map((c, i) => (
            <li key={`${c.title}-${i}`}>
              <SourceRow citation={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SourceRow({ citation }: { citation: Citation }) {
  const isWeb = Boolean(citation.url);
  const body = (
    <>
      <Favicon citation={citation} size={18} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <span className="truncate text-[11.5px] font-medium text-fg">{citation.title}</span>
          {isWeb && <ExternalLink className="size-2.5 shrink-0 text-subtle" />}
        </span>
        {citation.snippet && (
          <span className="mt-0.5 block truncate text-[10px] leading-snug text-subtle">
            {citation.snippet}
          </span>
        )}
      </span>
    </>
  );

  const cls =
    "flex items-start gap-2 rounded-[var(--r-sm)] px-1.5 py-1.5 text-left transition-colors " +
    (isWeb ? "hover:bg-elev" : "cursor-default");

  return isWeb ? (
    <a href={citation.url} target="_blank" rel="noreferrer noopener" className={cls}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * Favicon circular. Se o ícone do site não carregar, cai para a inicial do
 * domínio sobre uma cor estável — nunca aparece um quadrado quebrado.
 */
function Favicon({ citation, size }: { citation: Citation; size: number }) {
  const [failed, setFailed] = useState(false);
  const seed = citation.url || citation.title;
  const round = { width: size, height: size, borderRadius: "9999px" } as const;

  if (!citation.url) {
    return (
      <span
        className="grid shrink-0 place-items-center border border-line bg-elev text-subtle"
        style={round}
        title={citation.title}
      >
        <BookOpen style={{ width: size * 0.55, height: size * 0.55 }} />
      </span>
    );
  }

  if (failed) {
    return (
      <span
        className="grid shrink-0 place-items-center text-[8px] font-semibold uppercase text-white"
        style={{ ...round, background: tintFor(seed) }}
        title={citation.title}
      >
        {citation.title.replace(/^www\./, "").slice(0, 1)}
      </span>
    );
  }

  return (
    <span className="grid shrink-0 place-items-center overflow-hidden bg-elev" style={round}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={faviconFor(citation.url, Math.max(32, size * 2))}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        style={{ width: size, height: size, objectFit: "cover" }}
      />
    </span>
  );
}

/** Ícone solto para cabeçalhos. */
export function SourcesGlyph() {
  return <Globe className="size-3" />;
}
