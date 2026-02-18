-- Fix: Drop the global unique constraint on is_active that incorrectly restricts
-- only one active fonnte config across the ENTIRE table.
--
-- In a multi-tenant SaaS, each tenant should be able to have its own active
-- config independently. The global idx_fonnte_active was preventing setting
-- is_active = true for any row when another tenant's row was already active.

DROP INDEX IF EXISTS idx_fonnte_active;

-- Add BEFORE trigger: auto-deactivate other active configs for same tenant
-- when a new one is set to is_active = true.
CREATE OR REPLACE FUNCTION public.ensure_single_active_fonnte_config()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.fonnte_config
    SET is_active = false,
        updated_at = NOW()
    WHERE tenant_id = NEW.tenant_id
      AND id != NEW.id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS before_fonnte_config_active_change ON public.fonnte_config;
CREATE TRIGGER before_fonnte_config_active_change
  BEFORE INSERT OR UPDATE ON public.fonnte_config
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_active_fonnte_config();
