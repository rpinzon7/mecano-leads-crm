-- CRM Mecano V6.31.2
-- Responsables editables para alertas de tareas vencidas.
-- Ejecutar una sola vez en Supabase SQL Editor.

create table if not exists public.crm_alert_recipients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  whatsapp text,
  role text,
  active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists crm_alert_recipients_name_unique
on public.crm_alert_recipients (name);

alter table public.crm_alert_recipients enable row level security;

drop policy if exists "crm_alert_recipients_select_authenticated" on public.crm_alert_recipients;
create policy "crm_alert_recipients_select_authenticated"
on public.crm_alert_recipients
for select
to authenticated
using (true);

drop policy if exists "crm_alert_recipients_insert_authenticated" on public.crm_alert_recipients;
create policy "crm_alert_recipients_insert_authenticated"
on public.crm_alert_recipients
for insert
to authenticated
with check (true);

drop policy if exists "crm_alert_recipients_update_authenticated" on public.crm_alert_recipients;
create policy "crm_alert_recipients_update_authenticated"
on public.crm_alert_recipients
for update
to authenticated
using (true)
with check (true);

drop policy if exists "crm_alert_recipients_delete_authenticated" on public.crm_alert_recipients;
create policy "crm_alert_recipients_delete_authenticated"
on public.crm_alert_recipients
for delete
to authenticated
using (true);

insert into public.crm_alert_recipients (name, email, whatsapp, role, active, is_default)
values
  ('Ricardo Pinzón', '', '', 'Dirección', true, true),
  ('Alejandra Carmona', '', '', 'Administración', true, true),
  ('Luz Dary Posada', '', '', 'Comercial', true, true),
  ('Armando Pérez', '', '', 'Comercial', true, true),
  ('Manuela Peña', '', '', 'Contabilidad', true, true)
on conflict (name) do nothing;
