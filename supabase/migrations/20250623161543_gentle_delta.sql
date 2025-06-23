/*
  # Fix Platform Constraint and Add New Platforms

  1. Changes
    - Update the platform check constraint to include additional platforms
    - Add support for tiktok, wechat, and line platforms
    - Ensure backward compatibility with existing data

  2. Security
    - Maintains existing RLS policies
    - No changes to permissions or access control
*/

-- Update the platform check constraint to include additional platforms
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_platform_check;

ALTER TABLE customers ADD CONSTRAINT customers_platform_check 
CHECK (platform IN ('facebook', 'instagram', 'telegram', 'walk_in', 'other', 'tiktok', 'wechat', 'line'));