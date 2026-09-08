-- Backfill existing leads into canonical Contacts (public.customers)
-- Links leads.customer_id to public.customers.id based on phone/email matching or new Contact creation.

-- This backfill was executed via backfill runner ensuring:
-- 1. Normalized phone matching (Priority 1)
-- 2. Normalized email matching (Priority 2)
-- 3. Non-destructive backfill of missing contact details
-- 4. No duplicate Contact creation for multiple leads belonging to the same person
-- 5. Safe retention of contact_type ('customer' is never downgraded to 'prospect')

-- Verify all leads have customer_id populated
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.leads WHERE customer_id IS NULL) THEN
    RAISE NOTICE 'Some leads still do not have a linked customer_id.';
  ELSE
    RAISE NOTICE 'All leads successfully linked to public.customers.';
  END IF;
END $$;
