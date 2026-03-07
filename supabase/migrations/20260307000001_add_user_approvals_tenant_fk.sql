-- Add missing FK from user_approvals.tenant_id to tenants.id
-- This FK exists on production (added manually) but was never captured in a migration.
-- Without it, PostgREST cannot resolve the embedded join `tenant:tenants(...)` used in Users.tsx.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_approvals_tenant_id_fkey'
      AND table_name = 'user_approvals'
  ) THEN
    ALTER TABLE public.user_approvals
      ADD CONSTRAINT user_approvals_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
    RAISE NOTICE 'Added user_approvals_tenant_id_fkey';
  ELSE
    RAISE NOTICE 'user_approvals_tenant_id_fkey already exists, skipping';
  END IF;
END $$;
