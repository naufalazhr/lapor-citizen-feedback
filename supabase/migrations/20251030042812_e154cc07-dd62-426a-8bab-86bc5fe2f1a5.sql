-- Add RLS policy for admins to view all user roles
CREATE POLICY "Admins and owners can view all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner')
);