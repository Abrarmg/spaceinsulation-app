-- SQL Patch: Secure Meta Integrations for Space Insulation App
-- Protects access_token from frontend users and ensures strict server-side access.

-- 1. Create public.meta_integrations table if not exists
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

-- 3. Drop broad legacy policies
DROP POLICY IF EXISTS "Allow office staff and admins to manage meta_integrations" ON public.meta_integrations;
DROP POLICY IF EXISTS "Allow office staff to view meta_integrations metadata" ON public.meta_integrations;

-- 4. Revoke all privileges from anon and public roles
REVOKE ALL ON public.meta_integrations FROM anon, public;
REVOKE ALL ON public.meta_integrations FROM authenticated;

-- 5. Grant SELECT only on non-sensitive columns to authenticated users
GRANT SELECT (id, user_id, facebook_user_id, facebook_user_name, token_expires_at, status, connected_at, updated_at)
ON public.meta_integrations TO authenticated;

-- 6. Explicitly revoke access_token column access
REVOKE SELECT (access_token) ON public.meta_integrations FROM authenticated, anon, public;

-- 7. Grant restricted SELECT-only RLS policy for office staff to view integration metadata
CREATE POLICY "Allow office staff to view meta_integrations metadata" ON public.meta_integrations
    FOR SELECT TO authenticated
    USING (public.is_office_staff(auth.uid()));
