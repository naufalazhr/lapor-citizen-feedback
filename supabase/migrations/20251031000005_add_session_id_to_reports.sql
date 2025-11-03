-- =============================================================================
-- Add session_id Column to Reports Table
--
-- Purpose: Enable exact matching between conversations and reports using
-- Flowise's session identifier instead of unreliable phone+timestamp matching
--
-- Relationship: reports.session_id → conversations.session_id
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'Adding session_id column to reports table...';
  RAISE NOTICE '=============================================================================';

  -- Add session_id column (nullable for backward compatibility)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE reports ADD COLUMN session_id TEXT;
    RAISE NOTICE '  ✓ Column session_id added to reports table';
  ELSE
    RAISE NOTICE '  ℹ Column session_id already exists, skipping...';
  END IF;

  -- Add index for fast lookups
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_reports_session_id'
  ) THEN
    CREATE INDEX idx_reports_session_id ON reports(session_id);
    RAISE NOTICE '  ✓ Index created on reports.session_id';
  ELSE
    RAISE NOTICE '  ℹ Index idx_reports_session_id already exists, skipping...';
  END IF;

  -- Add foreign key constraint (bidirectional relationship with conversations)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_reports_conversation_session'
    AND table_name = 'reports'
  ) THEN
    ALTER TABLE reports
    ADD CONSTRAINT fk_reports_conversation_session
    FOREIGN KEY (session_id)
    REFERENCES conversations(session_id)
    ON DELETE SET NULL;

    RAISE NOTICE '  ✓ Foreign key constraint added: reports.session_id → conversations.session_id';
    RAISE NOTICE '  - ON DELETE SET NULL (preserve report if conversation deleted)';
  ELSE
    RAISE NOTICE '  ℹ Foreign key constraint already exists, skipping...';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'Migration Complete: session_id added to reports table';
  RAISE NOTICE '=============================================================================';

END $$;

-- Add helpful comment documenting the relationship
COMMENT ON COLUMN reports.session_id IS
'Links to conversations.session_id for exact conversation matching. Improves reliability over phone-based matching. Added by migration 20251031000005.';
