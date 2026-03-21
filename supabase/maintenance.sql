-- App-wide settings table (key/value)
create table if not exists public.app_settings (
  key   text primary key,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- Only super_admins can read/write
alter table public.app_settings enable row level security;

create policy "super_admin_all" on public.app_settings
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'super_admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'super_admin'
    )
  );

-- Seed the maintenance_mode row
insert into public.app_settings (key, value)
values ('maintenance_mode', '{"enabled": false, "message": "We are performing scheduled maintenance. We will be back shortly."}'::jsonb)
on conflict (key) do nothing;

-- Public read function so the app can check maintenance status without auth
-- (needed so logged-out users also see the maintenance screen)
create or replace function public.get_maintenance_mode()
returns jsonb
language sql
security definer
stable
as $$
  select value from public.app_settings where key = 'maintenance_mode';
$$;

grant execute on function public.get_maintenance_mode() to anon, authenticated;
