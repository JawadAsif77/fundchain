-- Storage bucket policies for milestone-media
-- This fixes the "new row violates row-level security policy" error

-- Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('milestone-media', 'milestone-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated users to upload milestone media" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to milestone media" ON storage.objects;
DROP POLICY IF EXISTS "Allow creators to delete their milestone media" ON storage.objects;

-- Policy 1: Allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload milestone media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'milestone-media'
);

-- Policy 2: Allow anyone to view/download files (public bucket)
CREATE POLICY "Allow public read access to milestone media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'milestone-media');

-- Policy 3: Allow creators to update their files
CREATE POLICY "Allow creators to update milestone media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'milestone-media');

-- Policy 4: Allow creators to delete their files
CREATE POLICY "Allow creators to delete their milestone media"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'milestone-media');
