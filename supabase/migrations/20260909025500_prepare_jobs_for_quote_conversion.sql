-- Migration: Prepare database schema for Quote -> Job conversion
-- 1. Extend public.jobs with estimate_id, lead_id, line_items, title
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS estimate_id UUID NULL REFERENCES public.estimates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_id UUID NULL REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS title TEXT NULL;

-- 2. Extend public.leads with customer_id
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS customer_id UUID NULL REFERENCES public.customers(id) ON DELETE SET NULL;

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_jobs_estimate_id ON public.jobs(estimate_id);
CREATE INDEX IF NOT EXISTS idx_jobs_lead_id ON public.jobs(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON public.leads(customer_id);

-- 4. Important duplicate protection: A Quote must only be convertible into ONE Job
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_unique_estimate_id
ON public.jobs(estimate_id)
WHERE estimate_id IS NOT NULL;

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
