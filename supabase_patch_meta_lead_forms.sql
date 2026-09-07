-- SQL Patch: Meta Lead Forms Table for Space Insulation App
-- Creates meta_lead_forms table to store Facebook Lead Forms.

CREATE TABLE IF NOT EXISTS public.meta_lead_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID REFERENCES public.meta_pages(id) ON DELETE CASCADE,
    facebook_form_id TEXT NOT NULL UNIQUE,
    form_name TEXT NOT NULL,
    form_status TEXT NOT NULL DEFAULT 'ACTIVE',
    is_selected BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.meta_lead_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow office staff to view meta_lead_forms" ON public.meta_lead_forms;

REVOKE ALL ON public.meta_lead_forms FROM anon, public;
REVOKE ALL ON public.meta_lead_forms FROM authenticated;

GRANT SELECT ON public.meta_lead_forms TO authenticated;

CREATE POLICY "Allow office staff to view meta_lead_forms" ON public.meta_lead_forms
    FOR SELECT TO authenticated
    USING (public.is_office_staff(auth.uid()));
