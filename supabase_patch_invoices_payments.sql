-- Phase 6: Invoices & Payments Schema Migration

-- 1. Create sequences for Estimates and Invoices
CREATE SEQUENCE IF NOT EXISTS public.estimate_number_seq START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START WITH 1001;

-- 2. Create Estimates Table
CREATE TABLE IF NOT EXISTS public.estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estimate_number TEXT NOT NULL UNIQUE DEFAULT 'EST-' || nextval('public.estimate_number_seq')::text,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Approved', 'Rejected', 'Expired')),
    total NUMERIC NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE DEFAULT 'INV-' || nextval('public.invoice_number_seq')::text,
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC NOT NULL DEFAULT 0.00,
    tax NUMERIC NOT NULL DEFAULT 0.00,
    total NUMERIC NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Paid', 'Overdue')),
    due_date DATE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    stripe_payment_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable Row Level Security
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 5. Create Helper function (if it doesn't exist, though it's already defined)
CREATE OR REPLACE FUNCTION public.is_office_staff(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id AND role = 'office_staff'::public.user_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create RLS Policies
-- Estimates
DROP POLICY IF EXISTS "Allow office staff to manage estimates" ON public.estimates;
CREATE POLICY "Allow office staff to manage estimates" ON public.estimates
    FOR ALL TO authenticated
    USING (public.is_office_staff(auth.uid()))
    WITH CHECK (public.is_office_staff(auth.uid()));

-- Invoices
DROP POLICY IF EXISTS "Allow office staff to manage invoices" ON public.invoices;
CREATE POLICY "Allow office staff to manage invoices" ON public.invoices
    FOR ALL TO authenticated
    USING (public.is_office_staff(auth.uid()))
    WITH CHECK (public.is_office_staff(auth.uid()));

-- 7. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
