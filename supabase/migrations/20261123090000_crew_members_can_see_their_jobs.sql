-- Crew members can see and work on the jobs they're on.
--
-- A job's people are its main assignee (jobs.assigned_worker_id) plus its crew
-- (job_crew rows). The job rules only allowed the main assignee, so when a
-- crew was added everyone except the first person was blocked from the job.

-- True when the person is on the job's crew. SECURITY DEFINER so the check
-- itself isn't limited by row rules.
CREATE OR REPLACE FUNCTION public.is_on_job_crew(target_job_id UUID, worker_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.job_crew
    WHERE job_id = target_job_id AND worker_id = worker_uid
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_on_job_crew(UUID, UUID) TO authenticated;

-- Read: office staff, the main assignee, or anyone on the crew.
DROP POLICY IF EXISTS "Allow workers to view assigned jobs" ON public.jobs;
CREATE POLICY "Allow workers to view assigned jobs" ON public.jobs
  FOR SELECT TO authenticated
  USING (
    assigned_worker_id = auth.uid()
    OR public.is_on_job_crew(id, auth.uid())
    OR public.is_office_staff(auth.uid())
  );

-- Update (status, checklist, sign-off…): the same people.
DROP POLICY IF EXISTS "Allow workers to update assigned jobs" ON public.jobs;
CREATE POLICY "Allow workers to update assigned jobs" ON public.jobs
  FOR UPDATE TO authenticated
  USING (
    assigned_worker_id = auth.uid()
    OR public.is_on_job_crew(id, auth.uid())
    OR public.is_office_staff(auth.uid())
  )
  WITH CHECK (
    assigned_worker_id = auth.uid()
    OR public.is_on_job_crew(id, auth.uid())
    OR public.is_office_staff(auth.uid())
  );

-- Make sure every main assignee is also listed in the job's crew.
INSERT INTO public.job_crew (job_id, worker_id)
SELECT j.id, j.assigned_worker_id
FROM public.jobs j
WHERE j.assigned_worker_id IS NOT NULL
  AND j.assigned_worker_id IN (SELECT id FROM public.profiles)
ON CONFLICT (job_id, worker_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
