-- ═══════════════════════════════════════════════════════════════════════════
--  Keew IA — schema Supabase
--  Rode no SQL Editor do seu projeto. Tudo é opcional: sem Supabase o app
--  funciona 100% local (localStorage + núcleo local).
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── conhecimento (RAG) ──────────────────────────────────────────────────────
create table if not exists public.keew_knowledge (
  id          text primary key,
  title       text not null,
  content     text not null,
  tags        text[] default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists keew_knowledge_fts
  on public.keew_knowledge
  using gin (to_tsvector('portuguese', coalesce(title,'') || ' ' || coalesce(content,'')));

-- ── automações 24/7 ─────────────────────────────────────────────────────────
create table if not exists public.keew_automations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  schedule    text not null default '*/15 * * * *',
  prompt      text not null,
  agent_id    text default 'keew-core',
  enabled     boolean not null default true,
  last_run_at timestamptz,
  last_status text,
  last_result text,
  created_at  timestamptz not null default now()
);

-- ── execuções (observabilidade) ─────────────────────────────────────────────
create table if not exists public.keew_runs (
  id            uuid primary key default gen_random_uuid(),
  automation_id uuid references public.keew_automations(id) on delete cascade,
  status        text not null,
  ms            integer,
  result        text,
  created_at    timestamptz not null default now()
);

create index if not exists keew_runs_created_idx on public.keew_runs (created_at desc);

-- ── conversas (sincronização multi-dispositivo, opcional) ───────────────────
create table if not exists public.keew_chats (
  id          text primary key,
  title       text not null default 'Nova conversa',
  agent_id    text default 'keew-core',
  messages    jsonb not null default '[]'::jsonb,
  pinned      boolean default false,
  owner       uuid references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists keew_chats_owner_idx on public.keew_chats (owner, updated_at desc);

-- ── telemetria de uso (agregada, sem conteúdo) ──────────────────────────────
create table if not exists public.keew_usage (
  id          bigserial primary key,
  day         date not null default current_date,
  messages    integer not null default 0,
  tokens_in   integer not null default 0,
  tokens_out  integer not null default 0,
  unique (day)
);

-- ═══════════════════════════════════════════════════════════════════════════
--  RLS — cada usuário vê só o que é dele; o service role (server) ignora.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.keew_chats enable row level security;
drop policy if exists keew_chats_owner_all on public.keew_chats;
create policy keew_chats_owner_all on public.keew_chats
  for all using (auth.uid() = owner) with check (auth.uid() = owner);

-- conhecimento e automações são do workspace: leitura autenticada, escrita via server
alter table public.keew_knowledge enable row level security;
drop policy if exists keew_knowledge_read on public.keew_knowledge;
create policy keew_knowledge_read on public.keew_knowledge
  for select using (auth.role() = 'authenticated');

alter table public.keew_automations enable row level security;
drop policy if exists keew_automations_read on public.keew_automations;
create policy keew_automations_read on public.keew_automations
  for select using (auth.role() = 'authenticated');

-- ── seeds opcionais ─────────────────────────────────────────────────────────
insert into public.keew_automations (name, schedule, prompt, agent_id, enabled)
values
  ('Briefing diário', '0 11 * * *',
   'Gere o briefing diário da Keew IA: 3 destaques, 1 risco, 1 ação para hoje.', 'analista', true),
  ('Vigia de infraestrutura', '*/30 * * * *',
   'Liste riscos operacionais ativos do app e proponha mitigação para cada um.', 'engenheiro', true)
on conflict do nothing;

-- ── função utilitária: busca textual simples ────────────────────────────────
create or replace function public.keew_search_knowledge(q text, lim int default 5)
returns table (id text, title text, snippet text, rank real)
language sql stable as $$
  select k.id, k.title,
         ts_headline('portuguese', k.content, plainto_tsquery('portuguese', q),
                     'MaxWords=60, MinWords=20') as snippet,
         ts_rank(to_tsvector('portuguese', k.title || ' ' || k.content),
                 plainto_tsquery('portuguese', q)) as rank
  from public.keew_knowledge k
  where to_tsvector('portuguese', k.title || ' ' || k.content) @@ plainto_tsquery('portuguese', q)
  order by rank desc
  limit lim;
$$;
