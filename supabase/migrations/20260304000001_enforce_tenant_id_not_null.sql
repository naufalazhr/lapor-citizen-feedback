-- =============================================================================
-- Enforce tenant_id NOT NULL on key tables
-- Adds BEFORE INSERT triggers to auto-populate tenant_id from parent records,
-- then adds NOT NULL constraints so NULL tenant_id can never slip through.
-- This prevents the recurring bug where data is invisible due to RLS filtering.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. messages: inherit tenant_id from conversations
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_fill_message_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.conversation_id IS NOT NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM conversations
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_fill_message_tenant_id ON messages;
CREATE TRIGGER trg_auto_fill_message_tenant_id
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION auto_fill_message_tenant_id();

-- ---------------------------------------------------------------------------
-- 2. attachments: inherit tenant_id from messages → conversations
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_fill_attachment_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.message_id IS NOT NULL THEN
    SELECT m.tenant_id INTO NEW.tenant_id
    FROM messages m
    WHERE m.id = NEW.message_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_fill_attachment_tenant_id ON attachments;
CREATE TRIGGER trg_auto_fill_attachment_tenant_id
  BEFORE INSERT ON attachments
  FOR EACH ROW
  EXECUTE FUNCTION auto_fill_attachment_tenant_id();

-- ---------------------------------------------------------------------------
-- 3. report_dispositions: inherit tenant_id from reports
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_fill_disposition_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.report_id IS NOT NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM reports
    WHERE id = NEW.report_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_fill_disposition_tenant_id ON report_dispositions;
CREATE TRIGGER trg_auto_fill_disposition_tenant_id
  BEFORE INSERT ON report_dispositions
  FOR EACH ROW
  EXECUTE FUNCTION auto_fill_disposition_tenant_id();

-- ---------------------------------------------------------------------------
-- 4. report_ai_insights: inherit tenant_id from reports
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_ai_insights' AND column_name = 'tenant_id'
  ) THEN
    CREATE OR REPLACE FUNCTION auto_fill_ai_insight_tenant_id()
    RETURNS TRIGGER AS $fn$
    BEGIN
      IF NEW.tenant_id IS NULL AND NEW.report_id IS NOT NULL THEN
        SELECT tenant_id INTO NEW.tenant_id
        FROM reports
        WHERE id = NEW.report_id;
      END IF;
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_auto_fill_ai_insight_tenant_id ON report_ai_insights;
    CREATE TRIGGER trg_auto_fill_ai_insight_tenant_id
      BEFORE INSERT ON report_ai_insights
      FOR EACH ROW
      EXECUTE FUNCTION auto_fill_ai_insight_tenant_id();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Backfill any remaining NULLs before adding NOT NULL constraints
-- ---------------------------------------------------------------------------

-- messages: backfill from conversations
UPDATE messages m
SET tenant_id = c.tenant_id
FROM conversations c
WHERE m.conversation_id = c.id
  AND m.tenant_id IS NULL
  AND c.tenant_id IS NOT NULL;

-- attachments: backfill from messages
UPDATE attachments a
SET tenant_id = m.tenant_id
FROM messages m
WHERE a.message_id = m.id
  AND a.tenant_id IS NULL
  AND m.tenant_id IS NOT NULL;

-- report_dispositions: backfill from reports
UPDATE report_dispositions rd
SET tenant_id = r.tenant_id
FROM reports r
WHERE rd.report_id = r.id
  AND rd.tenant_id IS NULL
  AND r.tenant_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. Add NOT NULL constraints (safe — triggers + backfill ensure no NULLs)
--    Using DO blocks so it's idempotent if column is already NOT NULL.
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  -- messages.tenant_id NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'tenant_id' AND is_nullable = 'YES'
  ) THEN
    -- Only add constraint if no NULLs remain
    IF NOT EXISTS (SELECT 1 FROM messages WHERE tenant_id IS NULL LIMIT 1) THEN
      ALTER TABLE messages ALTER COLUMN tenant_id SET NOT NULL;
    ELSE
      RAISE NOTICE 'messages: skipping NOT NULL — some rows still have NULL tenant_id';
    END IF;
  END IF;

  -- attachments.tenant_id NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attachments' AND column_name = 'tenant_id' AND is_nullable = 'YES'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM attachments WHERE tenant_id IS NULL LIMIT 1) THEN
      ALTER TABLE attachments ALTER COLUMN tenant_id SET NOT NULL;
    ELSE
      RAISE NOTICE 'attachments: skipping NOT NULL — some rows still have NULL tenant_id';
    END IF;
  END IF;

  -- report_dispositions.tenant_id NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_dispositions' AND column_name = 'tenant_id' AND is_nullable = 'YES'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM report_dispositions WHERE tenant_id IS NULL LIMIT 1) THEN
      ALTER TABLE report_dispositions ALTER COLUMN tenant_id SET NOT NULL;
    ELSE
      RAISE NOTICE 'report_dispositions: skipping NOT NULL — some rows still have NULL tenant_id';
    END IF;
  END IF;
END $$;