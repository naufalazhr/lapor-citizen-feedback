-- =============================================================================
-- Fix Column Swap: phone_number ↔ device_number
--
-- ISSUE: Values are swapped in the database
-- - phone_number currently contains: device number (bot's WhatsApp from Fonnte)
-- - device_number currently contains: user's phone number (report data)
--
-- EXPECTED:
-- - phone_number should contain: user's phone number (matches reports.phone)
-- - device_number should contain: bot's WhatsApp account (Fonnte metadata)
--
-- This migration swaps the values to fix the semantic meaning
-- =============================================================================

DO $$
DECLARE
  swap_count INTEGER := 0;
BEGIN
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'Starting column value swap: phone_number ↔ device_number';
  RAISE NOTICE '=============================================================================';

  -- Swap the values using a temporary variable approach
  -- PostgreSQL allows this in a single UPDATE statement
  UPDATE conversations
  SET
    phone_number = device_number,
    device_number = phone_number;

  GET DIAGNOSTICS swap_count = ROW_COUNT;

  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'Column Swap Summary:';
  RAISE NOTICE '  - Total conversations updated: %', swap_count;
  RAISE NOTICE '  - phone_number now contains: user phone (matches reports.phone)';
  RAISE NOTICE '  - device_number now contains: bot WhatsApp account (Fonnte)';
  RAISE NOTICE '=============================================================================';

  -- Verify the swap worked
  RAISE NOTICE '';
  RAISE NOTICE 'Verifying swap by checking matches with reports table...';

  DECLARE
    match_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO match_count
    FROM conversations c
    INNER JOIN reports r ON c.phone_number = r.phone;

    RAISE NOTICE '  - Conversations now matching reports.phone: %', match_count;

    IF match_count > 0 THEN
      RAISE NOTICE '  ✓ Swap appears successful!';
    ELSE
      RAISE NOTICE '  ⚠ Warning: No matches found. Please verify data manually.';
    END IF;
  END;

END $$;

-- Add comment to document the fix
COMMENT ON COLUMN conversations.phone_number IS
'User phone number (matches reports.phone). Fixed by migration 20251031000002.';

COMMENT ON COLUMN conversations.device_number IS
'Bot WhatsApp account number (Fonnte device). Fixed by migration 20251031000002.';
