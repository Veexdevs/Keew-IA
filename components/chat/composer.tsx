"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp, ChevronDown, FileText, Image as ImageIcon, Loader2, Paperclip, Square, Wand2, X,
} from "lucide-react";

import { useStore } from "@/lib/store";
import type { Attachment } from "@/lib/types";

const MAX_FILE = 4 * 1024 * 1024;           // 4 MB per attachment
const TEXT_MIME = /^text\/|json|javascript|typescript|xml|yaml|csv|markdown/;

export function Composer() {
  const {
    send, stop, busy, agents, settings, currentChatId, chats,
    openSettings, pushToast,
  } = useStore();

  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [agentMenu, setAgentMenu] = useState(false);
  const [busyFiles, setBusyFiles] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const chat = chats.find((c) => c.id === currentChatId) || chats[0];
  const agent = agents.find((a) => a.id === chat?.agentId) || agents[0];

  useEffect(() => {
    const onFocus = () => taRef.current?.focus();
    window.addEventListener("keew:focus-composer", onFocus);
    return () => window.removeEventListener("keew:focus-composer", onFocus);
  }, []);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 220)}px`;
  }, [value]);

  const submit = async () => {
    if (!value.trim() || busy) return;
    const text = value;
    const files = attachments;
    setValue("");
    setAttachments([]);
    taRef.current?.focus();
    await send(text, { attachments: files.length ? files : undefined });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusyFiles(true);
    const next: Attachment[] = [];
    for (const file of Array.from(files).slice(0, 5)) {
      if (file.size > MAX_FILE) {
        pushToast(`${file.name} é grande demais (limite 4 MB).`, "error");
        continue;
      }
      const base: Attachment = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size,
      };
      try {
        if (TEXT_MIME.test(file.type) || /\.(txt|md|json|csv|ts|tsx|js|jsx|py|css|html|yml|yaml|sql|log)$/i.test(file.name)) {
          base.text = (await file.text()).slice(0, 200_000);
        } else if (file.type.startsWith("image/")) {
          base.dataUrl = await toDataUrl(file);
        } else if (/pdf$/i.test(file.name) || file.type === "application/pdf") {
          base.text = await extractPdfText(file);
        }
      } catch {
        pushToast(`Não consegui ler ${file.name}.`, "error");
      }
      next.push(base);
    }
    setAttachments((a) => [...a, ...next].slice(0, 5));
    setBusyFiles(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (settings.sendOnEnter) {
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        void submit();
      }
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="w-full">
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".txt,.md,.json,.csv,.pdf,.ts,.tsx,.js,.jsx,.py,.css,.html,.yml,.yaml,.sql,image/*"
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="relative rounded-[var(--r-xl)] border border-line bg-panel/95 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.9)] backdrop-blur transition-colors focus-within:border-line-strong">
        {/* attachments */}
        {!!attachments.length && (
          <div className="flex flex-wrap gap-1.5 px-2.5 pt-2.5">
            {attachments.map((a) => (
              <span
                key={a.id}
                className="anim-scale inline-flex max-w-[220px] items-center gap-1.5 rounded-[var(--r-sm)] border border-line bg-elev py-1 pl-2 pr-1 text-[10.5px] text-muted"
              >
                {a.mime.startsWith("image/") ? <ImageIcon className="size-3 shrink-0" /> : <FileText className="size-3 shrink-0" />}
                <span className="truncate">{a.name}</span>
                <button
                  onClick={() => setAttachments((list) => list.filter((x) => x.id !== a.id))}
                  className="rounded p-0.5 hover:bg-line hover:text-fg"
                  aria-label={`Remover ${a.name}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            {busyFiles && <Loader2 className="size-3.5 animate-spin text-accent" />}
          </div>
        )}

        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Pergunte, cole código, anexe um arquivo…"
          className="block max-h-[220px] w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-[13.5px] leading-[1.6] text-fg placeholder:text-subtle focus:outline-none"
        />

        {/* toolbar */}
        <div className="flex items-center gap-1 px-2 pb-2 pt-0.5">
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-[var(--r-sm)] p-1.5 text-muted transition-colors hover:bg-elev hover:text-fg"
            title="Anexar arquivo"
          >
            <Paperclip className="size-4" />
          </button>

          {/* agent picker */}
          <div className="relative">
            <button
              onClick={() => setAgentMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-[var(--r-sm)] px-1.5 py-1 text-[11.5px] font-medium text-muted transition-colors hover:bg-elev hover:text-fg"
              title="Trocar agente"
            >
              <span style={{ color: agent?.accent }}>{agent?.emoji}</span>
              <span className="hidden sm:inline">{agent?.name}</span>
              <ChevronDown className="size-3" />
            </button>
            {agentMenu && (
              <>
                <button className="fixed inset-0 z-40 cursor-default" onClick={() => setAgentMenu(false)} aria-hidden />
                <div className="anim-scale absolute bottom-9 left-0 z-50 w-64 rounded-[var(--r-md)] border border-line bg-panel p-1 shadow-2xl">
                  {agents.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        useStore.setState((s) => ({
                          chats: s.chats.map((c) => (c.id === chat?.id ? { ...c, agentId: a.id } : c)),
                        }));
                        setAgentMenu(false);
                      }}
                      className={`flex w-full items-start gap-2 rounded-[var(--r-sm)] px-2 py-1.5 text-left transition-colors hover:bg-elev ${
                        a.id === agent?.id ? "bg-elev/60" : ""
                      }`}
                    >
                      <span className="mt-0.5 text-[13px]" style={{ color: a.accent }}>{a.emoji}</span>
                      <span className="min-w-0">
                        <span className="block text-[12px] font-medium text-fg">{a.name}</span>
                        <span className="block truncate text-[10.5px] text-subtle">{a.description}</span>
                      </span>
                    </button>
                  ))}
                  <div className="my-1 h-px bg-line" />
                  <button
                    onClick={() => {
                      setAgentMenu(false);
                      openSettings("agentes");
                    }}
                    className="w-full rounded-[var(--r-sm)] px-2 py-1.5 text-left text-[11.5px] text-muted hover:bg-elev hover:text-fg"
                  >
                    Gerenciar agentes…
                  </button>
                </div>
              </>
            )}
          </div>

          {/* identidade: a Keew responde, sem escolha de modelo */}
          <span
            className="flex items-center gap-1.5 rounded-[var(--r-sm)] px-1.5 py-1 text-[11px] font-medium text-muted"
            title="A Keew escolhe sozinha entre o núcleo próprio e o raciocínio profundo"
          >
            <Wand2 className="size-3.5 text-accent" />
            <span className="hidden sm:inline">Keew 1</span>
          </span>

          <div className="ml-auto flex items-center gap-1">
            <span className="hidden pr-1 font-mono text-[9.5px] text-subtle md:inline">
              {settings.sendOnEnter ? "Enter envia · Shift+Enter quebra" : "⌘+Enter envia"}
            </span>
            {busy ? (
              <button
                onClick={stop}
                className="grid size-8 place-items-center rounded-[var(--r-md)] border border-line-strong bg-elev text-fg transition-colors hover:border-rose-500/40 hover:text-rose-400"
                title="Parar geração"
              >
                <Square className="size-3 fill-current" />
              </button>
            ) : (
              <button
                onClick={() => void submit()}
                disabled={!value.trim()}
                className="grid size-8 place-items-center rounded-[var(--r-md)] bg-accent text-accent-fg shadow-[0_6px_20px_-10px_rgb(var(--glow)/0.95)] transition-all hover:brightness-110 active:scale-95 disabled:pointer-events-none disabled:opacity-30"
                title="Enviar"
              >
                <ArrowUp className="size-4" strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mt-1.5 text-center text-[9.5px] leading-relaxed text-subtle">
        Keew IA pode cometer erros — confira informações críticas.{" "}
        <span className="text-muted">Raciocínio próprio da Keew.</span>
      </p>
    </div>
  );
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Minimal PDF text extraction: pulls literal strings out of content streams. */
async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const raw = new TextDecoder("latin1").decode(buf);
  const chunks: string[] = [];
  const re = /\((?:\\.|[^\\()])*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const text = m[0]
      .slice(1, -1)
      .replace(/\\([()\\])/g, "$1")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "");
    if (/[\x20-\x7E\u00C0-\u017F]{3,}/.test(text)) chunks.push(text);
  }
  const out = chunks.join(" ").replace(/\s{2,}/g, " ").trim();
  return out || "[PDF sem camada de texto legível — envie como imagem para leitura visual.]";
}
