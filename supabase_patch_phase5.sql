-- Phase 5: Employee Management, Time Tracking & Geolocation Setup

-- 1. Create wage table for secure column-level database RLS (separated from profiles)
CREATE TABLE IF NOT EXISTS public.profile_wages (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.00
);

-- 2. Add extra fields to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS availability TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS certification_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS certification_expiry DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_given_at TIMESTAMP WITH TIME ZONE;

-- 3. Create time entries table
CREATE TABLE IF NOT EXISTS public.time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    clock_in TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    clock_out TIMESTAMP WITH TIME ZONE,
    clock_in_lat NUMERIC,
    clock_in_lng NUMERIC,
    clock_out_lat NUMERIC,
    clock_out_lng NUMERIC
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_wages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- 5. Drop old policies if any to prevent duplicates
DROP POLICY IF EXISTS "Allow authenticated read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile basic info" ON public.profiles;
DROP POLICY IF EXISTS "Allow office staff to manage profiles" ON public.profiles;

DROP POLICY IF EXISTS "Allow office staff to read wages" ON public.profile_wages;
DROP POLICY IF EXISTS "Allow office staff to write wages" ON public.profile_wages;

DROP POLICY IF EXISTS "Allow office staff to manage time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Allow workers to read own time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Allow workers to insert own time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Allow workers to update own time entries" ON public.time_entries;

-- 6. Create Profiles Policies
CREATE POLICY "Allow authenticated read profiles" ON public.profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow users to update their own profile basic info" ON public.profiles
    FOR UPDATE TO authenticated 
    USING (id = auth.uid()) 
    WITH CHECK (id = auth.uid());

CREATE POLICY "Allow office staff to manage profiles" ON public.profiles
    FOR ALL TO authenticated
    USING (public.is_office_staff(auth.uid()));

-- 7. Create Wages Policies (Admin Only)
CREATE POLICY "Allow office staff to read wages" ON public.profile_wages
    FOR SELECT TO authenticated
    USING (public.is_office_staff(auth.uid()));

CREATE POLICY "Allow office staff to write wages" ON public.profile_wages
    FOR ALL TO authenticated
    USING (public.is_office_staff(auth.uid()));

-- 8. Create Time Entries Policies (Worker & Admin Access)
CREATE POLICY "Allow office staff to manage time entries" ON public.time_entries
    FOR ALL TO authenticated
    USING (public.is_office_staff(auth.uid()));

CREATE POLICY "Allow workers to read own time entries" ON public.time_entries
    FOR SELECT TO authenticated
    USING (worker_id = auth.uid());

CREATE POLICY "Allow workers to insert own time entries" ON public.time_entries
    FOR INSERT TO authenticated
    WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Allow workers to update own time entries" ON public.time_entries
    FOR UPDATE TO authenticated
    USING (worker_id = auth.uid())
    WITH CHECK (worker_id = auth.uid());


-- 9. Seed Auth Test Users (Password is 'password123')
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, role, aud)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'admin@spaceinsulation.com', crypt('password123', gen_salt('bf', 10)), now(), now(), now(), 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-000000000002', 'worker@spaceinsulation.com', crypt('password123', gen_salt('bf', 10)), now(), now(), now(), 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '{"sub":"a0000000-0000-0000-0000-000000000001","email":"admin@spaceinsulation.com"}', 'email', 'a0000000-0000-0000-0000-000000000001', now(), now(), now()),
  ('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', '{"sub":"b0000000-0000-0000-0000-000000000002","email":"worker@spaceinsulation.com"}', 'email', 'b0000000-0000-0000-0000-000000000002', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

-- Seed matching Profiles
INSERT INTO public.profiles (id, full_name, role, certification_name, certification_expiry)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'Alice Admin (Office)', 'office_staff', 'OSHA 30', '2027-01-01'),
  ('b0000000-0000-0000-0000-000000000002', 'John Worker (Crew)', 'field_worker', 'BPI Specialist', '2026-08-15')
ON CONFLICT (id) DO NOTHING;

-- Seed matching Wages
INSERT INTO public.profile_wages (id, hourly_rate)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 35.00),
  ('b0000000-0000-0000-0000-000000000002', 24.50)
ON CONFLICT (id) DO NOTHING;
