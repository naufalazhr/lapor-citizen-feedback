-- Update OPD member conversation visibility to also allow session_id linkage
DROP POLICY IF EXISTS "OPD Members can view conversations for their OPD reports" ON public.conversations;
CREATE POLICY "OPD Members can view conversations for their OPD reports"
ON public.conversations
FOR SELECT
USING (
  has_role(auth.uid(), 'opd_member'::app_role)
  AND (
    -- via report_id linkage
    report_id IN (
      SELECT r.id
      FROM public.reports r
      WHERE r.assigned_opd_id IN (
        SELECT uoa.opd_id
        FROM public.user_opd_assignments uoa
        WHERE uoa.user_id = auth.uid() AND uoa.is_active = true
      )
    )
    OR 
    -- via session_id linkage
    session_id IN (
      SELECT r.session_id
      FROM public.reports r
      WHERE r.assigned_opd_id IN (
        SELECT uoa.opd_id
        FROM public.user_opd_assignments uoa
        WHERE uoa.user_id = auth.uid() AND uoa.is_active = true
      )
      AND r.session_id IS NOT NULL
    )
  )
);

-- Update OPD member message visibility to include session_id linkage
DROP POLICY IF EXISTS "OPD Members can view messages for their OPD reports" ON public.messages;
CREATE POLICY "OPD Members can view messages for their OPD reports"
ON public.messages
FOR SELECT
USING (
  has_role(auth.uid(), 'opd_member'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.conversations c
    LEFT JOIN public.reports r_by_id ON c.report_id = r_by_id.id
    LEFT JOIN public.reports r_by_session ON c.session_id = r_by_session.session_id
    WHERE c.id = messages.conversation_id
      AND (
        (r_by_id.assigned_opd_id IN (
          SELECT uoa.opd_id FROM public.user_opd_assignments uoa WHERE uoa.user_id = auth.uid() AND uoa.is_active = true
        ))
        OR
        (r_by_session.assigned_opd_id IN (
          SELECT uoa.opd_id FROM public.user_opd_assignments uoa WHERE uoa.user_id = auth.uid() AND uoa.is_active = true
        ))
      )
  )
);

-- Update OPD member attachment visibility to include session_id linkage
DROP POLICY IF EXISTS "OPD Members can view attachments for their OPD reports" ON public.attachments;
CREATE POLICY "OPD Members can view attachments for their OPD reports"
ON public.attachments
FOR SELECT
USING (
  has_role(auth.uid(), 'opd_member'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.conversations c ON m.conversation_id = c.id
    LEFT JOIN public.reports r_by_id ON c.report_id = r_by_id.id
    LEFT JOIN public.reports r_by_session ON c.session_id = r_by_session.session_id
    WHERE m.id = attachments.message_id
      AND (
        (r_by_id.assigned_opd_id IN (
          SELECT uoa.opd_id FROM public.user_opd_assignments uoa WHERE uoa.user_id = auth.uid() AND uoa.is_active = true
        ))
        OR
        (r_by_session.assigned_opd_id IN (
          SELECT uoa.opd_id FROM public.user_opd_assignments uoa WHERE uoa.user_id = auth.uid() AND uoa.is_active = true
        ))
      )
  )
);
