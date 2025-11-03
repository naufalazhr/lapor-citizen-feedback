-- =============================================================================
-- Add session_id to API Field Configuration
--
-- Purpose: Allow admin to configure session_id field requirements
-- Default: Optional (false) to maintain backward compatibility
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'Adding session_id to API field configuration...';
  RAISE NOTICE '=============================================================================';

  -- Insert session_id field configuration
  INSERT INTO api_field_configs (field_name, is_required, field_type, description, default_value)
  VALUES ('session_id', false, 'string', 'Flowise conversation session ID for exact matching (optional, recommended)', null)
  ON CONFLICT (field_name) DO UPDATE
  SET
    is_required = EXCLUDED.is_required,
    field_type = EXCLUDED.field_type,
    description = EXCLUDED.description,
    default_value = EXCLUDED.default_value;

  RAISE NOTICE '  ✓ session_id added to api_field_configs';
  RAISE NOTICE '  - field_name: session_id';
  RAISE NOTICE '  - is_required: false (optional)';
  RAISE NOTICE '  - default_value: null';

  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'Migration Complete: session_id field configuration added';
  RAISE NOTICE '=============================================================================';

END $$;

-- Add comment
COMMENT ON TABLE api_field_configs IS
'Configures which fields are required/optional for the submit-report API endpoint. Updated to include session_id field.';
