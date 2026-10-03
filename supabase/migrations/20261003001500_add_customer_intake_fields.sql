-- Add customer intake fields to public.customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS inquiry_date DATE,
  ADD COLUMN IF NOT EXISTS customer_needs TEXT[],
  ADD COLUMN IF NOT EXISTS square_footage INTEGER,
  ADD COLUMN IF NOT EXISTS asked_about_rebate BOOLEAN;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
