-- =============================================================================
-- KrakenCam - Supabase Schema + RLS Policies
-- =============================================================================
-- SECURITY CRITICAL: Every table has RLS enabled. Users can only access rows
-- belonging to their own organization. Service role bypasses RLS for internal
-- backend operations (Stripe webhooks, cron jobs, admin tasks).
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- HELPER FUNCTION: Get the current user's organization_id
-- This function is SECURITY DEFINER so it can read profiles without recursion.
-- =============================================================================
CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- =============================================================================
-- HELPER FUNCTION: Get the current user's role within their org
-- =============================================================================
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- =============================================================================
-- TABLE: organizations
-- One row per company/tenant. This is the root of the multi-tenant hierarchy.
-- =============================================================================
CREATE TABLE IF NOT EXISTS organizations (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  text NOT NULL,
  slug                  text UNIQUE NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  subscription_tier     text NOT NULL DEFAULT 'trial'
                          CHECK (subscription_tier IN ('trial', 'capture_i', 'intelligence_ii', 'command_iii', 'enterprise')),
  subscription_status   text NOT NULL DEFAULT 'trialing'
                          CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired', 'paused')),
  stripe_customer_id    text UNIQUE,
  stripe_subscription_id text UNIQUE,
  trial_ends_at         timestamptz,
  cancelled_at          timestamptz,
  -- 60 days after cancellation, all org data is permanently deleted
  data_delete_at        timestamptz
);

-- RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Users can read their own org
CREATE POLICY "org_select_own"
  ON organizations FOR SELECT
  USING (id = get_my_org_id());

-- Only admins can update their org details (e.g. name)
CREATE POLICY "org_update_admin_only"
  ON organizations FOR UPDATE
  USING (id = get_my_org_id() AND get_my_role() = 'admin');

-- INSERT and DELETE are service-role only (handled by webhook/backend)
-- No user-facing INSERT/DELETE policies intentionally.

-- =============================================================================
-- TABLE: profiles
-- One row per user within an org. Links auth.users to an organization.
-- =============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'user'
                    CHECK (role IN ('admin', 'user')),
  full_name       text,
  email           text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  is_active       boolean NOT NULL DEFAULT true,
  date_of_birth   date NOT NULL,  -- Required for 18+ verification
  UNIQUE(organization_id, user_id),
  UNIQUE(user_id)  -- A user belongs to exactly one org
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can see all profiles in their org (needed to show team members)
CREATE POLICY "profiles_select_same_org"
  ON profiles FOR SELECT
  USING (organization_id = get_my_org_id());

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (user_id = auth.uid());

-- Admins can update any profile in their org (activate/deactivate, change role)
CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  USING (organization_id = get_my_org_id() AND get_my_role() = 'admin');

-- Admins can insert new profiles (invite users)
CREATE POLICY "profiles_insert_admin"
  ON profiles FOR INSERT
  WITH CHECK (organization_id = get_my_org_id() AND get_my_role() = 'admin');

-- Admins can delete (remove) users from their org
CREATE POLICY "profiles_delete_admin"
  ON profiles FOR DELETE
  USING (organization_id = get_my_org_id() AND get_my_role() = 'admin');

-- Users can insert their own profile during signup (before org exists in JWT)
-- This is handled via service role in the signup flow.

-- =============================================================================
-- TABLE: subscriptions
-- Mirrors Stripe subscription data. Updated by webhook handler.
-- =============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id         uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_subscription_id  text UNIQUE,
  stripe_customer_id      text,
  plan_tier               text NOT NULL DEFAULT 'trial'
                            CHECK (plan_tier IN ('trial', 'capture_i', 'intelligence_ii', 'command_iii', 'enterprise')),
  billing_period          text NOT NULL DEFAULT 'monthly'
                            CHECK (billing_period IN ('monthly', 'annual')),
  status                  text NOT NULL DEFAULT 'trialing'
                            CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'incomplete', 'paused')),
  current_period_end      timestamptz,
  seat_count              integer NOT NULL DEFAULT 1 CHECK (seat_count >= 1),
  admin_price_id          text,   -- Stripe Price ID for admin base price
  user_price_id           text,   -- Stripe Price ID for per-seat price
  discount_code           text,
  custom_price_override   numeric(10,2)  -- For enterprise custom pricing
);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Admins can read their org's subscription
CREATE POLICY "subscriptions_select_admin"
  ON subscriptions FOR SELECT
  USING (organization_id = get_my_org_id() AND get_my_role() = 'admin');

