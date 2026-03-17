-- =============================================================================
-- Auto-fill tenant_id on reports table for public form submissions
--
-- The /lapor public form inserts via anon client without tenant_id.
-- This trigger resolves the tenant automatically for single-tenant deployments.
-- For multi-tenant deployments, tenant_id must be provided explicitly.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. BEFORE INSERT trigger: auto-fill reports.tenant_id from tenants table
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_fill_report_tenant_id()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_count INT;
BEGIN
  -- If tenant_id is already provided, pass through (edge functions, API, admin)
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Count active tenants
  SELECT COUNT(*) INTO v_count
  FROM tenants
  WHERE status IN ('active', 'trial');

  IF v_count = 1 THEN
    -- Single-tenant deployment: auto-fill
    SELECT id INTO v_tenant_id
    FROM tenants
    WHERE status IN ('active', 'trial')
    LIMIT 1;

    NEW.tenant_id := v_tenant_id;
  ELSIF v_count = 0 THEN
    RAISE EXCEPTION 'No active tenant found. Cannot insert report without tenant_id.';
  ELSE
    -- Multi-tenant: require explicit tenant_id
    RAISE EXCEPTION 'Multiple active tenants found (%). Report must include explicit tenant_id.', v_count;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_fill_report_tenant_id ON reports;
CREATE TRIGGER trg_auto_fill_report_tenant_id
  BEFORE INSERT ON reports
  FOR EACH ROW
  EXECUTE FUNCTION auto_fill_report_tenant_id();

-- ---------------------------------------------------------------------------
-- 2. RPC function: get_default_tenant_id() for client-side defense-in-depth
--    Callable by anon role so the public /lapor form can pre-fetch tenant_id.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_default_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM tenants
  WHERE status IN ('active', 'trial');

  IF v_count = 1 THEN
    SELECT id INTO v_tenant_id
    FROM tenants
    WHERE status IN ('active', 'trial')
    LIMIT 1;

    RETURN v_tenant_id;
  END IF;

  -- Ambiguous or no tenant — return NULL (caller should handle)
  RETURN NULL;
END;
$$;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION get_default_tenant_id() TO anon;
GRANT EXECUTE ON FUNCTION get_default_tenant_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Backfill existing reports with NULL tenant_id
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_default_tenant UUID;
BEGIN
  SELECT id INTO v_default_tenant
  FROM tenants
  WHERE status IN ('active', 'trial')
  LIMIT 1;

  IF v_default_tenant IS NOT NULL THEN
    UPDATE reports
    SET tenant_id = v_default_tenant
    WHERE tenant_id IS NULL;

    RAISE NOTICE 'Backfilled reports with tenant_id = %', v_default_tenant;
  ELSE
    RAISE NOTICE 'No active tenant found — skipping backfill';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Add NOT NULL constraint on reports.tenant_id (idempotent)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'tenant_id' AND is_nullable = 'YES'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM reports WHERE tenant_id IS NULL LIMIT 1) THEN
      ALTER TABLE reports ALTER COLUMN tenant_id SET NOT NULL;
    ELSE
      RAISE NOTICE 'reports: skipping NOT NULL — some rows still have NULL tenant_id';
    END IF;
  END IF;
END $$;
