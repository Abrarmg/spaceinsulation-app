-- Harden customer/contact foreign keys
-- Prevent accidental cascade deletion of historical Jobs and Invoices

-- 1. Jobs: Replace CASCADE with RESTRICT
ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_customer_id_fkey;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE RESTRICT;

-- 2. Invoices: Replace CASCADE with RESTRICT
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_customer_id_fkey;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES public.customers(id)
  ON DELETE RESTRICT;

-- 3. Pre-sales relationships are verified as ON DELETE SET NULL:
-- public.estimates.customer_id: estimates_customer_id_fkey (ON DELETE SET NULL)
-- public.leads.customer_id: leads_customer_id_fkey (ON DELETE SET NULL)
-- public.assessments.customer_id: assessments_customer_id_fkey (ON DELETE SET NULL)

NOTIFY pgrst, 'reload schema';
