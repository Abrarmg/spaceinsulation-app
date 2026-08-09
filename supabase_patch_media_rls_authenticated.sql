-- Phase 8: Storage and Media RLS fix for Authenticated Workers

-- 1. Update job_media table policies to allow public (anon & authenticated) access
ALTER TABLE public.job_media DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous read/write on job_media" ON public.job_media;
DROP POLICY IF EXISTS "Allow authenticated read/write on job_media" ON public.job_media;

ALTER TABLE public.job_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read/write on job_media" ON public.job_media
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

-- 2. Update storage.objects bucket policies to allow public (anon & authenticated) access
DROP POLICY IF EXISTS "Allow anonymous uploads to job-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous read from job-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous delete/update from job-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to job-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated read from job-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete/update from job-media" ON storage.objects;

CREATE POLICY "Allow authenticated uploads to job-media" ON storage.objects
    FOR INSERT
    TO public
    WITH CHECK (bucket_id = 'job-media');
    
CREATE POLICY "Allow authenticated read from job-media" ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'job-media');
    
CREATE POLICY "Allow authenticated delete/update from job-media" ON storage.objects
    FOR ALL
    TO public
    USING (bucket_id = 'job-media');

-- 3. Reload cache
NOTIFY pgrst, 'reload schema';
