-- Fix RLS policy to allow OPD members to return reports (set assigned_opd_id to NULL)
DROP POLICY IF EXISTS "OPD Members can update assigned OPD reports" ON public.reports;

CREATE POLICY "OPD Members can update assigned OPD reports"
ON public.reports
FOR UPDATE
USING (
  has_role(auth.uid(), 'opd_member'::app_role) 
  AND assigned_opd_id IN (
    SELECT opd_id 
    FROM user_opd_assignments 
    WHERE user_id = auth.uid() 
    AND is_active = true
  )
)
WITH CHECK (
  has_role(auth.uid(), 'opd_member'::app_role) 
  AND (
    -- Allow setting to NULL (returning to member)
    assigned_opd_id IS NULL
    -- OR keeping it in their assigned OPDs
    OR assigned_opd_id IN (
      SELECT opd_id 
      FROM user_opd_assignments 
      WHERE user_id = auth.uid() 
      AND is_active = true
    )
  )
);