-- ============================================================================
-- Add user suspension support
-- Adds is_active column to profiles for suspend/reactivate functionality.
-- Works in tandem with Supabase auth banned_until for actual login blocking.
-- ============================================================================

-- Add is_active column (default true — all existing users are active)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
