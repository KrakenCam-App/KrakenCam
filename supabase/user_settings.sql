-- ── User settings table ───────────────────────────────────────────────────────
-- Personal settings per user (name, avatar, title, phone, preferences).
-- Separate from org_settings so team members don't overwrite each other.

create table if not exists public.user_settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  settings   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

-- Users can only read/write their own settings
create policy "own_user_settings" on public.user_settings
  for all using (auth.uid() = user_id);
