-- ============================================================
-- KrakenCam - Features Schema
-- Run this in the Supabase SQL Editor (Project > SQL Editor)
-- ============================================================
-- Tables: cal_events, tasks, invitations
-- All tables use Row Level Security (RLS) scoped to organization_id.
-- ============================================================

-- Enable pgcrypto for gen_random_bytes (used for invitation tokens)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. CAL_EVENTS — Calendar events (org-wide or project-linked)
-- ============================================================
CREATE TABLE IF NOT EXISTS cal_events (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  start_at        timestamptz NOT NULL,
  end_at          timestamptz,
  all_day         boolean DEFAULT false,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);

-- Index for fast org-level lookups
CREATE INDEX IF NOT EXISTS cal_events_org_idx     ON cal_events(organization_id);
CREATE INDEX IF NOT EXISTS cal_events_project_idx ON cal_events(project_id);
CREATE INDEX IF NOT EXISTS cal_events_start_idx   ON cal_events(start_at);

-- Enable RLS
ALTER TABLE cal_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies — org-scoped via profiles join
DROP POLICY IF EXISTS "cal_events_select" ON cal_events;
CREATE POLICY "cal_events_select" ON cal_events
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "cal_events_insert" ON cal_events;
CREATE POLICY "cal_events_insert" ON cal_events
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "cal_events_update" ON cal_events;
CREATE POLICY "cal_events_update" ON cal_events
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "cal_events_delete" ON cal_events;
CREATE POLICY "cal_events_delete" ON cal_events
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );


-- ============================================================
-- 2. TASKS — Task / checklist items
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  completed       boolean DEFAULT false,
  assigned_to     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date        date,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS tasks_org_idx     ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks(project_id);

-- Auto-update updated_at trigger
DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies — org-scoped
DROP POLICY IF EXISTS "tasks_select" ON tasks;
CREATE POLICY "tasks_select" ON tasks
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "tasks_delete" ON tasks;
CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );


-- ============================================================
-- 3. INVITATIONS — Team invitation tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS invitations (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           text NOT NULL,
  role            text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  invited_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  token           text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  accepted_at     timestamptz,
  expires_at      timestamptz DEFAULT (now() + interval '7 days'),
  created_at      timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS invitations_org_idx   ON invitations(organization_id);
CREATE INDEX IF NOT EXISTS invitations_email_idx ON invitations(email);
CREATE INDEX IF NOT EXISTS invitations_token_idx ON invitations(token);

-- Enable RLS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: admins can manage their org's invitations
DROP POLICY IF EXISTS "invitations_select" ON invitations;
CREATE POLICY "invitations_select" ON invitations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "invitations_insert" ON invitations;
CREATE POLICY "invitations_insert" ON invitations
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "invitations_update" ON invitations;
CREATE POLICY "invitations_update" ON invitations
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "invitations_delete" ON invitations;
CREATE POLICY "invitations_delete" ON invitations
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Public read by token (so invite links work before login)
DROP POLICY IF EXISTS "invitations_public_token_read" ON invitations;
CREATE POLICY "invitations_public_token_read" ON invitations
  FOR SELECT USING (
    accepted_at IS NULL
    AND expires_at > now()
  );
