-- ============================================================================
-- SLA Notification System — Pivot to Per-OPD Targeting
-- ----------------------------------------------------------------------------
-- Original design used per-user notifications (reading profiles.phone).
-- After staging verification, we realized per-OPD is more appropriate:
--   * Indonesian government offices typically share one WA line per department
--   * Lower ban risk (fewer unique recipients)
--   * Admins already set opds.contact_phone as the department contact
--
-- This migration changes:
--   * notification_contacts: keyed by opd_id instead of user_id
--   * notification_log: adds recipient_opd_id column
--
-- notification_contacts is expected to be empty or near-empty at this point,
-- so no data migration is needed. Orphan rows with user_id set but no opd_id
-- get purged.
-- ============================================================================

-- ============================================================================
-- 1. notification_contacts: drop user_id, add opd_id
-- ============================================================================

-- Purge any existing rows (pre-pivot rows are incompatible with new schema)
DELETE FROM public.notification_contacts;

-- Drop the old unique index on user_id if it exists
DROP INDEX IF EXISTS public.idx_notification_contacts_user;

-- Drop the old RLS policy that lets a user read their own row (no longer applies)
DROP POLICY IF EXISTS "Users view own notification contact" ON public.notification_contacts;

-- Drop the user_id column
ALTER TABLE public.notification_contacts
  DROP COLUMN IF EXISTS user_id;

-- Add the opd_id column
ALTER TABLE public.notification_contacts
  ADD COLUMN IF NOT EXISTS opd_id UUID REFERENCES public.opds(id) ON DELETE CASCADE;

-- Make opd_id NOT NULL (safe because we purged all rows above)
ALTER TABLE public.notification_contacts
  ALTER COLUMN opd_id SET NOT NULL;

-- Unique index: one contact row per OPD
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_contacts_opd
  ON public.notification_contacts(opd_id);

-- ============================================================================
-- 2. notification_log: add recipient_opd_id
-- ============================================================================
ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS recipient_opd_id UUID REFERENCES public.opds(id) ON DELETE SET NULL;

-- Make recipient_user_id nullable (it's now optional — we primarily log by opd)
ALTER TABLE public.notification_log
  ALTER COLUMN recipient_user_id DROP NOT NULL;

-- Index for cooldown lookup by opd
CREATE INDEX IF NOT EXISTS idx_notification_log_recipient_opd_created
  ON public.notification_log(recipient_opd_id, created_at DESC)
  WHERE status = 'sent';

-- ============================================================================
-- 3. End
-- ============================================================================
