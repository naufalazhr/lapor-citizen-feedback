-- Create secure function for role assignment
CREATE OR REPLACE FUNCTION public.assign_user_role(
  target_user_id UUID,
  new_role app_role
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin BOOLEAN;
  admin_count INTEGER;
BEGIN
  -- Check if caller has admin or owner role
  SELECT has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner')
  INTO caller_is_admin;
  
  IF NOT caller_is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only admins and owners can assign roles'
    );
  END IF;
  
  -- If removing admin role, check if this is the last admin
  IF EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = target_user_id 
    AND role IN ('admin', 'owner')
  ) AND new_role NOT IN ('admin', 'owner') THEN
    SELECT COUNT(*) INTO admin_count
    FROM user_roles
    WHERE role IN ('admin', 'owner');
    
    IF admin_count <= 1 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Cannot remove the last admin'
      );
    END IF;
  END IF;
  
  -- Delete existing roles for this user
  DELETE FROM user_roles WHERE user_id = target_user_id;
  
  -- Insert new role
  INSERT INTO user_roles (user_id, role)
  VALUES (target_user_id, new_role);
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Role assigned successfully'
  );
END;
$$;

-- Add RLS policy for admins to view all profiles
CREATE POLICY "Admins and owners can view all profiles for management"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner')
);

-- Assign member role to yugie.nugraha@gmail.com
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'member'::app_role
FROM auth.users
WHERE email = 'yugie.nugraha@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;