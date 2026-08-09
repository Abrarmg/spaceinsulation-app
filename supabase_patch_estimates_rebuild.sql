-- Phase 6 Rebuild: Document-Style Estimates Table

-- 1. Drop the existing estimates table
DROP TABLE IF EXISTS public.estimates CASCADE;

-- 2. Recreate estimates table with document-generation specific fields
CREATE TABLE public.estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estimate_number TEXT NOT NULL UNIQUE DEFAULT 'EST-' || nextval('public.estimate_number_seq')::text,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    home_size NUMERIC NOT NULL,
    insulation_type TEXT NOT NULL,
    insulation_rate NUMERIC NOT NULL,
    extra_work_description TEXT,
    extra_work_amount NUMERIC NOT NULL DEFAULT 0.00,
    total_amount NUMERIC NOT NULL,
    intro_text TEXT,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Approved', 'Rejected', 'Expired')),
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Configure Row Level Security (RLS)
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow office staff to manage estimates" ON public.estimates;
CREATE POLICY "Allow office staff to manage estimates" ON public.estimates
    FOR ALL TO authenticated
    USING (public.is_office_staff(auth.uid()))
    WITH CHECK (public.is_office_staff(auth.uid()));

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
