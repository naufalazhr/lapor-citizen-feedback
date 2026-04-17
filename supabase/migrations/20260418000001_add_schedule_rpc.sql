-- ============================================================================
-- SLA Notification — UI-driven cron schedule
-- ============================================================================
-- Adds structured columns + SECURITY DEFINER RPCs so admins can change the
-- pg_cron schedule from the Settings UI without needing SQL access. Three
-- modes: daily / specific_times (2-4 per day) / every_n_hours. No free-text
-- cron field — all inputs are clock pickers or bounded numbers.
-- ============================================================================

-- 1. Schema additions on notification_settings
ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS schedule_mode TEXT NOT NULL DEFAULT 'daily'
    CHECK (schedule_mode IN ('daily','specific_times','every_n_hours')),
  ADD COLUMN IF NOT EXISTS schedule_times_wib TIME[],
  ADD COLUMN IF NOT EXISTS schedule_interval_hours INTEGER;

-- 2. Writer RPC — updates cron.job and persists input state
CREATE OR REPLACE FUNCTION public.set_notification_schedule(
  p_mode TEXT,
  p_times_wib TIME[] DEFAULT NULL,
  p_interval_hours INTEGER DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jobid INTEGER;
  v_cron TEXT;
  v_minute INTEGER;
  v_hours INTEGER[];
  v_hour_csv TEXT;
  t TIME;
  n INTEGER;
  -- Singleton-row assumption: notification_settings is written once by the
  -- initial migration and has exactly one row per deployment. The UPDATE
  -- below relies on that contract.
BEGIN
  -- Role gate (first statement, never bypass)
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'owner') OR has_role(auth.uid(),'superadmin')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  CASE p_mode
    WHEN 'daily' THEN
      IF p_times_wib IS NULL OR array_length(p_times_wib, 1) <> 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Harus mengisi satu jam');
      END IF;
      t := p_times_wib[1];
      v_cron := format('%s %s * * *',
        EXTRACT(MINUTE FROM t)::INT,
        (EXTRACT(HOUR FROM t)::INT - 7 + 24) % 24);

    WHEN 'specific_times' THEN
      n := COALESCE(array_length(p_times_wib, 1), 0);
      IF n < 2 OR n > 4 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pilih 2 sampai 4 jam');
      END IF;
      IF (SELECT COUNT(DISTINCT EXTRACT(MINUTE FROM x)) FROM unnest(p_times_wib) AS x) > 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Semua jam harus di menit yang sama');
      END IF;
      v_minute := EXTRACT(MINUTE FROM p_times_wib[1])::INT;
      SELECT array_agg(DISTINCT ((EXTRACT(HOUR FROM x)::INT - 7 + 24) % 24)
                        ORDER BY ((EXTRACT(HOUR FROM x)::INT - 7 + 24) % 24))
        INTO v_hours
        FROM unnest(p_times_wib) AS x;
      v_hour_csv := array_to_string(v_hours, ',');
      v_cron := format('%s %s * * *', v_minute, v_hour_csv);

    WHEN 'every_n_hours' THEN
      IF p_interval_hours IS NULL OR p_interval_hours < 1 OR p_interval_hours > 12 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Interval 1-12 jam');
      END IF;
      v_cron := format('0 */%s * * *', p_interval_hours);

    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Mode tidak valid');
  END CASE;

  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'sla-notifications-job';
  IF v_jobid IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Job sla-notifications-job belum dijadwalkan. Jalankan migrasi/setup terlebih dahulu.'
    );
  END IF;

  PERFORM cron.alter_job(v_jobid, schedule := v_cron);

  UPDATE public.notification_settings SET
    schedule_mode = p_mode,
    schedule_times_wib = p_times_wib,
    schedule_interval_hours = p_interval_hours,
    updated_at = now()
  WHERE id = (SELECT id FROM public.notification_settings LIMIT 1);

  RETURN jsonb_build_object(
    'success', true,
    'cron_expression', v_cron,
    'message', 'Jadwal diperbarui'
  );
END $$;

-- Defense in depth: deny default PUBLIC grant before granting to authenticated.
REVOKE EXECUTE ON FUNCTION public.set_notification_schedule(TEXT, TIME[], INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_notification_schedule(TEXT, TIME[], INTEGER) TO authenticated;

-- 3. Reader RPC — authenticated role cannot read cron.job directly
CREATE OR REPLACE FUNCTION public.get_active_cron_schedule()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule TEXT;
  v_active BOOLEAN;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'owner') OR has_role(auth.uid(),'superadmin')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  SELECT schedule, active INTO v_schedule, v_active
    FROM cron.job WHERE jobname = 'sla-notifications-job';

  IF v_schedule IS NULL THEN
    RETURN jsonb_build_object('success', true, 'scheduled', false);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'scheduled', true,
    'schedule', v_schedule,
    'active', v_active
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.get_active_cron_schedule() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_cron_schedule() TO authenticated;
