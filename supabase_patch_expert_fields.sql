-- Phase 7: Add Manual Expert Details to Estimates
-- This adds the required snapshot fields to the estimates table.

ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS expert_name TEXT;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS expert_role TEXT;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS expert_email TEXT;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS expert_phone TEXT;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS expert_address TEXT;

-- Refresh PostgREST schema cache so the API immediately recognizes the new columns
NOTIFY pgrst, 'reload schema';
