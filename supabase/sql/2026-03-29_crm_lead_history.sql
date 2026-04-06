create table if not exists public.crm_lead_history (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null,
  field_name text not null,
  field_label text null,
  old_value text null,
  new_value text null,
  changed_at timestamptz not null default now(),
  changed_by text null,
  change_type text not null default 'update'
);

create index if not exists idx_crm_lead_history_lead_id on public.crm_lead_history (lead_id);
create index if not exists idx_crm_lead_history_changed_at on public.crm_lead_history (changed_at desc);
