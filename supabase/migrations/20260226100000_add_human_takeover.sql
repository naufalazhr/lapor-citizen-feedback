-- =============================================================================
-- Add Human Takeover Support to Conversations
-- Allows admin/member to take over a specific WhatsApp conversation from AI
-- =============================================================================

-- Add human takeover columns to conversations table
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_human_handled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS human_handler_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS human_handled_at TIMESTAMPTZ;

-- Add human sender tracking to messages table
-- Distinguishes admin-sent messages from AI-generated messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS sent_by_human BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS human_sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Allow members to UPDATE conversations (needed for takeover toggle from frontend)
-- Members already have SELECT on conversations (from migration 20251030051438)
-- This adds UPDATE so they can toggle is_human_handled via the admin UI
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversations'
      AND policyname = 'Members can update conversations for takeover'
  ) THEN
    CREATE POLICY "Members can update conversations for takeover"
    ON public.conversations
    FOR UPDATE
    TO authenticated
    USING (has_role(auth.uid(), 'member'::app_role));
  END IF;
END $$;
