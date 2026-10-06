-- Migration: Create inspection_reports, inspection_photos, storage bucket, and RLS policies

-- 1. Inspection Reports Table
CREATE TABLE IF NOT EXISTS public.inspection_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    assessment_id UUID NULL REFERENCES public.assessments(id) ON DELETE SET NULL,
    job_id UUID NULL REFERENCES public.jobs(id) ON DELETE SET NULL,
    inspected_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    inspection_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
    current_r_value TEXT NULL,
    target_r_value TEXT NULL,
    attic_sqft NUMERIC NULL,
    current_insulation_type TEXT NULL,
    insulation_depth TEXT NULL,
    soffits_baffles_condition TEXT NULL,
    general_condition TEXT NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for inspection_reports
CREATE INDEX IF NOT EXISTS idx_inspection_reports_customer_id ON public.inspection_reports(customer_id);
CREATE INDEX IF NOT EXISTS idx_inspection_reports_job_id ON public.inspection_reports(job_id);
CREATE INDEX IF NOT EXISTS idx_inspection_reports_assessment_id ON public.inspection_reports(assessment_id);
CREATE INDEX IF NOT EXISTS idx_inspection_reports_inspected_by ON public.inspection_reports(inspected_by);
CREATE INDEX IF NOT EXISTS idx_inspection_reports_status ON public.inspection_reports(status);
CREATE INDEX IF NOT EXISTS idx_inspection_reports_date ON public.inspection_reports(inspection_date DESC);

