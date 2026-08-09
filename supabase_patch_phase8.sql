-- Phase 8: Database migrations for Worker Dashboard & Reporting

-- 1. Add checklist and materials_used columns to public.jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '{"baffle_installation": false, "air_sealing": false, "r38_blown_in": false, "hatch_insulation": false}'::jsonb;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS materials_used TEXT DEFAULT '';

-- 2. Create the job_issues table for "Report a Problem" feature
CREATE TABLE IF NOT EXISTS public.job_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable Row Level Security on job_issues
ALTER TABLE public.job_issues ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for job_issues
DROP POLICY IF EXISTS "Allow office staff to manage job issues" ON public.job_issues;
DROP POLICY IF EXISTS "Allow workers to view issues on assigned jobs" ON public.job_issues;
DROP POLICY IF EXISTS "Allow workers to report issues" ON public.job_issues;

-- A. Office staff: full management of all job issues
CREATE POLICY "Allow office staff to manage job issues" ON public.job_issues
    FOR ALL TO authenticated
    USING (public.is_office_staff(auth.uid()))
    WITH CHECK (public.is_office_staff(auth.uid()));

-- B. Field workers: read issues they reported
CREATE POLICY "Allow workers to view issues on assigned jobs" ON public.job_issues
    FOR SELECT TO authenticated
    USING (worker_id = auth.uid() OR public.is_office_staff(auth.uid()));

-- C. Field workers: insert issues reporting problems
CREATE POLICY "Allow workers to report issues" ON public.job_issues
    FOR INSERT TO authenticated
    WITH CHECK (worker_id = auth.uid());

-- 5. Reload Postgrest schema cache
NOTIFY pgrst, 'reload schema';
