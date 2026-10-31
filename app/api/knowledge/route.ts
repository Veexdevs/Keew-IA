/**
 * /api/knowledge — CRUD + semantic-ish search over the workspace knowledge base.
 *
 * Storage: Supabase when configured (`keew_knowledge`), otherwise an in-memory
 * store so the feature works in preview deployments and local dev.
 */
import type { NextRequest } from "next/server";

import { fail, guard, json } from "@/lib/api-utils";
import { KEEW_CORPUS, buildIndex, search } from "@/lib/knowledge";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { KnowledgeDoc } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const memory = new Map<string, KnowledgeDoc>();

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  const docs = await loadDocs();

  if (q) {
    const index = buildIndex(docs);
    const hits = search(index, q, 8, 0.2).map(({ content, ...rest }) => ({
      ...rest,
      preview: content.slice(0, 240),
    }));
    return json({ ok: true, query: q, hits, total: docs.length });
  }

  return json({
    ok: true,
    storage: supabaseAdmin() ? "supabase" : "memory",
    builtin: KEEW_CORPUS.length,
    docs: docs.map(({ content, ...rest }) => ({ ...rest, preview: content.slice(0, 200), chars: content.length })),
  });
}

export async function POST(req: NextRequest) {
  const limited = guard(req);
  if (limited) return limited;

  let body: Partial<KnowledgeDoc>;
  try {
    body = await req.json();
  } catch {
    return fail(400, "JSON inválido");
  }
  if (!body.title?.trim() || !body.content?.trim()) {
    return fail(400, "Título e conteúdo são obrigatórios.");
  }
  if (body.content.length > 400_000) {
    return fail(413, "Documento muito grande (limite 400k caracteres).");
  }

  const now = Date.now();
  const doc: KnowledgeDoc = {
    id: body.id || `k_${now.toString(36)}`,
    title: body.title.trim().slice(0, 200),
    content: body.content.trim(),
    tags: body.tags || [],
    createdAt: body.createdAt || now,
    updatedAt: now,
  };

  const sb = supabaseAdmin();
  if (sb) {
    const { error } = await sb.from("keew_knowledge").upsert({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      tags: doc.tags,
      updated_at: new Date(doc.updatedAt).toISOString(),
    });
    if (error) return fail(502, `Falha ao salvar no Supabase: ${error.message}`);
  } else {
    memory.set(doc.id, doc);
  }

  return json({ ok: true, doc: { ...doc, content: doc.content.slice(0, 200) }, storage: sb ? "supabase" : "memory" });
}

export async function DELETE(req: NextRequest) {
  const limited = guard(req);
  if (limited) return limited;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fail(400, "Informe ?id=");

  const sb = supabaseAdmin();
  if (sb) {
    const { error } = await sb.from("keew_knowledge").delete().eq("id", id);
    if (error) return fail(502, error.message);
  } else {
    memory.delete(id);
  }
  return json({ ok: true, deleted: id });
}

async function loadDocs(): Promise<KnowledgeDoc[]> {
  const sb = supabaseAdmin();
  if (!sb) return [...KEEW_CORPUS, ...memory.values()];
  const { data, error } = await sb
    .from("keew_knowledge")
    .select("id,title,content,tags,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error || !data) return [...KEEW_CORPUS, ...memory.values()];
  const remote: KnowledgeDoc[] = data.map((d: any) => ({
    id: d.id,
    title: d.title,
    content: d.content,
    tags: d.tags || [],
    createdAt: new Date(d.created_at).getTime(),
    updatedAt: new Date(d.updated_at).getTime(),
  }));
  return [...KEEW_CORPUS, ...remote, ...memory.values()];
}
