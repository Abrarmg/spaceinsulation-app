-- Allow service_address and phone to be nullable in public.customers
-- This is necessary for public.customers to act as canonical Contacts table,
-- as pre-sales contacts, Facebook leads, and CSV imports may not have a physical service address or phone immediately.

ALTER TABLE public.customers ALTER COLUMN service_address DROP NOT NULL;
ALTER TABLE public.customers ALTER COLUMN phone DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
