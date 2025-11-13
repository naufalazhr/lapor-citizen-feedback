-- Restrict Flowise and Fonnte Configuration to Superadmin Only
-- This migration removes tenant admin access to system-wide WhatsApp gateway configurations.
-- Only superadmins should be able to modify Flowise (AI agent) and Fonnte (WhatsApp gateway) settings.

-- ============================================================================
-- PART 1: Restrict Flowise Configuration to Superadmin Only
-- ============================================================================

-- Drop admin policies that allow tenant admins to access flowise_config
DROP POLICY IF EXISTS "Admins can insert flowise config" ON flowise_config;
DROP POLICY IF EXISTS "Admins can update flowise config" ON flowise_config;
DROP POLICY IF EXISTS "Admins can view flowise config" ON flowise_config;
DROP POLICY IF EXISTS "Tenant admins can view own tenant flowise config" ON flowise_config;

-- The following policies remain active:
-- 1. "Service can read all flowise configs" (for Edge Functions)
-- 2. "Service role can read flowise config" (for Edge Functions)
-- 3. "Superadmins can manage flowise configs" (ALL operations)
-- 4. "Superadmins can view flowise configs" (SELECT)

-- ============================================================================
-- PART 2: Restrict Fonnte Configuration to Superadmin Only
-- ============================================================================

-- Drop admin policies that allow tenant admins to access fonnte_config
DROP POLICY IF EXISTS "Admins can insert fonnte config" ON fonnte_config;
DROP POLICY IF EXISTS "Admins can update fonnte config" ON fonnte_config;
DROP POLICY IF EXISTS "Admins can view fonnte config" ON fonnte_config;
DROP POLICY IF EXISTS "Tenant admins can view own tenant fonnte config" ON fonnte_config;

-- The following policies remain active:
-- 1. "Service can read all fonnte configs" (for Edge Functions)
-- 2. "Service role can read fonnte config" (for Edge Functions)
-- 3. "Superadmins can manage fonnte configs" (ALL operations)
-- 4. "Superadmins can view fonnte configs" (SELECT)

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary of changes:
-- 1. Removed all admin/owner access policies from flowise_config table
-- 2. Removed all admin/owner access policies from fonnte_config table
-- 3. Superadmin and service role policies remain intact
--
-- Result: Only superadmins can view and modify Flowise/Fonnte configurations
-- Tenant admins will receive RLS policy violations if they attempt to access these tables
-- ============================================================================
