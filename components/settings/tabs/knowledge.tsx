"use client";

import { useRef, useState } from "react";
import { BookOpen, FileUp, Plus, Search, Sparkles, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { KEEW_CORPUS } from "@/lib/knowledge";
import { useStore } from "@/lib/store";

export function KnowledgeTab() {
  const { knowledge, addKnowledge, deleteKnowledge, pushToast } = useStore();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = () => {
    if (!title.trim() || !content.trim()) {
      pushToast("Preencha título e conteúdo", "error");
      return;
    }
    addKnowledge({ title, content, tags: [] });
    setTitle("");
    setContent("");
    setOpen(false);
    pushToast("Documento adicionado à base", "ok");
  };

  const importFiles = async (files: FileList | null) => {
    if (!files) return;
    let count = 0;
    for (const file of Array.from(files).slice(0, 10)) {
      if (file.size > 2_000_000) continue;
      const text = /\.(txt|md|json|csv|yml|yaml|html|ts|tsx|js|py|css|sql)$/i.test(file.name) || file.type.startsWith("text/")
        ? await file.text()
        : null;
      if (!text) {
        pushToast(`${file.name}: formato não suportado para ingestão`, "error");
        continue;
      }
      addKnowledge({ title: file.name.replace(/\.[^.]+$/, ""), content: text, tags: ["importado"] });
      count += 1;
    }
    if (count) pushToast(`${count} documento(s) ingerido(s)`, "ok");
  };

  const filtered = query
    ? knowledge.filter(
        (k) =>
          k.title.toLowerCase().includes(query.toLowerCase()) ||
          k.content.toLowerCase().includes(query.toLowerCase()),
      )
    : knowledge;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-fg">
            <BookOpen className="size-4 text-accent" /> Base de conhecimento
          </h2>
          <p className="mt-1 max-w-lg text-[11.5px] leading-relaxed text-muted">
            Os documentos abaixo são recuperados por busca híbrida antes de cada resposta e injetados no contexto do
            modelo. A Keew também carrega {KEEW_CORPUS.length} documentos nativos (identidade, arquitetura, padrões).
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border border-line px-2 py-1.5 text-[11px] text-muted hover:border-line-strong hover:text-fg"
          >
            <FileUp className="size-3" /> Importar
          </button>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-[var(--r-sm)] bg-accent px-2 py-1.5 text-[11px] font-medium text-accent-fg hover:brightness-110"
          >
            <Plus className="size-3" /> Novo
          </button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        accept=".txt,.md,.json,.csv,.yml,.yaml,.html,.ts,.tsx,.js,.py,.css,.sql"
        onChange={(e) => { void importFiles(e.target.files); e.target.value = ""; }}
      />

      {open && (
        <div className="anim-scale space-y-2.5 rounded-[var(--r-lg)] border border-accent-line bg-panel/60 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11.5px] font-medium text-fg">Novo documento</p>
            <button onClick={() => setOpen(false)} className="rounded p-1 text-subtle hover:text-fg">
              <X className="size-3.5" />
            </button>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título — ex.: Manual do produto"
            className="h-9 w-full rounded-[var(--r-sm)] border border-line bg-bg px-2.5 text-[12px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={7}
            placeholder="Cole aqui o conteúdo que a Keew deve conhecer…"
            className="w-full resize-y rounded-[var(--r-sm)] border border-line bg-bg px-2.5 py-2 text-[11.5px] leading-relaxed text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          <div className="flex justify-end gap-1.5">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={save}>Salvar documento</Button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar na base…"
          className="h-9 w-full rounded-[var(--r-sm)] border border-line bg-panel pl-8 pr-2.5 text-[12px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
        />
      </div>

      <div className="space-y-1.5">
        {filtered.length === 0 && (
          <p className="rounded-[var(--r-md)] border border-dashed border-line px-3 py-6 text-center text-[11.5px] text-subtle">
            {query ? "Nenhum documento corresponde à busca." : "Base vazia. Adicione um documento ou importe arquivos."}
          </p>
        )}
        {filtered.map((doc) => (
          <div key={doc.id} className="group flex items-start gap-2.5 rounded-[var(--r-md)] border border-line bg-panel/50 p-2.5 transition-colors hover:border-line-strong">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-[5px] bg-elev text-accent">
              <BookOpen className="size-3" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-fg">{doc.title}</p>
              <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-relaxed text-muted">{doc.content.slice(0, 190)}</p>
              <div className="mt-1 flex items-center gap-2 font-mono text-[9px] text-subtle">
                <span>{doc.content.length.toLocaleString("pt-BR")} chars</span>
                <span>·</span>
                <span>{new Date(doc.updatedAt).toLocaleDateString("pt-BR")}</span>
                {!!doc.tags?.length && <span className="rounded bg-elev px-1 py-0.5">{doc.tags.join(", ")}</span>}
              </div>
            </div>
            <button
              onClick={() => { deleteKnowledge(doc.id); pushToast("Documento removido", "ok"); }}
              className="rounded p-1.5 text-subtle opacity-0 transition-all hover:bg-rose-500/10 hover:text-rose-400 group-hover:opacity-100"
              aria-label="Excluir documento"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-[var(--r-lg)] border border-line bg-elev/40 p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-fg">
          <Sparkles className="size-3.5 text-accent" /> Documentos nativos da Keew
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {KEEW_CORPUS.map((d) => (
            <span key={d.id} className="rounded-full border border-line bg-panel px-2 py-0.5 text-[9.5px] text-muted">
              {d.title}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
