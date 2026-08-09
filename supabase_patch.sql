-- Supabase Schema Patch for Space Insulation App (Phase 1)
-- Run this in your Supabase SQL Editor to add missing columns to existing tables and enable public writes:

-- 1. Ensure columns exist on 'customers' table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS service_address TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS billing_address TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT DEFAULT 'email';

-- 2. Ensure columns exist on 'jobs' table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS job_number TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS scheduled_date DATE;

-- 3. Configure Row Level Security (RLS)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- 4. Drop and recreate policies to allow anonymous reads and writes
DROP POLICY IF EXISTS "Allow anonymous read/write on customers" ON public.customers;
DROP POLICY IF EXISTS "Allow anonymous read/write on jobs" ON public.jobs;

CREATE POLICY "Allow anonymous read/write on customers" ON public.customers
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow anonymous read/write on jobs" ON public.jobs
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- 5. Force reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
