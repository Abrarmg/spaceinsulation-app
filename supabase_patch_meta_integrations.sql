-- SQL Patch: Meta Integrations Feature for Space Insulation App
-- Creates public.meta_integrations table and RLS policy for office staff and admins.

-- 1. Create public.meta_integrations table
CREATE TABLE IF NOT EXISTS public.meta_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    facebook_user_id TEXT NOT NULL UNIQUE,
    facebook_user_name TEXT,
    access_token TEXT NOT NULL,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected')),
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.meta_integrations ENABLE ROW LEVEL SECURITY;

-- 3. Drop policy if it already exists
DROP POLICY IF EXISTS "Allow office staff and admins to manage meta_integrations" ON public.meta_integrations;

-- 4. Create RLS policy granting full CRUD access to office_staff and admin roles
CREATE POLICY "Allow office staff and admins to manage meta_integrations" ON public.meta_integrations
    FOR ALL TO authenticated
    USING (public.is_office_staff(auth.uid()))
    WITH CHECK (public.is_office_staff(auth.uid()));
