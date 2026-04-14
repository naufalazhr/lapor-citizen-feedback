-- ============================================================================
-- SLA Notification System
-- ----------------------------------------------------------------------------
-- Adds infrastructure for scheduled WhatsApp notifications to OPD members
-- about pending/overdue reports. Uses pg_cron + pg_net to trigger an edge
-- function on a configurable schedule.
--
-- Key design decisions:
--   * Single-tenant deployment model: each deployed instance serves ONE tenant
--   * Notification Fonnte device is SEPARATE from conversation Fonnte device
--     (prevents ban on notification number from killing citizen conversations)
--   * Contact sync to Fonnte is a hard gate: users must be synced as contacts
--     on the notification device before any message is sent to them (anti-ban)
--   * WhatsApp only this phase; email deferred to future phase
-- ============================================================================

-- ============================================================================
-- 1. Enable required extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- 2. Add phone column to profiles (for OPD users to receive WhatsApp)
-- ============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- ============================================================================
-- 3. notification_settings — single config row per deployment
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- What to notify about
  notify_pending BOOLEAN NOT NULL DEFAULT true,
  notify_overdue BOOLEAN NOT NULL DEFAULT true,
  pending_threshold_hours INTEGER NOT NULL DEFAULT 24,
  overdue_threshold_hours INTEGER NOT NULL DEFAULT 72,

  -- Channels
  channel_whatsapp BOOLEAN NOT NULL DEFAULT true,
  -- channel_email will be added in a future phase

  -- Frequency (actual schedule is set in pg_cron; this label is for UI display)
  frequency_label TEXT NOT NULL DEFAULT 'daily_8am',

  -- Quiet hours (don't send within this window, interpreted in timezone)
  quiet_start TIME DEFAULT '22:00',
  quiet_end TIME DEFAULT '07:00',
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',

  -- Anti-ban volume controls
  max_daily_messages INTEGER NOT NULL DEFAULT 50,
  delay_between_sends_ms INTEGER NOT NULL DEFAULT 4000,
  cooldown_hours INTEGER NOT NULL DEFAULT 6,

  -- Master switch
  is_enabled BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT chk_pending_threshold CHECK (pending_threshold_hours >= 1 AND pending_threshold_hours <= 720),
  CONSTRAINT chk_overdue_threshold CHECK (overdue_threshold_hours >= 1 AND overdue_threshold_hours <= 2160),
  CONSTRAINT chk_max_daily CHECK (max_daily_messages >= 0 AND max_daily_messages <= 10000),
  CONSTRAINT chk_delay CHECK (delay_between_sends_ms >= 0 AND delay_between_sends_ms <= 60000),
  CONSTRAINT chk_cooldown CHECK (cooldown_hours >= 0 AND cooldown_hours <= 168)
);

-- Single-row invariant: at most one settings row per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_settings_tenant
  ON public.notification_settings(tenant_id);

