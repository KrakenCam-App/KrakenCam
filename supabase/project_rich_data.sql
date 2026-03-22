-- ── Add rich data columns to projects table ──────────────────────────────────
-- These JSONB columns store all project data that was previously localStorage-only.
-- Everything saves with the project, atomically, per org with RLS.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS rooms          jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS photos         jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reports        jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS checklists     jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS activity_log   jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS portal_config  jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS timeline_stage text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS timeline_notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS client_portal  jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS scratch_pad    text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS photo_tags     jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ba_pairs       jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS client_name    text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_email   text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_phone   text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contractor_name  text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contractor_phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS insurance_company text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS claim_number   text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS adjuster_name  text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS adjuster_phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS deductible     text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS policy_number  text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS color          text NOT NULL DEFAULT '#4a90d9',
  ADD COLUMN IF NOT EXISTS type           text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status         text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS date           text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS scope          text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS manual_gps     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coords         jsonb,
  ADD COLUMN IF NOT EXISTS lat            text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS lng            text NOT NULL DEFAULT '';

-- ── Report templates table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.report_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  type            text NOT NULL DEFAULT '',
  color           text NOT NULL DEFAULT '#4a90d9',
  sections        jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_all_report_templates" ON public.report_templates
  USING (exists (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND organization_id = report_templates.organization_id));

-- ── Team users extended profile ───────────────────────────────────────────────
-- The profiles table has basic info. This extends it with full team member data.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name      text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name       text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone           text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mobile          text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS title           text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS department      text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS employee_id     text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS start_date      text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status          text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS avatar          text,
  ADD COLUMN IF NOT EXISTS notes           text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS certifications  jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS permissions     jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS assigned_projects jsonb NOT NULL DEFAULT '[]'::jsonb;
