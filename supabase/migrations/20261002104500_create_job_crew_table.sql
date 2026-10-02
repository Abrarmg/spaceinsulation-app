-- Create job_crew many-to-many join table
CREATE TABLE IF NOT EXISTS public.job_crew (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  CONSTRAINT job_crew_job_worker_unique UNIQUE(job_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_job_crew_job_id ON public.job_crew(job_id);
CREATE INDEX IF NOT EXISTS idx_job_crew_worker_id ON public.job_crew(worker_id);

ALTER TABLE public.job_crew ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'job_crew' AND policyname = 'Allow authenticated read job_crew'
  ) THEN
    CREATE POLICY "Allow authenticated read job_crew" ON public.job_crew FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'job_crew' AND policyname = 'Allow authenticated insert job_crew'
  ) THEN
    CREATE POLICY "Allow authenticated insert job_crew" ON public.job_crew FOR INSERT TO authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'job_crew' AND policyname = 'Allow authenticated update job_crew'
  ) THEN
    CREATE POLICY "Allow authenticated update job_crew" ON public.job_crew FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'job_crew' AND policyname = 'Allow authenticated delete job_crew'
  ) THEN
    CREATE POLICY "Allow authenticated delete job_crew" ON public.job_crew FOR DELETE TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'job_crew' AND policyname = 'Allow anon read job_crew'
  ) THEN
    CREATE POLICY "Allow anon read job_crew" ON public.job_crew FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- Backfill existing jobs with assigned_worker_id into job_crew
INSERT INTO public.job_crew (job_id, worker_id)
SELECT id, assigned_worker_id 
FROM public.jobs
WHERE assigned_worker_id IS NOT NULL
  AND assigned_worker_id IN (SELECT id FROM public.profiles)
ON CONFLICT (job_id, worker_id) DO NOTHING;
