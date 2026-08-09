-- Supabase Schema Setup for Space Insulation App (Phase 1)
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/hcoxvaqeomtpcsegadip/sql/new)

-- 1. Create or update the 'customers' table
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    service_address TEXT,
    billing_address TEXT,
    preferred_contact_method TEXT DEFAULT 'email',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create or update the 'jobs' table
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    job_number TEXT NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    scheduled_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Configure Row Level Security (RLS)
-- For Phase 1 and testing, we'll allow public anonymous read and write access.
-- In production, you would restrict write access to authenticated users.

-- Enable RLS on both tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid duplication errors
DROP POLICY IF EXISTS "Allow anonymous read/write on customers" ON public.customers;
DROP POLICY IF EXISTS "Allow anonymous read/write on jobs" ON public.jobs;

-- Create policies to allow all operations for public/anonymous users
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
