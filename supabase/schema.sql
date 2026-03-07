create extension if not exists pgcrypto;

create table if not exists public.crm_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  leads_json jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.crm_workspaces enable row level security;

drop policy if exists "anon read crm_workspaces" on public.crm_workspaces;
drop policy if exists "anon write crm_workspaces" on public.crm_workspaces;

create policy "anon read crm_workspaces"
on public.crm_workspaces
for select
to anon
using (true);

create policy "anon write crm_workspaces"
on public.crm_workspaces
for all
to anon
using (true)
with check (true);
