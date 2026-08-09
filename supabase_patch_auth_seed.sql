-- Phase 6: Seed real bcrypt password hashes directly in Supabase
-- This SQL script forces standard bcrypt password hashes into the auth tables,
-- bypassing Gotrue email rate limits and resolving pgcrypto compatibility discrepancies.

-- 0. Ensure profiles columns from Phase 5 are created first
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS availability TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS certification_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS certification_expiry DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_given_at TIMESTAMP WITH TIME ZONE;

-- Ensure wages table from Phase 5 is created first
CREATE TABLE IF NOT EXISTS public.profile_wages (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.00
);

-- 1. Create or update the Admin account (Password: password123)
INSERT INTO auth.users (
  id, 
  email, 
  encrypted_password, 
  email_confirmed_at, 
  raw_app_meta_data, 
  raw_user_meta_data, 
  role, 
  aud,
  created_at,
  updated_at
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'admin@spaceinsulation.com',
  '$2b$10$BQ4tNsg2tLpzNewtzxp2eOrjNsKEDRUYyeCsG3/Gd6.qzUPyqe8.W',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Alice Admin (Office)"}',
  'authenticated',
  'authenticated',
  now(),
  now()
) ON CONFLICT (id) DO UPDATE 
SET encrypted_password = EXCLUDED.encrypted_password, email_confirmed_at = now();

-- 2. Create or update the Worker account (Password: password123)
INSERT INTO auth.users (
  id, 
  email, 
  encrypted_password, 
  email_confirmed_at, 
  raw_app_meta_data, 
  raw_user_meta_data, 
  role, 
  aud,
  created_at,
  updated_at
) VALUES (
  'b0000000-0000-0000-0000-000000000002',
  'worker@spaceinsulation.com',
  '$2b$10$BQ4tNsg2tLpzNewtzxp2eOrjNsKEDRUYyeCsG3/Gd6.qzUPyqe8.W',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"John Worker (Crew)"}',
  'authenticated',
  'authenticated',
  now(),
  now()
) ON CONFLICT (id) DO UPDATE 
SET encrypted_password = EXCLUDED.encrypted_password, email_confirmed_at = now();

-- 3. Link records to auth.identities (Setting provider_id explicitly to resolve NOT NULL constraints)
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '{"sub":"a0000000-0000-0000-0000-000000000001","email":"admin@spaceinsulation.com"}', 'email', 'a0000000-0000-0000-0000-000000000001', now(), now(), now()),
  ('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', '{"sub":"b0000000-0000-0000-0000-000000000002","email":"worker@spaceinsulation.com"}', 'email', 'b0000000-0000-0000-0000-000000000002', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

-- 4. Map matching public.profiles to establish roles
INSERT INTO public.profiles (id, full_name, role, certification_name, certification_expiry)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'Alice Admin (Office)', 'office_staff', 'OSHA 30', '2027-01-01'),
  ('b0000000-0000-0000-0000-000000000002', 'John Worker (Crew)', 'field_worker', 'BPI Specialist', '2026-08-15')
ON CONFLICT (id) DO UPDATE 
SET role = EXCLUDED.role;

-- 5. Seed default wages
INSERT INTO public.profile_wages (id, hourly_rate)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 35.00),
  ('b0000000-0000-0000-0000-000000000002', 24.50)
ON CONFLICT (id) DO UPDATE 
SET hourly_rate = EXCLUDED.hourly_rate;
