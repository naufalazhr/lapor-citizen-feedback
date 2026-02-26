-- =============================================================================
-- Enable Realtime for messages table
-- Required so the admin Conversations page receives live message updates
-- without needing to refresh.
--
-- REPLICA IDENTITY FULL is needed so Supabase Realtime can apply the
-- conversation_id filter on INSERT events (Postgres must emit all column
-- values in WAL, not just the primary key, for column-level filters to work).
-- =============================================================================

-- 1. Enable full replica identity so filtered subscriptions work
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- 2. Add messages to the supabase_realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;