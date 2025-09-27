/*
  # Add business image URL field

  1. Schema Changes
    - Add `business_image_url` column to `businesses` table
    - Column will store the URL of the business logo/image
    - Column is optional (nullable)

  2. Notes
    - This field will be used to store business logos uploaded via the storage service
    - Images will be stored in the 'business-images' storage bucket
*/

-- Add business_image_url column to businesses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'business_image_url'
  ) THEN
    ALTER TABLE businesses ADD COLUMN business_image_url text;
  END IF;
END $$;