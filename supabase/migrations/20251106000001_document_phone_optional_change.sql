-- Document manual change made via dashboard
-- This migration reflects the state already applied via admin dashboard on 2025-11-06
-- Phone field is now optional to support reports submitted from Flowise without phone collection

-- Update phone field configuration to optional
UPDATE public.api_field_configs
SET
  is_required = false,
  default_value = '"N/A"'::jsonb
WHERE field_name = 'phone';

-- Add comment for clarity
COMMENT ON TABLE public.api_field_configs IS
  'Configuration for API field validation and defaults. Phone field made optional on 2025-11-06.';

-- Log the change
DO $$
BEGIN
  RAISE NOTICE '✓ Phone field configuration updated:';
  RAISE NOTICE '  - field_name: phone';
  RAISE NOTICE '  - is_required: false (optional)';
  RAISE NOTICE '  - default_value: "N/A"';
  RAISE NOTICE '  - Purpose: Support Flowise reports without phone collection';
  RAISE NOTICE '  - Note: session_id is now the primary matching mechanism';
END $$;
