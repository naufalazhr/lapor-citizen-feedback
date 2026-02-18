-- Ensure only one active flowise config per tenant.
-- Adds a BEFORE trigger that automatically deactivates all other active configs
-- for the same tenant when a new one is set to is_active = true.
-- This prevents unique constraint violations (409) on INSERT or UPDATE.

CREATE OR REPLACE FUNCTION public.ensure_single_active_flowise_config()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.flowise_config
    SET is_active = false,
        updated_at = NOW()
    WHERE tenant_id = NEW.tenant_id
      AND id != NEW.id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS before_flowise_config_active_change ON public.flowise_config;
CREATE TRIGGER before_flowise_config_active_change
  BEFORE INSERT OR UPDATE ON public.flowise_config
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_active_flowise_config();