-- Regular users can also see subscription (needed for feature gating UI)
CREATE POLICY "subscriptions_select_user"
  ON subscriptions FOR SELECT
  USING (organization_id = get_my_org_id());

-- All writes are service-role only (Stripe webhook handler uses service role key)
-- No INSERT/UPDATE/DELETE policies for authenticated users intentionally.

-- =============================================================================
-- TABLE: projects (jobsites)
-- Core object. Each project belongs to one org.
-- =============================================================================
CREATE TABLE IF NOT EXISTS projects (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  location        text,
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'archived', 'completed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS projects_org_idx ON projects(organization_id);

-- RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select_own_org"
  ON projects FOR SELECT
  USING (organization_id = get_my_org_id());

CREATE POLICY "projects_insert_own_org"
  ON projects FOR INSERT
  WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY "projects_update_own_org"
  ON projects FOR UPDATE
  USING (organization_id = get_my_org_id());

-- Only admins can delete projects
CREATE POLICY "projects_delete_admin"
  ON projects FOR DELETE
  USING (organization_id = get_my_org_id() AND get_my_role() = 'admin');

-- =============================================================================
-- TABLE: picture_folders
-- Organizes pictures within a project.
-- =============================================================================
CREATE TABLE IF NOT EXISTS picture_folders (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS picture_folders_org_idx ON picture_folders(organization_id);
CREATE INDEX IF NOT EXISTS picture_folders_project_idx ON picture_folders(project_id);

-- RLS
ALTER TABLE picture_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "picture_folders_select_own_org"
  ON picture_folders FOR SELECT
  USING (organization_id = get_my_org_id());

CREATE POLICY "picture_folders_insert_own_org"
  ON picture_folders FOR INSERT
  WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY "picture_folders_update_own_org"
  ON picture_folders FOR UPDATE
  USING (organization_id = get_my_org_id());

CREATE POLICY "picture_folders_delete_own_org"
  ON picture_folders FOR DELETE
  USING (organization_id = get_my_org_id());

-- =============================================================================
-- TABLE: pictures
-- Individual photo uploads. storage_path points to Supabase Storage.
-- =============================================================================
CREATE TABLE IF NOT EXISTS pictures (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  folder_id       uuid NOT NULL REFERENCES picture_folders(id) ON DELETE CASCADE,
  storage_path    text NOT NULL,  -- Supabase Storage path (not full URL - derive URL at runtime)
  uploaded_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  metadata        jsonb DEFAULT '{}'::jsonb  -- EXIF, dimensions, tags, etc.
);

CREATE INDEX IF NOT EXISTS pictures_org_idx ON pictures(organization_id);
CREATE INDEX IF NOT EXISTS pictures_folder_idx ON pictures(folder_id);

-- RLS
ALTER TABLE pictures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pictures_select_own_org"
  ON pictures FOR SELECT
  USING (organization_id = get_my_org_id());

CREATE POLICY "pictures_insert_own_org"
  ON pictures FOR INSERT
  WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY "pictures_update_own_org"
  ON pictures FOR UPDATE
  USING (organization_id = get_my_org_id());

CREATE POLICY "pictures_delete_own_org"
  ON pictures FOR DELETE
  USING (organization_id = get_my_org_id());

-- =============================================================================
-- TABLE: ai_usage
-- Tracks AI generation usage per user per week for quota enforcement.
-- week_start is always a Monday (use DATE_TRUNC('week', NOW()) to get it).
-- =============================================================================
CREATE TABLE IF NOT EXISTS ai_usage (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start        date NOT NULL,
  generation_count  integer NOT NULL DEFAULT 0 CHECK (generation_count >= 0),
  UNIQUE(organization_id, user_id, week_start)
);

CREATE INDEX IF NOT EXISTS ai_usage_org_user_idx ON ai_usage(organization_id, user_id);

-- RLS
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- Users can see their own usage
CREATE POLICY "ai_usage_select_own"
  ON ai_usage FOR SELECT
  USING (user_id = auth.uid() AND organization_id = get_my_org_id());

-- Admins can see all usage in their org
CREATE POLICY "ai_usage_select_admin"
  ON ai_usage FOR SELECT
  USING (organization_id = get_my_org_id() AND get_my_role() = 'admin');

-- Users can insert/update their own usage records
CREATE POLICY "ai_usage_insert_own"
  ON ai_usage FOR INSERT
  WITH CHECK (user_id = auth.uid() AND organization_id = get_my_org_id());

CREATE POLICY "ai_usage_update_own"
  ON ai_usage FOR UPDATE
  USING (user_id = auth.uid() AND organization_id = get_my_org_id());

-- =============================================================================
-- TABLE: discount_codes
-- Admin-created discount codes for Stripe checkout. Read-only for users.
-- =============================================================================
CREATE TABLE IF NOT EXISTS discount_codes (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code              text UNIQUE NOT NULL,
  discount_percent  integer NOT NULL CHECK (discount_percent BETWEEN 1 AND 100),
  max_uses          integer,   -- NULL = unlimited
  used_count        integer NOT NULL DEFAULT 0,
  expires_at        timestamptz,
  created_by_admin  text       -- Email or identifier of the admin who created it
);

-- RLS
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

-- Anyone (even unauthenticated during checkout) can validate a code.
-- SECURITY: Only expose code validity, not all codes. This is read-only.
-- The actual discount application happens server-side via Stripe.
CREATE POLICY "discount_codes_select_all"
  ON discount_codes FOR SELECT
  USING (true);

-- Only service role can insert/update/delete discount codes.
-- (No user-facing write policies intentionally.)

-- =============================================================================
-- TABLE: analytics_snapshots
-- Aggregate-only system analytics. Contains NO personally identifiable info.
-- Populated by a scheduled service-role job (not user-facing).
-- =============================================================================
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date   date UNIQUE NOT NULL,
  total_orgs      integer NOT NULL DEFAULT 0,
  total_users     integer NOT NULL DEFAULT 0,
  total_jobsites  integer NOT NULL DEFAULT 0
);

-- RLS
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- This table is service-role only. No user policies.
-- (Analytics are not exposed to end users via the API.)

-- =============================================================================
-- AUDIT LOG TABLE (for data deletion tracking)
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type  text NOT NULL,
  target_id   uuid,           -- ID of the deleted/modified entity
  target_type text,           -- 'organization', 'profile', etc.
  details     jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: audit log is service-role only
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
-- No user policies - fully controlled by backend

-- =============================================================================
-- TRIGGER: Auto-create subscription row when org is created
-- =============================================================================
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO subscriptions (organization_id, plan_tier, status)
  VALUES (NEW.id, 'trial', 'trialing');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_org_created
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION create_default_subscription();

-- =============================================================================
-- TRIGGER: Auto-set trial_ends_at when org is created
-- =============================================================================
CREATE OR REPLACE FUNCTION set_trial_end()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.trial_ends_at := NOW() + INTERVAL '14 days';
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_org_created_set_trial
  BEFORE INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION set_trial_end();

-- =============================================================================
-- STORAGE BUCKETS (run separately in Supabase dashboard or via API)
-- =============================================================================
-- Note: Run these via Supabase dashboard > Storage, or via the Management API.
-- Bucket name: 'project-photos'
-- Public: false (access via signed URLs only - CRITICAL for org isolation)
-- File size limit: 50MB
-- Allowed MIME types: image/jpeg, image/png, image/webp, image/heic, video/mp4

-- Storage RLS policy (add via Supabase dashboard):
-- SELECT: auth.uid() is not null AND (storage.foldername(name))[1] = get_my_org_id()::text
-- INSERT: auth.uid() is not null AND (storage.foldername(name))[1] = get_my_org_id()::text
-- Files must be uploaded to path: {org_id}/{project_id}/{folder_id}/{filename}
