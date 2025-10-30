-- Part 1: Add new enum values (must be separate transaction)
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'viewer';