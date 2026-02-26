-- Backfill tenant_id for reports submitted via API that were created without a tenant_id.
-- Tenant is derived from the active Flowise API key (server-side, not hardcoded UUID).
-- Safe to run multiple times — only updates rows where tenant_id IS NULL.

UPDATE public.reports
SET tenant_id = (
  SELECT tenant_id
  FROM public.api_keys
  WHERE key_name = 'flowise'
    AND is_active = true
  LIMIT 1
)
WHERE tenant_id IS NULL;
