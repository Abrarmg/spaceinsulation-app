-- Supabase Schema Patch for Space Insulation App (Phase 3)
-- Run this in your Supabase SQL Editor to add missing columns, tables, and storage buckets:

-- 1. Ensure jobs table has signature columns
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS customer_signature_url TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE;

-- 2. Create job_media table for tracking uploads
CREATE TABLE IF NOT EXISTS public.job_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('before', 'after', 'permit')),
    storage_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Configure RLS for job_media table
ALTER TABLE public.job_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous read/write on job_media" ON public.job_media;
CREATE POLICY "Allow anonymous read/write on job_media" ON public.job_media
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- 4. Create the 'job-media' bucket in storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-media', 'job-media', false)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage policies for anonymous client uploads
DROP POLICY IF EXISTS "Allow anonymous uploads to job-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous read from job-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous delete/update from job-media" ON storage.objects;

CREATE POLICY "Allow anonymous uploads to job-media" ON storage.objects
    FOR INSERT
    TO anon
    WITH CHECK (bucket_id = 'job-media');
    
CREATE POLICY "Allow anonymous read from job-media" ON storage.objects
    FOR SELECT
    TO anon
    USING (bucket_id = 'job-media');
    
CREATE POLICY "Allow anonymous delete/update from job-media" ON storage.objects
    FOR ALL
    TO anon
    USING (bucket_id = 'job-media');

-- 6. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
