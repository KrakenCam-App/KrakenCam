-- ── Client Portal public lookup ───────────────────────────────────────────────
-- Clients access their portal via /client-portal/[slug]
-- This RPC is public (anon key) — returns only portal-approved data.

create or replace function public.get_portal_by_slug(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id text;
  v_org_id     uuid;
  v_portal     jsonb;
  v_project    jsonb;
  v_settings   jsonb;
begin
  -- Find the project by portal slug stored in client_portal JSONB
  -- Slug is stored in organizations' projects via localStorage in the current build.
  -- Since projects live in localStorage (not yet in Supabase), we store portals
  -- in a dedicated table for public access.
  
  select
    pp.project_data,
    pp.org_id,
    pp.portal_config,
    jsonb_build_object(
      'companyName', o.name,
      'accent', pp.brand_color
    )
  into v_project, v_org_id, v_portal, v_settings
  from public.published_portals pp
  join public.organizations o on o.id = pp.org_id
  where pp.slug = p_slug
    and pp.active = true;

  if v_project is null then
    return null;
  end if;

  return jsonb_build_object(
    'project',  v_project,
    'portal',   v_portal,
    'settings', v_settings
  );
end;
$$;

grant execute on function public.get_portal_by_slug(text) to anon, authenticated;

-- ── Published portals table ───────────────────────────────────────────────────
-- When a contractor publishes a portal, we snapshot the approved data here
-- so clients can access it without auth.

create table if not exists public.published_portals (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  org_id       uuid not null references public.organizations(id) on delete cascade,
  project_id   text not null,  -- local project ID
  project_data jsonb not null default '{}'::jsonb,  -- snapshot of portal-approved project data
  portal_config jsonb not null default '{}'::jsonb, -- portal settings (sharePhotos, password, etc.)
  brand_color  text default '#2b7fe8',
  active       boolean not null default true,
  published_at timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.published_portals enable row level security;

-- Public read (clients need to read their portal)
create policy "public_read_active_portals" on public.published_portals
  for select using (active = true);

-- Org members can write their own portals
create policy "org_member_write_portals" on public.published_portals
  for all using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid()
      and organization_id = published_portals.org_id
    )
  );
