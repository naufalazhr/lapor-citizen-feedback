-- Restrict tenant-wide SELECT policies to exclude OPD members

-- Reports: replace broad tenant SELECT with non-OPD users only
DROP POLICY IF EXISTS "Users can view own tenant reports" ON public.reports;
CREATE POLICY "Non-OPD users can view own tenant reports"
ON public.reports
FOR SELECT
USING (
  (tenant_id IN (
    SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
  ))
  AND NOT has_role(auth.uid(), 'opd_member'::app_role)
);

-- Conversations: replace broad tenant SELECT with non-OPD users only
DROP POLICY IF EXISTS "Users can view own tenant conversations" ON public.conversations;
CREATE POLICY "Non-OPD users can view own tenant conversations"
ON public.conversations
FOR SELECT
USING (
  (tenant_id IN (
    SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
  ))
  AND NOT has_role(auth.uid(), 'opd_member'::app_role)
);

-- Messages: replace broad tenant SELECT with non-OPD users only
DROP POLICY IF EXISTS "Users can view own tenant messages" ON public.messages;
CREATE POLICY "Non-OPD users can view own tenant messages"
ON public.messages
FOR SELECT
USING (
  (tenant_id IN (
    SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
  ))
  AND NOT has_role(auth.uid(), 'opd_member'::app_role)
);

-- Attachments: replace broad tenant SELECT with non-OPD users only
DROP POLICY IF EXISTS "Users can view own tenant attachments" ON public.attachments;
CREATE POLICY "Non-OPD users can view own tenant attachments"
ON public.attachments
FOR SELECT
USING (
  (tenant_id IN (
    SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
  ))
  AND NOT has_role(auth.uid(), 'opd_member'::app_role)
);
