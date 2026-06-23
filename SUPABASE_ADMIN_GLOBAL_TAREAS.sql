-- CRM Mecano V6.32 - Administrador global de tareas
-- Ejecutar una sola vez en Supabase > SQL Editor.
-- Después de ejecutar este script, agrega los usuarios reales en la tabla public.crm_task_users.

create table if not exists public.crm_task_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null default 'user' check (role in ('user','task_admin','admin')),
  active boolean not null default true,
  can_delete_tasks boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_task_users add column if not exists email text;
alter table public.crm_task_users add column if not exists full_name text;
alter table public.crm_task_users add column if not exists role text not null default 'user';
alter table public.crm_task_users add column if not exists active boolean not null default true;
alter table public.crm_task_users add column if not exists can_delete_tasks boolean not null default false;
alter table public.crm_task_users add column if not exists created_at timestamptz not null default now();
alter table public.crm_task_users add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists crm_task_users_set_updated_at on public.crm_task_users;
create trigger crm_task_users_set_updated_at
before update on public.crm_task_users
for each row execute function public.set_updated_at();

-- Función de seguridad para validar si el usuario actual administra tareas.
-- SECURITY DEFINER evita problemas de recursión con RLS.
create or replace function public.is_task_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.crm_task_users u
    where u.user_id = check_user_id
      and u.active = true
      and u.role in ('task_admin','admin')
  );
$$;

create or replace function public.can_delete_crm_tasks(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.crm_task_users u
    where u.user_id = check_user_id
      and u.active = true
      and (u.role in ('task_admin','admin') or u.can_delete_tasks = true)
  );
$$;

alter table public.crm_task_users enable row level security;

drop policy if exists "Task users can view active users" on public.crm_task_users;
drop policy if exists "Task admins can manage users" on public.crm_task_users;

create policy "Task users can view active users"
on public.crm_task_users
for select
to authenticated
using (active = true or user_id = auth.uid() or public.is_task_admin());

create policy "Task admins can manage users"
on public.crm_task_users
for all
to authenticated
using (public.is_task_admin())
with check (public.is_task_admin());

-- Asegurar columnas de tareas existentes.
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

alter table public.crm_tasks add column if not exists lead_id text null;
alter table public.crm_tasks add column if not exists assigned_to uuid;
alter table public.crm_tasks add column if not exists created_by uuid null;
alter table public.crm_tasks add column if not exists title text;
alter table public.crm_tasks add column if not exists description text null;
alter table public.crm_tasks add column if not exists task_type text not null default 'Hacer seguimiento';
alter table public.crm_tasks add column if not exists status text not null default 'Pendiente';
alter table public.crm_tasks add column if not exists priority text not null default 'Media';
alter table public.crm_tasks add column if not exists task_list text not null default 'Pendientes';
alter table public.crm_tasks add column if not exists due_date date null;
alter table public.crm_tasks add column if not exists due_time time null;
alter table public.crm_tasks add column if not exists completed_at timestamptz null;
alter table public.crm_tasks add column if not exists created_at timestamptz not null default now();
alter table public.crm_tasks add column if not exists updated_at timestamptz not null default now();

alter table public.crm_tasks enable row level security;

drop trigger if exists crm_tasks_set_updated_at on public.crm_tasks;
create trigger crm_tasks_set_updated_at
before update on public.crm_tasks
for each row execute function public.set_updated_at();

-- Reemplazar políticas antiguas de solo tareas propias por políticas con administrador global.
drop policy if exists "Users can view their own tasks" on public.crm_tasks;
drop policy if exists "Users can insert their own tasks" on public.crm_tasks;
drop policy if exists "Users can update their own tasks" on public.crm_tasks;
drop policy if exists "Users can delete their own tasks" on public.crm_tasks;
drop policy if exists "Users and task admins can view tasks" on public.crm_tasks;
drop policy if exists "Users and task admins can create tasks" on public.crm_tasks;
drop policy if exists "Users and task admins can update tasks" on public.crm_tasks;
drop policy if exists "Users and task admins can delete tasks" on public.crm_tasks;

create policy "Users and task admins can view tasks"
on public.crm_tasks
for select
to authenticated
using (assigned_to = auth.uid() or public.is_task_admin());

create policy "Users and task admins can create tasks"
on public.crm_tasks
for insert
to authenticated
with check (
  assigned_to = auth.uid()
  or public.is_task_admin()
);

create policy "Users and task admins can update tasks"
on public.crm_tasks
for update
to authenticated
using (assigned_to = auth.uid() or public.is_task_admin())
with check (assigned_to = auth.uid() or public.is_task_admin());

create policy "Users and task admins can delete tasks"
on public.crm_tasks
for delete
to authenticated
using (assigned_to = auth.uid() or public.can_delete_crm_tasks());

create index if not exists crm_task_users_email_idx on public.crm_task_users (email);
create index if not exists crm_task_users_role_idx on public.crm_task_users (role, active);
create index if not exists crm_tasks_assigned_to_due_date_idx on public.crm_tasks (assigned_to, due_date, status);
create index if not exists crm_tasks_created_by_idx on public.crm_tasks (created_by);
create index if not exists crm_tasks_lead_id_idx on public.crm_tasks (lead_id);
create index if not exists crm_tasks_task_list_idx on public.crm_tasks (assigned_to, task_list, status);

-- IMPORTANTE: agrega manualmente los usuarios desde Table Editor o con INSERT.
-- Ejemplo para convertir un usuario en administrador de tareas:
-- insert into public.crm_task_users (user_id, email, full_name, role, active, can_delete_tasks)
-- values ('PEGA_AQUI_EL_USER_ID_AUTH', 'usuario@mecano-ft.com', 'Nombre Usuario', 'task_admin', true, true)
-- on conflict (user_id) do update set email=excluded.email, full_name=excluded.full_name, role=excluded.role, active=excluded.active, can_delete_tasks=excluded.can_delete_tasks;
--
-- Ejemplo para usuario comercial normal:
-- insert into public.crm_task_users (user_id, email, full_name, role, active, can_delete_tasks)
-- values ('PEGA_AQUI_EL_USER_ID_AUTH', 'comercial@mecano-ft.com', 'Nombre Comercial', 'user', true, false)
-- on conflict (user_id) do update set email=excluded.email, full_name=excluded.full_name, role=excluded.role, active=excluded.active, can_delete_tasks=excluded.can_delete_tasks;
