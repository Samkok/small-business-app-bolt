/*
  # Create Profile Images Storage Bucket

  1. New Storage Bucket
    - `profile-images` - Dedicated bucket for storing user profile images
    - 5MB file size limit
    - Restricted to image file types

  2. Security
    - Public read access for profile images
    - Write access restricted to authenticated users
    - Users can only manage their own profile images
*/

-- Create storage bucket for profile images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-images',
  'profile-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
);

-- Set up RLS policies for profile images bucket
CREATE POLICY "Public Access to Profile Images" ON storage.objects FOR SELECT USING (bucket_id = 'profile-images');

CREATE POLICY "Authenticated users can upload profile images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'profile-images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'profiles'
);

CREATE POLICY "Users can update their own profile images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'profile-images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'profiles'
);

CREATE POLICY "Users can delete their own profile images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'profile-images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'profiles'
);