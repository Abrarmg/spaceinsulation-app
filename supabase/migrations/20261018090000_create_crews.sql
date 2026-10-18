-- Crews are named groups of field workers, managed from the Scheduling page.
CREATE TABLE IF NOT EXISTS public.crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crew_members (
  crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (crew_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_crew_members_worker ON public.crew_members(worker_id);

ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can see crews; only office staff can change them.
DROP POLICY IF EXISTS "crews_select" ON public.crews;
CREATE POLICY "crews_select" ON public.crews FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crews_write" ON public.crews;
CREATE POLICY "crews_write" ON public.crews FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'office_staff'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'office_staff'));

DROP POLICY IF EXISTS "crew_members_select" ON public.crew_members;
CREATE POLICY "crew_members_select" ON public.crew_members FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crew_members_write" ON public.crew_members;
CREATE POLICY "crew_members_write" ON public.crew_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'office_staff'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'office_staff'));

-- Seed the four crews that were previously hardcoded, matching workers by name. Runs only once.
DO $$
DECLARE
  seed RECORD;
  new_crew UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.crews) THEN
    RETURN;
  END IF;
  FOR seed IN
    SELECT * FROM (VALUES
      (1, 'Crew A', ARRAY['ali qasim', 'khder']),
      (2, 'Crew B', ARRAY['haval', 'suod']),
      (3, 'Crew C', ARRAY['rayan', 'ali khalaf']),
      (4, 'Crew D', ARRAY['hussein', 'shaker'])
    ) AS t(sort_order, name, matches)
  LOOP
    INSERT INTO public.crews (name, sort_order) VALUES (seed.name, seed.sort_order) RETURNING id INTO new_crew;
    INSERT INTO public.crew_members (crew_id, worker_id)
    SELECT new_crew, p.id
    FROM public.profiles p
    WHERE p.role = 'field_worker'
      AND EXISTS (SELECT 1 FROM unnest(seed.matches) m WHERE lower(p.full_name) LIKE '%' || m || '%')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
