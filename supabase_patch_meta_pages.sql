-- SQL Patch: Meta Pages Table for Space Insulation App
-- Creates meta_pages and protects page_access_token from frontend exposure.

CREATE TABLE IF NOT EXISTS public.meta_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID REFERENCES public.meta_integrations(id) ON DELETE CASCADE,
    facebook_page_id TEXT NOT NULL UNIQUE,
    page_name TEXT NOT NULL,
    page_access_token TEXT NOT NULL,
    is_selected BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.meta_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow office staff to view meta_pages metadata" ON public.meta_pages;

REVOKE ALL ON public.meta_pages FROM anon, public;
REVOKE ALL ON public.meta_pages FROM authenticated;

GRANT SELECT (id, integration_id, facebook_page_id, page_name, is_selected, created_at, updated_at)
ON public.meta_pages TO authenticated;

REVOKE SELECT (page_access_token) ON public.meta_pages FROM authenticated, anon, public;

CREATE POLICY "Allow office staff to view meta_pages metadata" ON public.meta_pages
    FOR SELECT TO authenticated
    USING (public.is_office_staff(auth.uid()));
