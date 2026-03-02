-- Allow admin and owner roles to manage their own tenant's whatsapp_provider_config.
-- Previously only superadmin could write this table, which caused the provider
-- activation (upsert from config managers) to silently fail for admin/owner users.

-- Drop the old superadmin-only write policy
DROP POLICY IF EXISTS "Superadmins can manage whatsapp_provider_config" ON public.whatsapp_provider_config;

-- Add tenant-scoped write policy for admin / owner / superadmin
CREATE POLICY "Admin and owner can manage tenant whatsapp_provider_config"
ON public.whatsapp_provider_config
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'owner'::app_role) OR
    has_role(auth.uid(), 'superadmin'::app_role)
  )
)
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'owner'::app_role) OR
    has_role(auth.uid(), 'superadmin'::app_role)
  )
);
