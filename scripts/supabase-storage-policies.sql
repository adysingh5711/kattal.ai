-- ============================================================================
-- Supabase Storage Policies: Row-Level Security for User-Owned Files
-- ============================================================================
--
-- These policies ensure users can only access files they uploaded.
-- Run this SQL in Supabase Dashboard → SQL Editor.
--
-- PREREQUISITE: You must have a storage bucket created in Supabase.
--   If you haven't created one yet, run:
--
--   INSERT INTO storage.buckets (id, name, public)
--   VALUES ('user-uploads', 'user-uploads', false);
--
-- ============================================================================

-- 1. Enable RLS on the storage.objects table (if not already)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies on this bucket (so we can re-create cleanly)
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- 3. INSERT Policy: Users can upload files into their own folder (user_id/*)
--    File path pattern: {user_id}/{filename}
CREATE POLICY "Users can upload their own files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. SELECT Policy: Users can only view/download their own files
CREATE POLICY "Users can view their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. UPDATE Policy: Users can only update their own files
CREATE POLICY "Users can update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 6. DELETE Policy: Users can only delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- Verification: Check policies are correctly applied
-- ============================================================================
-- Run this query to verify:
--
--   SELECT policyname, cmd, qual, with_check
--   FROM pg_policies
--   WHERE tablename = 'objects' AND schemaname = 'storage';
--
-- ============================================================================
