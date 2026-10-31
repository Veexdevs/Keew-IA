"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Database, Download, HardDrive, RefreshCw, Trash2, Upload, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

export function DataTab() {
  const { chats, knowledge, automations, agents, usage, exportAll, importAll, purgeAll, pushToast } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState("");
  const [stats, setStats] = useState<{ used: string; items: number } | null>(null);

  const estimate = () => {
    try {
      let bytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) bytes += (localStorage.getItem(k) || "").length + k.length;
      }
      let items = 0;
      for (let i = 0; i < localStorage.length; i++) items += 1;
      setStats({ used: `${(bytes / 1024).toFixed(1)} KB`, items });
    } catch {
      setStats({ used: "—", items: 0 });
    }
  };

  const exportJson = () => {
    const blob = new Blob([exportAll()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `keew-workspace-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    pushToast("Backup exportado", "ok");
  };

  const onImport = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const text = await file.text();
    if (importAll(text)) pushToast("Workspace importado", "ok");
    else pushToast("Arquivo inválido — precisa ser o JSON exportado pela Keew", "error");
  };

  const messages = chats.reduce((n, c) => n + c.messages.length, 0);

  return (
    <div className="space-y-6">
      <div className="border-b border-line pb-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-fg">
          <HardDrive className="size-4 text-accent" /> Dados & backup
        </h2>
        <p className="mt-1 max-w-lg text-[11.5px] leading-relaxed text-muted">
          Tudo é seu: exporte, importe ou apague. A Keew guarda o workspace no navegador e, quando configurado, espelha
          a base de conhecimento no Supabase.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <Tile icon={<Database className="size-3.5" />} label="conversas" value={chats.length} />
        <Tile icon={<Zap className="size-3.5" />} label="mensagens" value={messages} />
        <Tile icon={<HardDrive className="size-3.5" />} label="documentos" value={knowledge.length} />
        <Tile icon={<RefreshCw className="size-3.5" />} label="agentes" value={agents.length} />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <Button variant="primary" onClick={exportJson}>
            <Download className="size-3.5" /> Exportar workspace
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" /> Importar backup
          </Button>
          <Button onClick={estimate}>
            <HardDrive className="size-3.5" /> Estimar armazenamento
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void onImport(e.target.files); e.target.value = ""; }} />
        </div>
        {stats && (
          <p className="font-mono text-[10.5px] text-muted">
            localStorage: {stats.used} em {stats.items} chave(s) — limite típico do navegador é ~5 MB.
          </p>
        )}
      </div>

      <div className="rounded-[var(--r-lg)] border border-line bg-panel/50 p-3">
        <p className="text-[11px] font-medium text-fg">Uso acumulado</p>
        <dl className="mt-1.5 space-y-1 text-[10.5px]">
          <Row k="Respostas geradas" v={String(usage.messages)} />
          <Row k="Tokens de entrada" v={usage.tokensIn.toLocaleString("pt-BR")} />
          <Row k="Tokens de saída" v={usage.tokensOut.toLocaleString("pt-BR")} />
          <Row k="Primeiro uso" v={new Date(usage.firstUseAt).toLocaleString("pt-BR")} />
          <Row k="Automações" v={String(automations.length)} />
        </dl>
      </div>

      <div className="rounded-[var(--r-lg)] border border-rose-500/25 bg-rose-500/5 p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-300">
          <AlertTriangle className="size-3.5" /> Zona de risco
        </p>
        <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
          Apaga conversas, documentos, automações e estatísticas deste navegador. Exporte antes — não há como desfazer.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder='digite "APAGAR"'
            className="h-8 w-40 rounded-[var(--r-sm)] border border-line bg-bg px-2 font-mono text-[11px] text-fg placeholder:text-subtle focus:border-rose-500/50 focus:outline-none"
          />
          <Button
            variant="danger"
            disabled={confirm.trim().toUpperCase() !== "APAGAR"}
            onClick={() => {
              purgeAll();
              setConfirm("");
              pushToast("Workspace apagado", "ok");
            }}
          >
            <Trash2 className="size-3.5" /> Apagar tudo
          </Button>
        </div>
      </div>
    </div>
  );
}

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-[var(--r-md)] border border-line bg-panel/50 px-2.5 py-2">
      <span className="text-subtle">{icon}</span>
      <p className="mt-1 font-mono text-[15px] font-medium leading-none text-fg">{value}</p>
      <p className="mt-0.5 text-[9px] uppercase tracking-wide text-subtle">{label}</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-subtle">{k}</dt>
      <dd className="truncate text-right text-fg">{v}</dd>
    </div>
  );
}
