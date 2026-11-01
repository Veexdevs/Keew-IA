"use client";

import { useState } from "react";
import { Check, Copy, FileText, ImageIcon, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react";

import { Mark } from "@/components/ui/mark";
import { useStore } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";

import { Markdown } from "./markdown";
import { Sources } from "./sources";

/**
 * Um turno da conversa.
 *
 * Resposta da Keew: sem caixa, direto no fundo, com o mark discreto ao lado —
 * é o que deixa o texto respirar. Mensagem do usuário: um bloco com cor de
 * destaque, alinhado à direita.
 */
export function MessageRow({ message, isLast }: { message: ChatMessage; isLast: boolean }) {
  const { settings, retry, pushToast } = useStore();
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    pushToast("Resposta copiada", "ok");
  };

  if (isUser) {
    return (
      <div className="anim-rise flex w-full justify-end">
        <div className="flex max-w-[85%] flex-col items-end gap-2 sm:max-w-[72%]">
          <div className="whitespace-pre-wrap break-words rounded-[18px] bg-accent px-4 py-2.5 text-[14px] leading-[1.62] text-accent-fg">
            {message.content}
          </div>
          {!!message.attachments?.length && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {message.attachments.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 py-1 text-[11px] text-muted"
                >
                  {a.mime.startsWith("image/") ? <ImageIcon className="size-3" /> : <FileText className="size-3" />}
                  {a.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="anim-rise group/msg flex w-full gap-3">
      <span className="mt-[3px] grid size-[26px] shrink-0 place-items-center rounded-[9px] bg-accent text-accent-fg">
        <Mark size={15} title="" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[12.5px] font-semibold tracking-tight text-fg">Keew IA</span>
          {message.pending && (
            <span className="flex items-center gap-1.5 text-[11px] text-subtle">
              <span className="size-1 rounded-full bg-accent pulse-dot" />
              pensando
            </span>
          )}
        </div>

        {message.content ? (
          <div className="text-[14px] leading-[1.78] text-fg">
            <Markdown content={message.content} />
            {message.pending && <span className="caret ml-0.5" />}
          </div>
        ) : message.pending ? (
          <div className="flex items-center gap-2 py-1.5">
            <span className="flex gap-1">
              <span className="size-1.5 animate-pulse rounded-full bg-accent" />
              <span className="size-1.5 animate-pulse rounded-full bg-accent [animation-delay:150ms]" />
              <span className="size-1.5 animate-pulse rounded-full bg-accent [animation-delay:300ms]" />
            </span>
          </div>
        ) : null}

        {!message.pending && !!message.citations?.length && <Sources citations={message.citations} />}

        {/* ações: aparecem só no hover, sem selos nem contadores */}
        {!message.pending && (
          <div className="mt-2 flex items-center gap-0.5 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover/msg:opacity-100">
            <Action
              icon={copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
              label="Copiar"
              onClick={copy}
            />
            {isLast && (
              <Action icon={<RefreshCw className="size-4" />} label="Gerar novamente" onClick={() => retry(message.id)} />
            )}
            <Action
              icon={<ThumbsUp className="size-4" />}
              label="Boa resposta"
              onClick={() => pushToast("Obrigado pelo retorno.", "ok")}
            />
            <Action
              icon={<ThumbsDown className="size-4" />}
              label="Resposta ruim"
              onClick={() => pushToast("Anotado.", "info")}
            />
          </div>
        )}

        {message.error && <p className="mt-2 text-[11.5px] text-rose-400">{message.error}</p>}
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
      className="grid size-8 place-items-center rounded-[var(--r-sm)] text-subtle transition-colors hover:bg-elev hover:text-fg"
    >
      {icon}
    </button>
  );
}
