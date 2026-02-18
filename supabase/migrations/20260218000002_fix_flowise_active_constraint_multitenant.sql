-- Fix: Drop the global unique constraint on is_active that incorrectly restricts
-- only one active flowise config across the ENTIRE table.
--
-- In a multi-tenant SaaS, each tenant should be able to have its own active
-- config independently. Per-tenant uniqueness is already correctly enforced by:
--   idx_flowise_config_tenant_active_unique
--   (UNIQUE on tenant_id WHERE is_active = true)
--
-- The global idx_flowise_active was preventing setting is_active = true for
-- any row when another tenant's row was already active.

DROP INDEX IF EXISTS idx_flowise_active;
