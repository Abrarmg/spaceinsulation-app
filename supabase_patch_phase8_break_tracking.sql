-- Phase 8 Break Tracking Migrations

-- 1. Add flagged_for_review column to public.time_entries
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS flagged_for_review BOOLEAN DEFAULT false;

-- 2. Create the time_breaks table
CREATE TABLE IF NOT EXISTS public.time_breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    time_entry_id UUID NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
    break_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    break_end TIMESTAMP WITH TIME ZONE,
    auto_closed BOOLEAN DEFAULT false
);

-- 3. Enable Row Level Security (RLS) on time_breaks
ALTER TABLE public.time_breaks ENABLE ROW LEVEL SECURITY;

-- 4. Drop old policies if any to prevent duplicates
DROP POLICY IF EXISTS "Allow office staff to manage breaks" ON public.time_breaks;
DROP POLICY IF EXISTS "Allow workers to view own breaks" ON public.time_breaks;
DROP POLICY IF EXISTS "Allow workers to insert own breaks" ON public.time_breaks;
DROP POLICY IF EXISTS "Allow workers to update own breaks" ON public.time_breaks;

-- A. Office staff: manage all breaks
CREATE POLICY "Allow office staff to manage breaks" ON public.time_breaks
    FOR ALL TO authenticated
    USING (public.is_office_staff(auth.uid()))
    WITH CHECK (public.is_office_staff(auth.uid()));

-- B. Field workers: read own breaks
CREATE POLICY "Allow workers to view own breaks" ON public.time_breaks
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.time_entries WHERE id = time_entry_id AND worker_id = auth.uid()));

-- C. Field workers: insert own breaks
CREATE POLICY "Allow workers to insert own breaks" ON public.time_breaks
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.time_entries WHERE id = time_entry_id AND worker_id = auth.uid()));

-- D. Field workers: update own breaks
CREATE POLICY "Allow workers to update own breaks" ON public.time_breaks
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.time_entries WHERE id = time_entry_id AND worker_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.time_entries WHERE id = time_entry_id AND worker_id = auth.uid()));

-- 5. Reload Postgrest schema cache
NOTIFY pgrst, 'reload schema';
