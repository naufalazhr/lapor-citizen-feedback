-- ============================================================================
-- Fix cross-tenant RLS leakage on conversations, messages, attachments
--
-- Root cause: old permissive policies from 20251029/20251030 had no tenant_id
-- filter. Postgres OR's permissive policies, so ANY passing policy exposes the
-- row — the newer tenant-scoped policies in 20251201 were silently bypassed.
-- ============================================================================

-- ── conversations: drop old broad SELECT policies ──────────────────────────
DROP POLICY IF EXISTS "Admins can view conversations"           ON public.conversations;
DROP POLICY IF EXISTS "Members can view all conversations"      ON public.conversations;
DROP POLICY IF EXISTS "Viewers can view all conversations"      ON public.conversations;

-- ── conversations: drop old broad UPDATE policies ──────────────────────────
DROP POLICY IF EXISTS "Admins can update conversations"         ON public.conversations;
DROP POLICY IF EXISTS "Members can update conversations for takeover" ON public.conversations;

-- ── conversations: add tenant-scoped UPDATE policies ───────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversations'
      AND policyname = 'Admins can update own tenant conversations'
  ) THEN
    CREATE POLICY "Admins can update own tenant conversations"
    ON public.conversations FOR UPDATE
    TO authenticated
    USING (
      tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
      AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversations'
      AND policyname = 'Members can update own tenant conversations for takeover'
  ) THEN
    CREATE POLICY "Members can update own tenant conversations for takeover"
    ON public.conversations FOR UPDATE
    TO authenticated
    USING (
      tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
      AND has_role(auth.uid(), 'member'::app_role)
    );
  END IF;
END $$;

-- ── messages: drop old broad SELECT policies ───────────────────────────────
DROP POLICY IF EXISTS "Admins can view messages"                ON public.messages;
DROP POLICY IF EXISTS "Members can view all messages"           ON public.messages;
DROP POLICY IF EXISTS "Viewers can view all messages"           ON public.messages;

-- ── attachments: drop old broad SELECT policies ────────────────────────────
DROP POLICY IF EXISTS "Admins can view attachments"             ON public.attachments;
DROP POLICY IF EXISTS "Members can view attachments"            ON public.attachments;
DROP POLICY IF EXISTS "Viewers can view attachments"            ON public.attachments;
