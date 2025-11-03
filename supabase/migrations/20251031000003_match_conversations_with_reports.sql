-- =============================================================================
-- Match Conversations with Reports and Update Status
--
-- Prerequisites: Run 20251031000002_swap_phone_device_columns.sql FIRST
--
-- This migration:
-- 1. Matches conversations with reports using phone_number (after swap fix)
-- 2. Links conversations.report_id with the matched report
-- 3. Marks conversations as 'completed' if report exists
-- 4. Marks conversations as 'abandoned' if no report exists
-- =============================================================================

DO $$
DECLARE
  completed_count INTEGER := 0;
  abandoned_count INTEGER := 0;
  matched_reports RECORD;
BEGIN
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'Starting conversation-report matching...';
  RAISE NOTICE '=============================================================================';

  -- Step 1: Match conversations with reports and mark as COMPLETED
  RAISE NOTICE '';
  RAISE NOTICE 'Step 1: Matching conversations with reports by phone_number...';

  FOR matched_reports IN
    WITH matched AS (
      SELECT DISTINCT ON (c.id)
        c.id AS conversation_id,
        r.id AS report_id,
        c.phone_number,
        c.started_at AS conv_started,
        c.last_message_at AS conv_last_message,
        r.created_at AS report_created
      FROM conversations c
      INNER JOIN reports r ON c.phone_number = r.phone  -- Now using correct column!
      WHERE
        -- Report was created during or shortly after the conversation
        r.created_at >= c.started_at
        AND r.created_at <= c.last_message_at + INTERVAL '5 minutes'
      ORDER BY c.id, r.created_at DESC
    )
    SELECT * FROM matched
  LOOP
    -- Update conversation with report_id and mark as completed
    UPDATE conversations
    SET
      report_id = matched_reports.report_id,
      status = 'completed',
      completed_at = COALESCE(completed_at, matched_reports.report_created)
    WHERE id = matched_reports.conversation_id;

    completed_count := completed_count + 1;

    RAISE NOTICE '  ✓ Conversation % (phone: %) → COMPLETED (report: %)',
      matched_reports.conversation_id,
      matched_reports.phone_number,
      matched_reports.report_id;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'Step 2: Marking conversations without reports as ABANDONED...';

  -- Step 2: Mark all remaining conversations (without report_id) as ABANDONED
  UPDATE conversations
  SET
    status = 'abandoned',
    completed_at = COALESCE(completed_at, last_message_at)
  WHERE report_id IS NULL;

  GET DIAGNOSTICS abandoned_count = ROW_COUNT;

  -- Summary
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'Matching Summary:';
  RAISE NOTICE '  - Conversations marked as COMPLETED: %', completed_count;
  RAISE NOTICE '  - Conversations marked as ABANDONED:  %', abandoned_count;
  RAISE NOTICE '  - Total conversations processed:      %', completed_count + abandoned_count;
  RAISE NOTICE '=============================================================================';

  -- Verification
  RAISE NOTICE '';
  RAISE NOTICE 'Verification:';

  DECLARE
    status_check RECORD;
  BEGIN
    FOR status_check IN
      SELECT status, COUNT(*) AS count
      FROM conversations
      GROUP BY status
      ORDER BY status
    LOOP
      RAISE NOTICE '  - Status "%" : % conversations', status_check.status, status_check.count;
    END LOOP;
  END;

END $$;
