-- Fix: The flowise_config table was originally created with a GLOBAL unique
-- constraint on config_name alone ("flowise_config_config_name_key").
-- In a multi-tenant SaaS, this incorrectly prevents more than one tenant from
-- having a config named "default".
--
-- Fix: Drop the global constraint and replace it with a per-tenant unique
-- constraint so that each tenant can have their own "default" config independently.

-- Step 1: Drop the old global unique constraint on config_name only
ALTER TABLE public.flowise_config
  DROP CONSTRAINT IF EXISTS flowise_config_config_name_key;

-- Step 2: Add a per-tenant unique constraint (idempotent check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'flowise_config_tenant_config_name_unique'
      AND conrelid = 'public.flowise_config'::regclass
  ) THEN
    ALTER TABLE public.flowise_config
      ADD CONSTRAINT flowise_config_tenant_config_name_unique
      UNIQUE (tenant_id, config_name);
  END IF;
END $$;
