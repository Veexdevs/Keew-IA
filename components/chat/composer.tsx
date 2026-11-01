"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, FileText, Image as ImageIcon, Loader2, Paperclip, Square, X } from "lucide-react";

import { useStore } from "@/lib/store";
import type { Attachment } from "@/lib/types";

const MAX_FILE = 4 * 1024 * 1024;           // 4 MB per attachment
const TEXT_MIME = /^text\/|json|javascript|typescript|xml|yaml|csv|markdown/;

export function Composer() {
  const { send, stop, busy, settings, pushToast } = useStore();

  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busyFiles, setBusyFiles] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

      <div className="relative rounded-[26px] border border-line bg-panel transition-colors focus-within:border-line-strong focus-within:shadow-[0_2px_20px_-12px_rgb(var(--glow)/0.65)]">
        {/* anexos: aparecem numa linha acima, discreta */}
        {!!attachments.length && (
          <div className="flex flex-wrap gap-1 px-3 pt-2">
            {attachments.map((a) => (
              <span
                key={a.id}
                className="anim-scale inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-line bg-elev py-1 pl-2.5 pr-1 text-[11px] text-muted"
              >
                {a.mime.startsWith("image/") ? (
                  <ImageIcon className="size-2.5 shrink-0" />
                ) : (
                  <FileText className="size-2.5 shrink-0" />
                )}
                <span className="truncate">{a.name}</span>
                <button
                  onClick={() => setAttachments((list) => list.filter((x) => x.id !== a.id))}
                  className="rounded-full p-0.5 hover:bg-line hover:text-fg"
                  aria-label={`Remover ${a.name}`}
                >
                  <X className="size-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* uma linha: anexo · campo · enviar */}
        <div className="flex items-end gap-1 py-1.5 pl-2 pr-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-elev hover:text-fg"
            title="Anexar arquivo"
            aria-label="Anexar arquivo"
          >
            {busyFiles ? (
              <Loader2 className="size-4 animate-spin text-accent" />
            ) : (
              <Paperclip className="size-[17px]" />
            )}
          </button>

          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Fale com a Keew…"
            className="block max-h-[180px] min-w-0 flex-1 resize-none bg-transparent py-2 text-[15px] leading-[1.5] text-fg placeholder:text-subtle focus:outline-none"
          />

          {busy ? (
            <button
              onClick={stop}
              className="grid size-9 shrink-0 place-items-center rounded-full border border-line-strong bg-elev text-fg transition-colors hover:text-rose-400"
              title="Parar"
              aria-label="Parar"
            >
              <Square className="size-3 fill-current" />
            </button>
          ) : (
            <button
              onClick={() => void submit()}
              disabled={!value.trim()}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-fg transition-all hover:opacity-90 active:scale-95 disabled:pointer-events-none disabled:opacity-25"
              title="Enviar"
              aria-label="Enviar"
            >
              <ArrowUp className="size-4" strokeWidth={2.4} />
            </button>
          )}
        </div>
      </div>
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