-- 2. Inspection Photos Table
CREATE TABLE IF NOT EXISTS public.inspection_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_report_id UUID NOT NULL REFERENCES public.inspection_reports(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    uploaded_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    category TEXT NOT NULL CHECK (category IN (
        'insulation_depth', 
        'attic_overview', 
        'soffits_baffles', 
        'air_sealing', 
        'mold_moisture', 
        'attic_hatch', 
        'other'
    )),
    storage_path TEXT NOT NULL,
    file_name TEXT NULL,
    caption TEXT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for inspection_photos
CREATE INDEX IF NOT EXISTS idx_inspection_photos_report_id ON public.inspection_photos(inspection_report_id);
CREATE INDEX IF NOT EXISTS idx_inspection_photos_customer_id ON public.inspection_photos(customer_id);
CREATE INDEX IF NOT EXISTS idx_inspection_photos_category ON public.inspection_photos(category);

-- 3. Private Storage Bucket for Inspection Photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-photos', 'inspection-photos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 4. Enable Row Level Security
ALTER TABLE public.inspection_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;

-- Security Grants
REVOKE ALL ON public.inspection_reports FROM anon, public;
REVOKE ALL ON public.inspection_photos FROM anon, public;
GRANT ALL ON public.inspection_reports TO authenticated;
GRANT ALL ON public.inspection_photos TO authenticated;

-- 5. Helper Function: Check worker access to a customer
CREATE OR REPLACE FUNCTION public.worker_has_customer_access(target_customer_id UUID, worker_uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if worker is assigned directly to a job for this customer
    IF EXISTS (
        SELECT 1 FROM public.jobs
        WHERE customer_id = target_customer_id
          AND assigned_worker_id = worker_uid
    ) THEN
        RETURN TRUE;
    END IF;

    -- Check if worker is part of job_crew for a job for this customer
    IF EXISTS (
        SELECT 1 FROM public.job_crew jc
        JOIN public.jobs j ON j.id = jc.job_id
        WHERE j.customer_id = target_customer_id
          AND jc.worker_id = worker_uid
    ) THEN
        RETURN TRUE;
    END IF;

    -- Check if worker is assigned to an assessment for this customer
    IF EXISTS (
        SELECT 1 FROM public.assessments
        WHERE customer_id = target_customer_id
          AND assigned_to = worker_uid
    ) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RLS Policies for inspection_reports
DROP POLICY IF EXISTS "Office staff full access to inspection_reports" ON public.inspection_reports;
CREATE POLICY "Office staff full access to inspection_reports" ON public.inspection_reports
    FOR ALL TO authenticated
    USING (public.is_office_staff(auth.uid()))
    WITH CHECK (public.is_office_staff(auth.uid()));

DROP POLICY IF EXISTS "Workers view assigned customer inspections" ON public.inspection_reports;
CREATE POLICY "Workers view assigned customer inspections" ON public.inspection_reports
    FOR SELECT TO authenticated
    USING (
        inspected_by = auth.uid()
        OR public.worker_has_customer_access(customer_id, auth.uid())
    );

DROP POLICY IF EXISTS "Workers insert assigned customer inspections" ON public.inspection_reports;
CREATE POLICY "Workers insert assigned customer inspections" ON public.inspection_reports
    FOR INSERT TO authenticated
    WITH CHECK (
        inspected_by = auth.uid()
        OR public.worker_has_customer_access(customer_id, auth.uid())
    );

DROP POLICY IF EXISTS "Workers update draft assigned customer inspections" ON public.inspection_reports;
CREATE POLICY "Workers update draft assigned customer inspections" ON public.inspection_reports
    FOR UPDATE TO authenticated
    USING (
        (status = 'draft' AND (inspected_by = auth.uid() OR public.worker_has_customer_access(customer_id, auth.uid())))
    )
    WITH CHECK (
        inspected_by = auth.uid() OR public.worker_has_customer_access(customer_id, auth.uid())
    );

-- 7. RLS Policies for inspection_photos
DROP POLICY IF EXISTS "Office staff full access to inspection_photos" ON public.inspection_photos;
CREATE POLICY "Office staff full access to inspection_photos" ON public.inspection_photos
    FOR ALL TO authenticated
    USING (public.is_office_staff(auth.uid()))
    WITH CHECK (public.is_office_staff(auth.uid()));

DROP POLICY IF EXISTS "Workers view assigned customer inspection_photos" ON public.inspection_photos;
CREATE POLICY "Workers view assigned customer inspection_photos" ON public.inspection_photos
    FOR SELECT TO authenticated
    USING (
        uploaded_by = auth.uid()
        OR public.worker_has_customer_access(customer_id, auth.uid())
    );

DROP POLICY IF EXISTS "Workers insert assigned customer inspection_photos" ON public.inspection_photos;
CREATE POLICY "Workers insert assigned customer inspection_photos" ON public.inspection_photos
    FOR INSERT TO authenticated
    WITH CHECK (
        uploaded_by = auth.uid()
        OR public.worker_has_customer_access(customer_id, auth.uid())
    );

DROP POLICY IF EXISTS "Workers delete own inspection_photos" ON public.inspection_photos;
CREATE POLICY "Workers delete own inspection_photos" ON public.inspection_photos
    FOR DELETE TO authenticated
    USING (
        uploaded_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.inspection_reports ir
            WHERE ir.id = inspection_photos.inspection_report_id
              AND ir.status = 'draft'
        )
    );

-- 8. Storage RLS Policies for inspection-photos bucket
DROP POLICY IF EXISTS "Office staff full access to inspection-photos storage" ON storage.objects;
CREATE POLICY "Office staff full access to inspection-photos storage" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'inspection-photos' AND public.is_office_staff(auth.uid()))
    WITH CHECK (bucket_id = 'inspection-photos' AND public.is_office_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users view inspection-photos storage" ON storage.objects;
CREATE POLICY "Authenticated users view inspection-photos storage" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'inspection-photos');

DROP POLICY IF EXISTS "Authenticated workers upload to inspection-photos storage" ON storage.objects;
CREATE POLICY "Authenticated workers upload to inspection-photos storage" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'inspection-photos');

DROP POLICY IF EXISTS "Authenticated workers delete from inspection-photos storage" ON storage.objects;
CREATE POLICY "Authenticated workers delete from inspection-photos storage" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'inspection-photos');

-- 9. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
