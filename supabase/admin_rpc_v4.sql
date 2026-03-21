-- ── Admin RPC v4 — no auth check inside SQL (AdminRoute handles this in UI) ───

drop function if exists public.admin_search_orgs(text);
drop function if exists public.admin_get_org_users(uuid);
drop function if exists public.admin_get_org_notes(uuid);
drop function if exists public.admin_get_org_flag(uuid);
drop function if exists public.admin_get_all_orgs();
drop function if exists public.admin_get_trialing_orgs();
drop function if exists public.is_super_admin_user();

create or replace function public.admin_search_orgs(search_term text)
returns table (
  id uuid, name text, slug text, subscription_tier text,
  subscription_status text, created_at timestamptz
)
language sql security definer set search_path = public
as $$
  select o.id, o.name, o.slug, o.subscription_tier,
         o.subscription_status, o.created_at
  from organizations o
  where o.name ilike '%' || search_term || '%'
  order by o.name limit 20;
$$;
grant execute on function public.admin_search_orgs(text) to authenticated;

create or replace function public.admin_get_org_users(p_org_id uuid)
returns table (
  id uuid, user_id uuid, full_name text, email text,
  role text, created_at timestamptz, is_active boolean
)
language sql security definer set search_path = public
as $$
  select p.id, p.user_id, p.full_name, p.email,
         p.role, p.created_at, p.is_active
  from profiles p
  where p.organization_id = p_org_id
  order by p.created_at;
$$;
grant execute on function public.admin_get_org_users(uuid) to authenticated;

create or replace function public.admin_get_org_notes(p_org_id uuid)
returns table (
  id uuid, org_id uuid, admin_id uuid, note text, created_at timestamptz
)
language sql security definer set search_path = public
as $$
  select n.id, n.org_id, n.admin_id, n.note, n.created_at
  from org_support_notes n
  where n.org_id = p_org_id
  order by n.created_at desc;
$$;
grant execute on function public.admin_get_org_notes(uuid) to authenticated;

create or replace function public.admin_get_org_flag(p_org_id uuid)
returns text
language sql security definer set search_path = public
as $$
  select coalesce(f.flag, 'none')
  from org_flags f
  where f.org_id = p_org_id;
$$;
grant execute on function public.admin_get_org_flag(uuid) to authenticated;

create or replace function public.admin_get_all_orgs()
returns table (
  id uuid, name text, slug text, subscription_tier text,
  subscription_status text, trial_ends_at timestamptz,
  stripe_customer_id text, stripe_subscription_id text,
  created_at timestamptz, custom_admin_price numeric,
  custom_seat_price numeric, custom_price_override boolean
)
language sql security definer set search_path = public
as $$
  select o.id, o.name, o.slug, o.subscription_tier,
         o.subscription_status, o.trial_ends_at,
         o.stripe_customer_id, o.stripe_subscription_id,
         o.created_at, o.custom_admin_price,
         o.custom_seat_price, o.custom_price_override
  from organizations o
  order by o.created_at desc;
$$;
grant execute on function public.admin_get_all_orgs() to authenticated;

create or replace function public.admin_get_trialing_orgs()
returns table (
  id uuid, name text, slug text, subscription_tier text,
  subscription_status text, trial_ends_at timestamptz, created_at timestamptz
)
language sql security definer set search_path = public
as $$
  select o.id, o.name, o.slug, o.subscription_tier,
         o.subscription_status, o.trial_ends_at, o.created_at
  from organizations o
  where o.subscription_status = 'trialing'
  order by o.trial_ends_at asc;
$$;
grant execute on function public.admin_get_trialing_orgs() to authenticated;
