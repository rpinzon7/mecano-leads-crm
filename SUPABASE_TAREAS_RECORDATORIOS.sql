-- Ejecutar en Supabase > SQL Editor antes de usar el módulo Mis tareas y recordatorios
create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id text null,
  assigned_to uuid not null,
  created_by uuid null,
  title text not null,
  description text null,
  task_type text not null default 'Hacer seguimiento',
  status text not null default 'Pendiente',
  priority text not null default 'Media',
  task_list text not null default 'Pendientes',
  due_date date null,
  due_time time null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_tasks enable row level security;

drop policy if exists "Users can view their own tasks" on public.crm_tasks;
drop policy if exists "Users can insert their own tasks" on public.crm_tasks;
drop policy if exists "Users can update their own tasks" on public.crm_tasks;
drop policy if exists "Users can delete their own tasks" on public.crm_tasks;

create policy "Users can view their own tasks"
on public.crm_tasks
for select
to authenticated
using (assigned_to = auth.uid());

create policy "Users can insert their own tasks"
on public.crm_tasks
for insert
to authenticated
with check (assigned_to = auth.uid());

create policy "Users can update their own tasks"
on public.crm_tasks
for update
to authenticated
using (assigned_to = auth.uid())
with check (assigned_to = auth.uid());

create policy "Users can delete their own tasks"
on public.crm_tasks
for delete
to authenticated
using (assigned_to = auth.uid());

create index if not exists crm_tasks_assigned_to_due_date_idx
on public.crm_tasks (assigned_to, due_date, status);

create index if not exists crm_tasks_lead_id_idx
on public.crm_tasks (lead_id);

create index if not exists crm_tasks_task_list_idx
on public.crm_tasks (assigned_to, task_list, status);
