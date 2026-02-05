-- Create base types and functions required by subsequent migrations
-- This migration must run BEFORE 20251024130105
-- Uses idempotent syntax to be safe on existing databases

-- Create the app_role enum type with all values (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM (
      'admin',
      'member',
      'superadmin',
      'owner',
      'viewer',
      'opd_member'
    );
  END IF;
END $$;

-- Create the update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
