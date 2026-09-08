-- Extend public.customers to act as canonical Contacts table

-- 1. Add columns with defaults
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS contact_type TEXT NOT NULL DEFAULT 'prospect',
  ADD COLUMN IF NOT EXISTS created_from TEXT NOT NULL DEFAULT 'manual_ui',
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Add check constraints
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_source_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_source_check
  CHECK (source IN ('facebook', 'csv_import', 'manual', 'existing_customer'));

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_contact_type_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_contact_type_check
  CHECK (contact_type IN ('prospect', 'customer'));

-- 3. Backfill existing records safely
-- For all records that existed before this migration:
-- source = 'existing_customer'
-- created_from = 'existing_record'
-- If contact has at least one linked Job OR Invoice:
--   contact_type = 'customer'
-- Otherwise:
--   contact_type = 'prospect'
UPDATE public.customers
SET 
  source = 'existing_customer',
  created_from = 'existing_record',
  contact_type = CASE 
    WHEN EXISTS (SELECT 1 FROM public.jobs j WHERE j.customer_id = customers.id)
      OR EXISTS (SELECT 1 FROM public.invoices i WHERE i.customer_id = customers.id)
    THEN 'customer'
    ELSE 'prospect'
  END,
  updated_at = now();

-- 4. Add indexes
CREATE INDEX IF NOT EXISTS idx_customers_source ON public.customers(source);
CREATE INDEX IF NOT EXISTS idx_customers_contact_type ON public.customers(contact_type);
CREATE INDEX IF NOT EXISTS idx_customers_is_archived ON public.customers(is_archived);

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
