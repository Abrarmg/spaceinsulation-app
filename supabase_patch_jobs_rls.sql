-- Phase 7: Clean Up and Enforce Proper RLS Policies on jobs table

-- 1. Disable RLS temporarily to clean up policies cleanly
ALTER TABLE public.jobs DISABLE ROW LEVEL SECURITY;

-- 2. Drop all existing policies on jobs
DROP POLICY IF EXISTS "Allow anonymous read/write on jobs" ON public.jobs;
DROP POLICY IF EXISTS "Allow office staff to manage jobs" ON public.jobs;
DROP POLICY IF EXISTS "Allow workers to view assigned jobs" ON public.jobs;
DROP POLICY IF EXISTS "Allow workers to update assigned jobs" ON public.jobs;

-- 3. Re-enable Row Level Security
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- 4. Create the helper function if not already present (re-used from profiles)
CREATE OR REPLACE FUNCTION public.is_office_staff(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id AND role = 'office_staff'::public.user_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create correct RLS policies for jobs table
-- A. Office staff: full management of all jobs
CREATE POLICY "Allow office staff to manage jobs" ON public.jobs
    FOR ALL TO authenticated
    USING (public.is_office_staff(auth.uid()))
    WITH CHECK (public.is_office_staff(auth.uid()));

-- B. Field workers: read only their assigned jobs
CREATE POLICY "Allow workers to view assigned jobs" ON public.jobs
    FOR SELECT TO authenticated
    USING (
        assigned_worker_id = auth.uid() 
        OR public.is_office_staff(auth.uid())
    );

-- C. Field workers: update operational details of their assigned jobs
CREATE POLICY "Allow workers to update assigned jobs" ON public.jobs
    FOR UPDATE TO authenticated
    USING (assigned_worker_id = auth.uid() OR public.is_office_staff(auth.uid()))
    WITH CHECK (assigned_worker_id = auth.uid() OR public.is_office_staff(auth.uid()));

-- 6. Reload Postgrest schema cache
NOTIFY pgrst, 'reload schema';
