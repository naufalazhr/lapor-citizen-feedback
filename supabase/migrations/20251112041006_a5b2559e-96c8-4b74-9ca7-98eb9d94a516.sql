-- Add RLS policy for OPD Members on conversations table
-- OPD Members can only view conversations linked to reports assigned to their OPD
CREATE POLICY "OPD Members can view conversations for their OPD reports"
ON public.conversations
FOR SELECT
USING (
  has_role(auth.uid(), 'opd_member'::app_role) 
  AND report_id IN (
    SELECT r.id 
    FROM public.reports r
    WHERE r.assigned_opd_id IN (
      SELECT opd_id 
      FROM public.user_opd_assignments
      WHERE user_id = auth.uid() 
      AND is_active = true
    )
  )
);

-- Add RLS policy for OPD Members on messages table
-- OPD Members can only view messages from conversations linked to their OPD's reports
CREATE POLICY "OPD Members can view messages for their OPD reports"
ON public.messages
FOR SELECT
USING (
  has_role(auth.uid(), 'opd_member'::app_role) 
  AND conversation_id IN (
    SELECT c.id 
    FROM public.conversations c
    INNER JOIN public.reports r ON c.report_id = r.id
    WHERE r.assigned_opd_id IN (
      SELECT opd_id 
      FROM public.user_opd_assignments
      WHERE user_id = auth.uid() 
      AND is_active = true
    )
  )
);

-- Add RLS policy for OPD Members on attachments table
-- OPD Members can only view attachments from messages linked to their OPD's reports
CREATE POLICY "OPD Members can view attachments for their OPD reports"
ON public.attachments
FOR SELECT
USING (
  has_role(auth.uid(), 'opd_member'::app_role) 
  AND message_id IN (
    SELECT m.id 
    FROM public.messages m
    INNER JOIN public.conversations c ON m.conversation_id = c.id
    INNER JOIN public.reports r ON c.report_id = r.id
    WHERE r.assigned_opd_id IN (
      SELECT opd_id 
      FROM public.user_opd_assignments
      WHERE user_id = auth.uid() 
      AND is_active = true
    )
  )
);