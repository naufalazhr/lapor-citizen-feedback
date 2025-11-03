-- =============================================================================
-- Fix Conversation Status Migration
-- NOTE: This migration is SUPERSEDED by 20251031000001_fix_conversation_status_with_reports.sql
-- This creates the reusable cleanup function but does NOT fix existing data
-- Use the newer migration (20251031000001) to fix existing conversations
-- =============================================================================
-- Updates existing conversations based on conditions:
-- 1. Has report_id → 'completed'
-- 2. No report_id AND timed out → 'abandoned'
-- 3. No report_id AND within timeout → 'active' (no change)
-- =============================================================================

-- Create reusable function for conversation status cleanup
CREATE OR REPLACE FUNCTION cleanup_conversation_status()
RETURNS TABLE (
  updated_completed INTEGER,
  updated_abandoned INTEGER,
  total_updated INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  timeout_minutes INTEGER;
  cutoff_time TIMESTAMPTZ;
  completed_count INTEGER := 0;
  abandoned_count INTEGER := 0;
BEGIN
  -- Get current timeout setting from active fonnte_config
  SELECT session_timeout_minutes INTO timeout_minutes
  FROM fonnte_config
  WHERE is_active = true
  LIMIT 1;

  -- Default to 30 minutes if not found
  IF timeout_minutes IS NULL THEN
    timeout_minutes := 30;
    RAISE NOTICE 'No active fonnte_config found, using default timeout: 30 minutes';
  ELSE
    RAISE NOTICE 'Using timeout from config: % minutes', timeout_minutes;
  END IF;

  -- Calculate cutoff time
  cutoff_time := NOW() - (timeout_minutes || ' minutes')::INTERVAL;
  RAISE NOTICE 'Cutoff time: %', cutoff_time;

  -- CONDITION 2: Update conversations that have a report → mark as COMPLETED
  UPDATE conversations
  SET
    status = 'completed',
    completed_at = COALESCE(completed_at, NOW())
  WHERE
    status = 'active'
    AND report_id IS NOT NULL;

  GET DIAGNOSTICS completed_count = ROW_COUNT;
  RAISE NOTICE '✓ Marked % conversations as COMPLETED (has report_id)', completed_count;

  -- CONDITION 1: Update conversations without report AND timed out → mark as ABANDONED
  UPDATE conversations
  SET
    status = 'abandoned',
    completed_at = COALESCE(completed_at, NOW())
  WHERE
    status = 'active'
    AND report_id IS NULL
    AND last_message_at < cutoff_time;

  GET DIAGNOSTICS abandoned_count = ROW_COUNT;
  RAISE NOTICE '✓ Marked % conversations as ABANDONED (no report + timed out)', abandoned_count;

  -- CONDITION 3: Conversations without report AND within timeout remain ACTIVE
  -- (No action needed, they stay as is)

  -- Return summary
  RETURN QUERY SELECT
    completed_count,
    abandoned_count,
    completed_count + abandoned_count;
END;
$$;

-- Grant execute permission to service_role (used by Edge Functions)
GRANT EXECUTE ON FUNCTION cleanup_conversation_status() TO service_role;

-- Add helpful comment
COMMENT ON FUNCTION cleanup_conversation_status() IS
'Cleans up conversation statuses based on business rules:
- Conversations with reports → completed
- Conversations without reports that timed out → abandoned
- Conversations without reports within timeout → active (unchanged)
Can be called manually: SELECT * FROM cleanup_conversation_status();';

-- =============================================================================
-- One-time fix for existing conversations
-- COMMENTED OUT - Use migration 20251031000001 instead for proper report matching
-- =============================================================================

-- DO $$
-- DECLARE
--   result RECORD;
-- BEGIN
--   RAISE NOTICE '=============================================================================';
--   RAISE NOTICE 'Starting one-time conversation status cleanup...';
--   RAISE NOTICE '=============================================================================';
--
--   -- Call the cleanup function
--   SELECT * INTO result FROM cleanup_conversation_status();
--
--   RAISE NOTICE '';
--   RAISE NOTICE '=============================================================================';
--   RAISE NOTICE 'Cleanup Summary:';
--   RAISE NOTICE '  - Marked as COMPLETED: %', result.updated_completed;
--   RAISE NOTICE '  - Marked as ABANDONED:  %', result.updated_abandoned;
--   RAISE NOTICE '  - Total Updated:        %', result.total_updated;
--   RAISE NOTICE '=============================================================================';
-- END $$;
