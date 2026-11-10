-- Time on each job, separate from the day's clock in / clock out (time_entries).
-- Each start → stop of a job timer is one row; pausing ends the row and
-- resuming starts a new one, so a job's time is the sum of its rows.

CREATE TABLE IF NOT EXISTS public.job_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ NULL,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT job_time_entries_valid_range CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_job_time_entries_job_id ON public.job_time_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_job_time_entries_worker_started ON public.job_time_entries(worker_id, started_at DESC);

-- A person can only have one job timer running at a time.
CREATE UNIQUE INDEX IF NOT EXISTS job_time_entries_one_running_per_worker
  ON public.job_time_entries(worker_id)
  WHERE ended_at IS NULL;

ALTER TABLE public.job_time_entries ENABLE ROW LEVEL SECURITY;

-- Crew see and change their own time; office staff see and change everyone's.
DROP POLICY IF EXISTS "job_time_entries_select" ON public.job_time_entries;
CREATE POLICY "job_time_entries_select" ON public.job_time_entries FOR SELECT TO authenticated
  USING (
    worker_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'office_staff')
  );

DROP POLICY IF EXISTS "job_time_entries_insert" ON public.job_time_entries;
CREATE POLICY "job_time_entries_insert" ON public.job_time_entries FOR INSERT TO authenticated
  WITH CHECK (
    worker_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'office_staff')
  );

DROP POLICY IF EXISTS "job_time_entries_update" ON public.job_time_entries;
CREATE POLICY "job_time_entries_update" ON public.job_time_entries FOR UPDATE TO authenticated
  USING (
    worker_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'office_staff')
  )
  WITH CHECK (
    worker_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'office_staff')
  );

DROP POLICY IF EXISTS "job_time_entries_delete" ON public.job_time_entries;
CREATE POLICY "job_time_entries_delete" ON public.job_time_entries FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'office_staff'));

NOTIFY pgrst, 'reload schema';
