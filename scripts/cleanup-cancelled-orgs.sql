-- =============================================================================
-- KrakenCam - Scheduled Data Deletion Job
-- =============================================================================
-- Deletes all data for organizations that:
--   1. Have subscription_status = 'cancelled'
--   2. Have data_delete_at <= NOW() (60 days after cancellation)
--
-- Run this as a Supabase scheduled function (pg_cron) or via an external cron
-- job using the service role key.
--
-- Schedule recommendation: Daily at 02:00 UTC
-- pg_cron syntax: '0 2 * * *'
--
-- SECURITY: This script must run with service role (bypasses RLS).
-- DO NOT run this with an anon key or user JWT.
-- =============================================================================

-- =============================================================================
-- FUNCTION: cleanup_cancelled_orgs
-- Wraps the deletion logic in a transaction with audit logging.
-- =============================================================================
CREATE OR REPLACE FUNCTION cleanup_cancelled_orgs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_record   RECORD;
  deleted_count integer := 0;
BEGIN
  -- Find all orgs eligible for deletion
  FOR org_record IN
    SELECT id, name, slug, cancelled_at, data_delete_at
    FROM organizations
    WHERE
      subscription_status = 'cancelled'
      AND data_delete_at IS NOT NULL
      AND data_delete_at <= NOW()
  LOOP
    BEGIN
      -- Log the deletion BEFORE we delete (so we have a record)
      INSERT INTO audit_log (event_type, target_id, target_type, details)
      VALUES (
        'org_data_deleted',
        org_record.id,
        'organization',
        jsonb_build_object(
          'org_name',      org_record.name,
          'org_slug',      org_record.slug,
          'cancelled_at',  org_record.cancelled_at,
          'data_delete_at', org_record.data_delete_at,
          'deleted_at',    NOW()
        )
      );

      -- -----------------------------------------------------------------------
      -- Delete in FK-safe order (children before parents)
      -- -----------------------------------------------------------------------

      -- 1. AI usage records
      DELETE FROM ai_usage
      WHERE organization_id = org_record.id;

      -- 2. Pictures (before folders)
      DELETE FROM pictures
      WHERE organization_id = org_record.id;

      -- 3. Picture folders (before projects)
      DELETE FROM picture_folders
      WHERE organization_id = org_record.id;

      -- 4. Projects
      DELETE FROM projects
      WHERE organization_id = org_record.id;

      -- 5. Subscriptions
      DELETE FROM subscriptions
      WHERE organization_id = org_record.id;

      -- 6. Profiles (before organization, due to FK)
      DELETE FROM profiles
      WHERE organization_id = org_record.id;

      -- 7. Finally, delete the organization itself
      -- Note: ON DELETE CASCADE handles any remaining FK children automatically,
      -- but we delete explicitly above for audit clarity and Storage cleanup hooks.
      DELETE FROM organizations
      WHERE id = org_record.id;

      deleted_count := deleted_count + 1;

      RAISE NOTICE 'Deleted org: % (id: %)', org_record.name, org_record.id;

    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue with other orgs
      INSERT INTO audit_log (event_type, target_id, target_type, details)
      VALUES (
        'org_data_deletion_failed',
        org_record.id,
        'organization',
        jsonb_build_object(
          'error',   SQLERRM,
          'errcode', SQLSTATE
        )
      );
      RAISE WARNING 'Failed to delete org %: % (SQLSTATE: %)',
        org_record.id, SQLERRM, SQLSTATE;
    END;
  END LOOP;

  RETURN deleted_count;
END;
$$;

-- =============================================================================
-- FUNCTION: preview_deletion_candidates
-- Run this to see what WOULD be deleted without actually deleting anything.
-- Useful for auditing before enabling the scheduled job.
-- =============================================================================
CREATE OR REPLACE FUNCTION preview_deletion_candidates()
RETURNS TABLE (
  org_id        uuid,
  org_name      text,
  cancelled_at  timestamptz,
  data_delete_at timestamptz,
  days_overdue  integer,
  profile_count bigint,
  project_count bigint,
  picture_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.name,
    o.cancelled_at,
    o.data_delete_at,
    EXTRACT(DAY FROM NOW() - o.data_delete_at)::integer AS days_overdue,
    (SELECT COUNT(*) FROM profiles    WHERE organization_id = o.id),
    (SELECT COUNT(*) FROM projects    WHERE organization_id = o.id),
    (SELECT COUNT(*) FROM pictures    WHERE organization_id = o.id)
  FROM organizations o
  WHERE
    o.subscription_status = 'cancelled'
    AND o.data_delete_at IS NOT NULL
    AND o.data_delete_at <= NOW()
  ORDER BY o.data_delete_at ASC;
$$;

-- =============================================================================
-- SCHEDULE WITH pg_cron (run in Supabase SQL editor)
-- Requires pg_cron extension - enable it in Supabase dashboard first:
-- Dashboard → Database → Extensions → pg_cron → Enable
-- =============================================================================

-- Enable pg_cron (run once):
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup at 2 AM UTC:
-- SELECT cron.schedule(
--   'cleanup-cancelled-orgs',
--   '0 2 * * *',
--   $$ SELECT cleanup_cancelled_orgs(); $$
-- );

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule:
-- SELECT cron.unschedule('cleanup-cancelled-orgs');

-- =============================================================================
-- MANUAL RUN (for testing or one-off cleanup)
-- =============================================================================
-- Preview what would be deleted:
-- SELECT * FROM preview_deletion_candidates();

-- Run the deletion:
-- SELECT cleanup_cancelled_orgs();

-- Check audit log:
-- SELECT * FROM audit_log WHERE event_type IN ('org_data_deleted', 'org_data_deletion_failed')
-- ORDER BY created_at DESC LIMIT 50;

-- =============================================================================
-- NOTE ON SUPABASE STORAGE
-- =============================================================================
-- This SQL function deletes the database rows, but Supabase Storage objects
-- (the actual image/video files) must be deleted separately.
-- 
-- Option 1: Set up a Supabase Storage lifecycle policy (if available in your plan)
-- Option 2: Add a PostgreSQL trigger on pictures DELETE that calls
--           the Supabase Storage API via pg_net (HTTP extension)
-- Option 3: Run a separate cleanup script that lists and deletes storage objects
--           for the org's folder: storage/project-photos/{org_id}/
--
-- Recommended: Call the Storage cleanup from your scheduled cleanup job
-- using the Supabase Management API with the service role key.
