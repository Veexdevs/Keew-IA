"use client";

import { useState } from "react";
import {
  Brain, Check, ChevronDown, Copy, FileText, ImageIcon, RefreshCw, Stamp, ThumbsDown, ThumbsUp,
} from "lucide-react";

import { Mark } from "@/components/ui/mark";
import { useStore } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";

import { Markdown } from "./markdown";

export function MessageRow({ message, isLast }: { message: ChatMessage; isLast: boolean }) {
  const { settings, agents, retry, pushToast } = useStore();
  const [copied, setCopied] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const agent = agents.find((a) => a.id === message.agentId) || agents[0];
  const isUser = message.role === "user";
  const compact = settings.compactBubbles;

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    pushToast("Resposta copiada", "ok");
  };

  if (isUser) {
    return (
      <div className="anim-rise flex w-full justify-end gap-2.5">
        <div className="flex max-w-[88%] flex-col items-end gap-1.5 sm:max-w-[78%]">
          <div
            className={`whitespace-pre-wrap break-words rounded-[var(--r-lg)] rounded-br-[6px] bg-accent px-3.5 text-[13.5px] leading-relaxed text-accent-fg shadow-[0_10px_30px_-18px_rgb(var(--glow)/0.9)] ${
              compact ? "py-2" : "py-2.5"
            }`}
          >
            {message.content}
          </div>
          {!!message.attachments?.length && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {message.attachments.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border border-line bg-panel px-2 py-1 text-[10.5px] text-muted"
                >
                  {a.mime.startsWith("image/") ? <ImageIcon className="size-3" /> : <FileText className="size-3" />}
                  {a.name}
                </span>
              ))}
            </div>
          )}
          <span className="pr-1 font-mono text-[9.5px] text-subtle">
            {new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        {settings.showAvatars && (
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-[6px] border border-line-strong bg-elev text-[9.5px] font-semibold uppercase text-muted">
            {(settings.userNickname || "V").slice(0, 1)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="anim-rise group/msg flex w-full gap-2.5">
      {settings.showAvatars && (
        <span
          className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-[6px] text-accent"
          style={{ background: "color-mix(in srgb, var(--accent) 13%, transparent)" }}
          title={agent?.name}
        >
          <Mark size={13} title="" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-tight text-fg">Keew IA</span>
          <span className="rounded-[3px] border border-line bg-elev px-1 py-0.5 font-mono text-[9px] uppercase tracking-wide text-subtle">
            {agent?.name || "Core"}
          </span>
          {message.pending && (
            <span className="flex items-center gap-1 text-[10px] text-accent">
              <span className="size-1 rounded-full bg-accent pulse-dot" />
              gerando
            </span>
          )}
        </div>

        {/* reasoning trace */}
        {!!message.reasoning?.trim() && settings.showReasoning && (
          <div className="reasoning mb-2.5 overflow-hidden">
            <button
              onClick={() => setShowReasoning((v) => !v)}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[10.5px] font-medium text-muted transition-colors hover:text-fg"
            >
              <Brain className="size-3.5 text-accent" />
              <span>Raciocínio da Keew</span>
              <span className="font-mono text-[9.5px] text-subtle">
                {message.reasoning.split(/\s+/).length} palavras
              </span>
              <ChevronDown className={`ml-auto size-3.5 transition-transform ${showReasoning ? "rotate-180" : ""}`} />
            </button>
            {showReasoning && (
              <div className="border-t border-dashed border-accent-line/50 px-2.5 py-2 text-[11.5px] leading-relaxed text-muted">
                <Markdown content={message.reasoning} />
              </div>
            )}
          </div>
        )}

        {message.content ? (
          <div className={`text-[13.5px] leading-[1.72] text-fg ${compact ? "md-compact" : ""}`}>
            <Markdown content={message.content} />
            {message.pending && <span className="caret ml-0.5" />}
          </div>
        ) : message.pending ? (
          <div className="flex items-center gap-2 py-1">
            <span className="flex gap-1">
              <span className="size-1.5 animate-pulse rounded-full bg-accent" />
              <span className="size-1.5 animate-pulse rounded-full bg-accent [animation-delay:150ms]" />
              <span className="size-1.5 animate-pulse rounded-full bg-accent [animation-delay:300ms]" />
            </span>
            <span className="font-mono text-[10.5px] text-subtle">Keew está processando…</span>
          </div>
        ) : null}

        {/* actions */}
        {!message.pending && (
          <div className="mt-1.5 flex items-center gap-0.5 opacity-0 transition-opacity duration-200 group-hover/msg:opacity-100 focus-within:opacity-100">
            <Action icon={copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />} label="Copiar" onClick={copy} />
            {isLast && (
              <Action icon={<RefreshCw className="size-3.5" />} label="Gerar novamente" onClick={() => retry(message.id)} />
            )}
            <Action icon={<ThumbsUp className="size-3.5" />} label="Boa resposta" onClick={() => pushToast("Feedback registrado. Obrigado!", "ok")} />
            <Action icon={<ThumbsDown className="size-3.5" />} label="Resposta ruim" onClick={() => pushToast("Anotado — vou ajustar o tom.", "info")} />
            <span className="ml-1.5 flex items-center gap-1 font-mono text-[9.5px] text-subtle">
              <Stamp className="size-2.5" />
              {new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              {message.tokens?.out ? ` · ${Math.round(message.tokens.out)} tok` : ""}
            </span>
          </div>
        )}

        {message.error && (
          <p className="mt-1.5 text-[10.5px] text-rose-400/90">⚠ {message.error}</p>
        )}
      </div>
    </div>
  );
}

function Action({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-[var(--r-sm)] p-1.5 text-subtle transition-colors hover:bg-elev hover:text-fg"
    >
      {icon}
    </button>
  );
}
