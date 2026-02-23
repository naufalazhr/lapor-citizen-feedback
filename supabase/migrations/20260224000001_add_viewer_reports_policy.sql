-- Migration: Fix RBAC gap — viewer role missing SELECT on reports table
--
-- Gap found during PII masking audit: migration 20251030051438 added viewer
-- policies for conversations/messages/attachments but NOT for reports.
-- Viewers are internal read-only staff who should see reports (at L2 masking
-- in the display layer) for analytics/monitoring purposes.

DROP POLICY IF EXISTS "Viewers can view all reports" ON public.reports;

CREATE POLICY "Viewers can view all reports"
ON public.reports
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'viewer'::app_role));
