-- Dedicated Assessments Table for Jobber-Style Assessment Workflow
CREATE TABLE IF NOT EXISTS public.assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    customer_id UUID NULL REFERENCES public.customers(id) ON DELETE SET NULL,
    assigned_to UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    scheduled_date DATE NULL,
    start_time TIME NULL,
    end_time TIME NULL,
    status TEXT NOT NULL DEFAULT 'unscheduled',
    notes TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT assessments_status_check CHECK (status IN ('unscheduled', 'scheduled', 'completed', 'cancelled'))
);

-- Enable Row Level Security
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

-- Security Grants & Permissions
REVOKE ALL ON public.assessments FROM anon, public;
REVOKE ALL ON public.assessments FROM authenticated;
GRANT ALL ON public.assessments TO authenticated;

-- RLS Policy: Office Staff & Admins can manage all assessments
DROP POLICY IF EXISTS "Allow office staff to manage assessments" ON public.assessments;
CREATE POLICY "Allow office staff to manage assessments" ON public.assessments
    FOR ALL TO authenticated
    USING (public.is_office_staff(auth.uid()))
    WITH CHECK (public.is_office_staff(auth.uid()));

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_assessments_lead_id ON public.assessments(lead_id);
CREATE INDEX IF NOT EXISTS idx_assessments_assigned_to ON public.assessments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_assessments_scheduled_date ON public.assessments(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON public.assessments(status);

-- Reload postgrest schema cache
NOTIFY pgrst, 'reload schema';
