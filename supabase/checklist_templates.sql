-- ── Checklist Templates table ────────────────────────────────────────────────
-- Org-scoped checklist templates with categories and tags.

create table if not exists public.checklist_templates (
  id            uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name          text not null,
  description   text not null default '',
  category      text not null default 'General',  -- e.g. "Water Damage", "Safety", "Fire"
  tags          text[] not null default '{}',     -- e.g. ["restoration","insurance","mold"]
  fields              jsonb not null default '[]'::jsonb,
  completion_settings jsonb not null default '{}'::jsonb,  -- signature/lock settings
  is_default    boolean not null default false,   -- built-in templates (not deletable)
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.checklist_templates enable row level security;

-- Org members can read their own templates
create policy "org_read_templates" on public.checklist_templates
  for select using (
    exists (select 1 from public.profiles where user_id = auth.uid() and organization_id = checklist_templates.organization_id)
  );

-- Admins/managers can write
create policy "org_write_templates" on public.checklist_templates
  for all using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid()
      and organization_id = checklist_templates.organization_id
      and role in ('admin', 'manager', 'super_admin')
    )
  );
