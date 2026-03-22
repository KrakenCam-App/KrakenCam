-- ── Client portal notifications ──────────────────────────────────────────────
-- Written by the public portal page when a client sends a note.
-- Read by the main app via Realtime to notify admins/managers.

create table if not exists public.portal_notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id      text not null,
  project_title   text not null default '',
  slug            text not null,
  client_note     text not null,
  created_at      timestamptz not null default now(),
  read_by         uuid[] not null default '{}'  -- user_ids who dismissed it
);

alter table public.portal_notifications enable row level security;

-- Anyone (anon) can insert — client portal is public
create policy "anon_insert_portal_notif" on public.portal_notifications
  for insert with check (true);

-- Org members can read their own org's notifications
create policy "org_read_portal_notif" on public.portal_notifications
  for select using (
    exists (select 1 from public.profiles where user_id = auth.uid() and organization_id = portal_notifications.organization_id)
  );

-- Org members can update (mark as read)
create policy "org_update_portal_notif" on public.portal_notifications
  for update using (
    exists (select 1 from public.profiles where user_id = auth.uid() and organization_id = portal_notifications.organization_id)
  );
