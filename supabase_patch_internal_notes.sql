-- SQL Patch: Internal Notes Feature for Space Insulation App
-- Creates public.notes table and RLS policy for office staff only.
-- DO NOT EXECUTE AUTOMATICALLY. Manual review required.

-- 1. Create public.notes table
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    content TEXT NOT NULL CHECK (length(trim(content)) > 0),
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- 3. Drop policy if it already exists
DROP POLICY IF EXISTS "Allow office staff to manage notes" ON public.notes;

-- 4. Create RLS policy granting full CRUD access to office_staff exclusively
-- Field workers have no policies defined, resulting in default DENY (zero access)
CREATE POLICY "Allow office staff to manage notes" ON public.notes
    FOR ALL TO authenticated
    USING (public.is_office_staff(auth.uid()))
    WITH CHECK (public.is_office_staff(auth.uid()));
