"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";

import { useStore } from "@/lib/store";

const LANG_LABEL: Record<string, string> = {
  ts: "TypeScript", tsx: "TSX", js: "JavaScript", jsx: "JSX", py: "Python",
  sh: "Shell", bash: "Bash", zsh: "Shell", json: "JSON", css: "CSS", html: "HTML",
  md: "Markdown", sql: "SQL", yml: "YAML", yaml: "YAML", go: "Go", rs: "Rust",
  java: "Java", kt: "Kotlin", swift: "Swift", dart: "Dart", c: "C", cpp: "C++",
  php: "PHP", rb: "Ruby", txt: "Texto",
};

const EXT: Record<string, string> = {
  ts: "ts", tsx: "tsx", js: "js", jsx: "jsx", py: "py", sh: "sh", bash: "sh",
  json: "json", css: "css", html: "html", md: "md", sql: "sql", yml: "yml",
  yaml: "yaml", go: "go", rs: "rs", java: "java", kt: "kt", swift: "swift",
  dart: "dart", c: "c", cpp: "cpp", php: "php", rb: "rb",
};

export function CodeBlock({
  code, lang = "txt", children,
}: {
  code: string;
  lang?: string;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const [wrapped, setWrapped] = useState(false);
  const codeWrap = useStore((s) => s.settings.codeWrap);
  const pushToast = useStore((s) => s.pushToast);
  const language = (lang || "txt").toLowerCase();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      pushToast("Não foi possível copiar — selecione manualmente.", "error");
    }
  };

  const download = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `keew-snippet.${EXT[language] || "txt"}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const isWrapped = wrapped || codeWrap;

  return (
    <div className="code-shell">
      <div className="flex items-center justify-between border-b border-line bg-panel/60 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-accent/70" />
          <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted">
            {LANG_LABEL[language] || lang || "texto"}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setWrapped((w) => !w)}
            className={`rounded px-1.5 py-1 text-[10px] font-medium transition-colors ${
              isWrapped ? "text-accent" : "text-subtle hover:text-fg"
            }`}
            title="Quebra de linha"
          >
            quebrar
          </button>
          <button onClick={download} className="rounded p-1 text-subtle transition-colors hover:text-fg" title="Baixar">
            <Download className="size-3.5" />
          </button>
          <button onClick={copy} className="rounded p-1 transition-colors hover:text-fg" title="Copiar">
            {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5 text-subtle" />}
          </button>
        </div>
      </div>
      <pre className={isWrapped ? "whitespace-pre-wrap break-words" : ""}>
        <code className={isWrapped ? "!whitespace-pre-wrap !break-words" : ""}>{children}</code>
      </pre>
    </div>
  );
}
