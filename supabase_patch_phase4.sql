-- Supabase Seed Data for Space Insulation App (Phase 4)
-- Run this in your Supabase SQL Editor to insert mock crew profiles for scheduling assignments:

-- 1. Insert mock field technicians/workers
INSERT INTO public.profiles (id, full_name, role)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'John Doe (Crew Lead)', 'field_worker'),
  ('00000000-0000-0000-0000-000000000002', 'Jane Smith (Lead Installer)', 'field_worker'),
  ('00000000-0000-0000-0000-000000000003', 'Marcus Vance (Helper Tech)', 'field_worker'),
  ('00000000-0000-0000-0000-000000000004', 'Sarah Chen (Supervisor)', 'field_worker')
ON CONFLICT (id) DO UPDATE 
SET full_name = EXCLUDED.full_name, role = EXCLUDED.role;

-- 2. Reload PostgREST schema cache (optional verification)
NOTIFY pgrst, 'reload schema';
