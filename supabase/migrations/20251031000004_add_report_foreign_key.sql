-- =============================================================================
-- Add Foreign Key Constraint: conversations.report_id → reports.id
--
-- Prerequisites: Run previous migrations first (swap columns and match reports)
--
-- This migration adds a foreign key constraint to ensure data integrity
-- between conversations and reports tables.
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'Adding foreign key constraint: conversations.report_id → reports.id';
  RAISE NOTICE '=============================================================================';

  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_conversations_report'
    AND table_name = 'conversations'
  ) THEN

    -- Add the foreign key constraint
    ALTER TABLE conversations
    ADD CONSTRAINT fk_conversations_report
    FOREIGN KEY (report_id)
    REFERENCES reports(id)
    ON DELETE SET NULL;  -- If report is deleted, set conversation.report_id to NULL

    RAISE NOTICE '  ✓ Foreign key constraint added successfully';
    RAISE NOTICE '  - conversations.report_id → reports.id';
    RAISE NOTICE '  - On delete: SET NULL';

  ELSE
    RAISE NOTICE '  ℹ Foreign key constraint already exists, skipping...';
  END IF;

  -- Add index for better query performance
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE indexname = 'idx_conversations_report_id'
  ) THEN

    CREATE INDEX idx_conversations_report_id ON conversations(report_id);

    RAISE NOTICE '  ✓ Index created on conversations.report_id';

  ELSE
    RAISE NOTICE '  ℹ Index on report_id already exists, skipping...';
  END IF;

  RAISE NOTICE '=============================================================================';

END $$;

-- Add helpful comment
COMMENT ON CONSTRAINT fk_conversations_report ON conversations IS
'Links conversation to the report that was created during that conversation. Added by migration 20251031000004.';
