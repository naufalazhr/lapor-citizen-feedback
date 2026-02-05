-- Restrict tenant-wide SELECT policies to exclude OPD members
-- NOTE: This migration references profiles.tenant_id which is created in a later migration (20251201120000)
-- These policies will be properly created in that later migration when tenant_id exists

-- Only drop old policies (safe regardless of column existence)
DROP POLICY IF EXISTS "Users can view own tenant reports" ON public.reports;
DROP POLICY IF EXISTS "Users can view own tenant conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view own tenant messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view own tenant attachments" ON public.attachments;

-- Create policies only if profiles.tenant_id column exists
DO $$
BEGIN
  -- Check if profiles.tenant_id column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'tenant_id'
  ) THEN
    -- Reports: non-OPD users only
    EXECUTE 'CREATE POLICY "Non-OPD users can view own tenant reports"
    ON public.reports
    FOR SELECT
    USING (
      (tenant_id IN (
        SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
      ))
      AND NOT has_role(auth.uid(), ''opd_member''::app_role)
    )';

    -- Conversations: non-OPD users only
    EXECUTE 'CREATE POLICY "Non-OPD users can view own tenant conversations"
    ON public.conversations
    FOR SELECT
    USING (
      (tenant_id IN (
        SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
      ))
      AND NOT has_role(auth.uid(), ''opd_member''::app_role)
    )';

    -- Messages: non-OPD users only
    EXECUTE 'CREATE POLICY "Non-OPD users can view own tenant messages"
    ON public.messages
    FOR SELECT
    USING (
      (tenant_id IN (
        SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
      ))
      AND NOT has_role(auth.uid(), ''opd_member''::app_role)
    )';

    -- Attachments: non-OPD users only
    EXECUTE 'CREATE POLICY "Non-OPD users can view own tenant attachments"
    ON public.attachments
    FOR SELECT
    USING (
      (tenant_id IN (
        SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
      ))
      AND NOT has_role(auth.uid(), ''opd_member''::app_role)
    )';

    RAISE NOTICE 'Created tenant-restricted policies (profiles.tenant_id exists)';
  ELSE
    RAISE NOTICE 'Skipping policy creation (profiles.tenant_id not yet available - will be created in later migration)';
  END IF;
END $$;
