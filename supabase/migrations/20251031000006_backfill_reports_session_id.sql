-- =============================================================================
-- Backfill session_id for Existing Reports
--
-- Purpose: Match existing reports with conversations to populate session_id
-- Method: Match by phone number + timestamp (5 minute window)
-- Note: Best effort - some reports may not match (will remain null)
-- =============================================================================

DO $$
DECLARE
  matched_count INTEGER := 0;
  total_reports INTEGER := 0;
BEGIN
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'Starting backfill of session_id for existing reports...';
  RAISE NOTICE '=============================================================================';

  -- Count total reports without session_id
  SELECT COUNT(*) INTO total_reports
  FROM reports
  WHERE session_id IS NULL;

  RAISE NOTICE '';
  RAISE NOTICE 'Total reports to process: %', total_reports;
  RAISE NOTICE '';

  IF total_reports = 0 THEN
    RAISE NOTICE 'No reports need backfilling. All done!';
  ELSE
    -- Match and update reports with conversations
    -- Logic: Find conversation by phone + timestamp within 5 minutes
    WITH matched AS (
      SELECT DISTINCT ON (r.id)
        r.id AS report_id,
        c.session_id,
        r.phone AS report_phone,
        r.created_at AS report_created
      FROM reports r
      INNER JOIN conversations c ON c.phone_number = r.phone
      WHERE
        r.session_id IS NULL
        AND r.created_at >= c.started_at
        AND r.created_at <= c.last_message_at + INTERVAL '5 minutes'
      ORDER BY r.id, c.last_message_at DESC
    )
    UPDATE reports r
    SET session_id = matched.session_id
    FROM matched
    WHERE r.id = matched.report_id;

    GET DIAGNOSTICS matched_count = ROW_COUNT;

    RAISE NOTICE '  ✓ Successfully matched: % reports', matched_count;
    RAISE NOTICE '  ℹ Could not match: % reports (will remain null)', total_reports - matched_count;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'Backfill Summary:';
  RAISE NOTICE '  - Total reports processed:   %', total_reports;
  RAISE NOTICE '  - Successfully matched:      %', matched_count;
  RAISE NOTICE '  - Not matched (remain null): %', total_reports - matched_count;
  RAISE NOTICE '=============================================================================';

  -- Show sample of matched records for verification
  RAISE NOTICE '';
  RAISE NOTICE 'Sample of matched records:';

  DECLARE
    sample RECORD;
    counter INTEGER := 0;
  BEGIN
    FOR sample IN
      SELECT
        r.id,
        r.ticket_id,
        r.phone,
        r.session_id,
        c.id AS conversation_id
      FROM reports r
      INNER JOIN conversations c ON c.session_id = r.session_id
      ORDER BY r.created_at DESC
      LIMIT 5
    LOOP
      counter := counter + 1;
      RAISE NOTICE '  %: Report % (phone: %) → session_id: %',
        counter, sample.ticket_id, sample.phone, sample.session_id;
    END LOOP;

    IF counter = 0 THEN
      RAISE NOTICE '  (No matched records to display)';
    END IF;
  END;

END $$;