-- ============================================================================
-- 4. notification_whatsapp_config — dedicated Fonnte device for notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notification_whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,

  provider TEXT NOT NULL DEFAULT 'fonnte',
  api_token TEXT NOT NULL,
  device_number TEXT,  -- the actual WhatsApp number (for display / reference)
  device_label TEXT,   -- friendly label for admin UI

  is_active BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT chk_provider CHECK (provider IN ('fonnte'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_whatsapp_config_tenant
  ON public.notification_whatsapp_config(tenant_id);

-- ============================================================================
-- 5. notification_contacts — tracks OPD users synced as Fonnte contacts
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notification_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  phone_number TEXT NOT NULL,
  display_name TEXT NOT NULL,
  fonnte_contact_id TEXT,

  sync_status TEXT NOT NULL DEFAULT 'pending',
  sync_error TEXT,
  synced_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_sync_status CHECK (sync_status IN ('pending', 'synced', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_contacts_user
  ON public.notification_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_contacts_tenant
  ON public.notification_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_contacts_status
  ON public.notification_contacts(sync_status);

-- ============================================================================
-- 6. notification_log — audit trail of all notification sends
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,

  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  recipient_address TEXT,

  report_ids UUID[] NOT NULL DEFAULT '{}',
  report_count INTEGER NOT NULL DEFAULT 0,
  message_body TEXT,

  status TEXT NOT NULL DEFAULT 'pending',
  skip_reason TEXT,
  error_message TEXT,
  provider TEXT,

  batch_id UUID NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_channel CHECK (channel IN ('whatsapp')),
  CONSTRAINT chk_status CHECK (status IN ('pending', 'sent', 'failed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_notification_log_tenant
  ON public.notification_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_recipient
  ON public.notification_log(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_batch
  ON public.notification_log(batch_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_created
  ON public.notification_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_recipient_created
  ON public.notification_log(recipient_user_id, created_at DESC)
  WHERE status = 'sent';

-- ============================================================================
-- 7. Auto-fill tenant_id triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notification_autofill_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    -- Single-tenant deployment: there should only ever be one tenant
    SELECT id INTO NEW.tenant_id FROM public.tenants LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_settings_autofill_tenant ON public.notification_settings;
CREATE TRIGGER trg_notification_settings_autofill_tenant
  BEFORE INSERT ON public.notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.notification_autofill_tenant_id();

DROP TRIGGER IF EXISTS trg_notification_whatsapp_config_autofill_tenant ON public.notification_whatsapp_config;
CREATE TRIGGER trg_notification_whatsapp_config_autofill_tenant
  BEFORE INSERT ON public.notification_whatsapp_config
  FOR EACH ROW
  EXECUTE FUNCTION public.notification_autofill_tenant_id();

DROP TRIGGER IF EXISTS trg_notification_contacts_autofill_tenant ON public.notification_contacts;
CREATE TRIGGER trg_notification_contacts_autofill_tenant
  BEFORE INSERT ON public.notification_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.notification_autofill_tenant_id();

DROP TRIGGER IF EXISTS trg_notification_log_autofill_tenant ON public.notification_log;
CREATE TRIGGER trg_notification_log_autofill_tenant
  BEFORE INSERT ON public.notification_log
  FOR EACH ROW
  EXECUTE FUNCTION public.notification_autofill_tenant_id();

-- ============================================================================
-- 8. updated_at triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notification_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_settings_touch ON public.notification_settings;
CREATE TRIGGER trg_notification_settings_touch
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.notification_touch_updated_at();

DROP TRIGGER IF EXISTS trg_notification_whatsapp_config_touch ON public.notification_whatsapp_config;
CREATE TRIGGER trg_notification_whatsapp_config_touch
  BEFORE UPDATE ON public.notification_whatsapp_config
  FOR EACH ROW
  EXECUTE FUNCTION public.notification_touch_updated_at();

DROP TRIGGER IF EXISTS trg_notification_contacts_touch ON public.notification_contacts;
CREATE TRIGGER trg_notification_contacts_touch
  BEFORE UPDATE ON public.notification_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.notification_touch_updated_at();

-- ============================================================================
-- 9. Row Level Security
-- ============================================================================
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- notification_settings: admins/owners can read and write
DROP POLICY IF EXISTS "Admins manage notification settings" ON public.notification_settings;
CREATE POLICY "Admins manage notification settings"
  ON public.notification_settings
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'superadmin'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'superadmin'));

-- notification_whatsapp_config: admins/owners can read and write
DROP POLICY IF EXISTS "Admins manage notification whatsapp config" ON public.notification_whatsapp_config;
CREATE POLICY "Admins manage notification whatsapp config"
  ON public.notification_whatsapp_config
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'superadmin'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'superadmin'));

-- notification_contacts: admins/owners can manage all; users can read their own row
DROP POLICY IF EXISTS "Admins manage notification contacts" ON public.notification_contacts;
CREATE POLICY "Admins manage notification contacts"
  ON public.notification_contacts
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'superadmin'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'superadmin'));

DROP POLICY IF EXISTS "Users view own notification contact" ON public.notification_contacts;
CREATE POLICY "Users view own notification contact"
  ON public.notification_contacts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- notification_log: admins/owners can read; system (service role) writes
DROP POLICY IF EXISTS "Admins read notification log" ON public.notification_log;
CREATE POLICY "Admins read notification log"
  ON public.notification_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'superadmin'));

-- ============================================================================
-- 10. Seed a default notification_settings row (disabled by default)
-- ============================================================================
INSERT INTO public.notification_settings (is_enabled)
SELECT false
WHERE NOT EXISTS (SELECT 1 FROM public.notification_settings);

-- ============================================================================
-- 11. pg_cron job — calls sla-notifications edge function daily at 8AM WIB (01:00 UTC)
-- ----------------------------------------------------------------------------
-- Admin can later change the schedule via:
--   SELECT cron.alter_job(job_id, schedule := '0 */6 * * *');  -- e.g. every 6h
-- Or unschedule with:
--   SELECT cron.unschedule('sla-notifications-job');
--
-- The edge function uses the service role key for auth (stored in vault).
-- ============================================================================
DO $$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Try to fetch secrets from Vault; skip scheduling if not present.
  -- Deployments can set these via Supabase dashboard > Project Settings > Vault.
  BEGIN
    SELECT decrypted_secret INTO v_supabase_url
      FROM vault.decrypted_secrets
      WHERE name = 'project_url';
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := NULL;
  END;

  BEGIN
    SELECT decrypted_secret INTO v_service_key
      FROM vault.decrypted_secrets
      WHERE name = 'service_role_key';
  EXCEPTION WHEN OTHERS THEN
    v_service_key := NULL;
  END;

  -- Only schedule if we have both secrets (skip silently otherwise — admin
  -- can configure secrets + re-run this block, or schedule manually)
  IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL THEN
    -- Remove any previous version of the job
    BEGIN
      PERFORM cron.unschedule('sla-notifications-job');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    PERFORM cron.schedule(
      'sla-notifications-job',
      '0 1 * * *',  -- 01:00 UTC = 08:00 WIB daily
      format($cron$
        SELECT net.http_post(
          url := %L,
          headers := %L::jsonb,
          body := %L::jsonb,
          timeout_milliseconds := 120000
        );
      $cron$,
        v_supabase_url || '/functions/v1/sla-notifications',
        jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_key
        )::text,
        jsonb_build_object('triggered_by', 'pg_cron')::text
      )
    );
  END IF;
END $$;

-- ============================================================================
-- End of migration
-- ============================================================================
