-- ============================================================================
-- Phase 1a: Add OPD Member Role to Enum
-- ============================================================================

-- Add new role type to app_role enum
-- This must be committed before being used in other statements
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'opd_member';