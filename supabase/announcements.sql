-- ── App Announcements table ──────────────────────────────────────────────────
-- Used for maintenance notices, feature announcements, etc.
-- Admins create them; the app checks on load and shows a dismissible popup.

create table if not exists public.app_announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null default '',
  message      text not null default '',
  -- Optional scheduled window (shown between these times, null = always active)
  scheduled_date date,          -- e.g. 2026-03-25
  start_time   time,             -- e.g. 02:00
  end_time     time,             -- e.g. 04:00
  -- Who sees it
  target       text not null default 'all', -- 'all' | 'admins' | 'managers'
  -- Manual on/off
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id),
  updated_at   timestamptz not null default now()
);

-- Only super_admins can write; authenticated users can read active ones
alter table public.app_announcements enable row level security;

create policy "super_admin_write" on public.app_announcements
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin')
  );

create policy "authenticated_read" on public.app_announcements
  for select using (auth.role() = 'authenticated');

-- Public function so logged-out users (and anon) can also see announcements
create or replace function public.get_active_announcements()
returns jsonb
language sql
security definer
stable
as $$
  select coalesce(
    jsonb_agg(row_to_json(a) order by a.created_at desc),
    '[]'::jsonb
  )
  from public.app_announcements a
  where a.active = true;
$$;

grant execute on function public.get_active_announcements() to anon, authenticated;
