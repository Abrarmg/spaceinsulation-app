import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://esm.sh/postgres@3.4.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_DB_URL env" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sql = postgres(dbUrl);
    
    // Run the migration SQL
    const results = [];
    
    results.push(await sql`
      CREATE TABLE IF NOT EXISTS public.expenses (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          description TEXT NOT NULL,
          category TEXT NOT NULL,
          amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
          expense_date DATE NOT NULL,
          notes TEXT,
          created_by UUID REFERENCES public.profiles(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
      );
    `);

    results.push(await sql`
      ALTER TABLE public.expenses 
        ADD COLUMN IF NOT EXISTS vendor_name TEXT,
        ADD COLUMN IF NOT EXISTS expense_type TEXT,
        ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10, 2) DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CAD',
        ADD COLUMN IF NOT EXISTS payment_method TEXT,
        ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.jobs(id),
        ADD COLUMN IF NOT EXISTS invoice_number TEXT,
        ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS receipt_url TEXT,
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Completed';
    `);

    results.push(await sql`
      ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
    `);

    results.push(await sql`
      DROP POLICY IF EXISTS "Allow office staff to manage expenses" ON public.expenses;
    `);

    results.push(await sql`
      CREATE POLICY "Allow office staff to manage expenses" ON public.expenses
          FOR ALL TO authenticated
          USING (public.is_office_staff(auth.uid()))
          WITH CHECK (public.is_office_staff(auth.uid()));
    `);

    results.push(await sql`
      ALTER TABLE public.jobs
      ADD COLUMN IF NOT EXISTS project_type TEXT,
      ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Normal',
      ADD COLUMN IF NOT EXISTS property_type TEXT,
      ADD COLUMN IF NOT EXISTS access_type TEXT,
      ADD COLUMN IF NOT EXISTS special_instructions TEXT,
      ADD COLUMN IF NOT EXISTS internal_notes TEXT,
      ADD COLUMN IF NOT EXISTS notify_customer BOOLEAN DEFAULT true;
    `);

    results.push(await sql`
      CREATE TABLE IF NOT EXISTS public.staff_certifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          issue_date DATE,
          expiry_date DATE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
      );
    `);

    results.push(await sql`
      ALTER TABLE public.staff_certifications ENABLE ROW LEVEL SECURITY;
    `);

    results.push(await sql`
      DROP POLICY IF EXISTS "Allow office staff to manage certifications" ON public.staff_certifications;
    `);

    results.push(await sql`
      CREATE POLICY "Allow office staff to manage certifications" ON public.staff_certifications
          FOR ALL TO authenticated
          USING (public.is_office_staff(auth.uid()))
          WITH CHECK (public.is_office_staff(auth.uid()));
    `);

    results.push(await sql`
      DROP POLICY IF EXISTS "Allow workers to view their own certifications" ON public.staff_certifications;
    `);

    results.push(await sql`
      CREATE POLICY "Allow workers to view their own certifications" ON public.staff_certifications
          FOR SELECT TO authenticated
          USING (auth.uid() = profile_id);
    `);

    results.push(await sql`
      ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS weekly_availability JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS internal_notes TEXT,
      ADD COLUMN IF NOT EXISTS start_date DATE,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    `);

    results.push(await sql`
      ALTER TABLE public.profile_wages
      ADD COLUMN IF NOT EXISTS payroll_type TEXT DEFAULT 'Hourly';
    `);

    results.push(await sql`
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
    `);

    results.push(await sql`
      ALTER TABLE public.meta_integrations ENABLE ROW LEVEL SECURITY;
    `);

    results.push(await sql`
      DROP POLICY IF EXISTS "Allow office staff and admins to manage meta_integrations" ON public.meta_integrations;
    `);

    results.push(await sql`
      DROP POLICY IF EXISTS "Allow office staff to view meta_integrations metadata" ON public.meta_integrations;
    `);

    results.push(await sql`
      REVOKE ALL ON public.meta_integrations FROM anon, public;
    `);

    results.push(await sql`
      REVOKE ALL ON public.meta_integrations FROM authenticated;
    `);

    results.push(await sql`
      GRANT SELECT (id, user_id, facebook_user_id, facebook_user_name, token_expires_at, status, connected_at, updated_at)
      ON public.meta_integrations TO authenticated;
    `);

    results.push(await sql`
      REVOKE SELECT (access_token) ON public.meta_integrations FROM authenticated, anon, public;
    `);

    results.push(await sql`
      CREATE POLICY "Allow office staff to view meta_integrations metadata" ON public.meta_integrations
          FOR SELECT TO authenticated
          USING (public.is_office_staff(auth.uid()));
    `);

    results.push(await sql`
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
    `);

    results.push(await sql`
      ALTER TABLE public.meta_pages ENABLE ROW LEVEL SECURITY;
    `);

    results.push(await sql`
      DROP POLICY IF EXISTS "Allow office staff to view meta_pages metadata" ON public.meta_pages;
    `);

    results.push(await sql`
      REVOKE ALL ON public.meta_pages FROM anon, public;
    `);

    results.push(await sql`
      REVOKE ALL ON public.meta_pages FROM authenticated;
    `);

    results.push(await sql`
      GRANT SELECT (id, integration_id, facebook_page_id, page_name, is_selected, created_at, updated_at)
      ON public.meta_pages TO authenticated;
    `);

    results.push(await sql`
      REVOKE SELECT (page_access_token) ON public.meta_pages FROM authenticated, anon, public;
    `);

    results.push(await sql`
      CREATE POLICY "Allow office staff to view meta_pages metadata" ON public.meta_pages
          FOR SELECT TO authenticated
          USING (public.is_office_staff(auth.uid()));
    `);

    results.push(await sql`
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
    `);

    results.push(await sql`
      ALTER TABLE public.meta_lead_forms ENABLE ROW LEVEL SECURITY;
    `);

    results.push(await sql`
      DROP POLICY IF EXISTS "Allow office staff to view meta_lead_forms" ON public.meta_lead_forms;
    `);

    results.push(await sql`
      REVOKE ALL ON public.meta_lead_forms FROM anon, public;
    `);

    results.push(await sql`
      REVOKE ALL ON public.meta_lead_forms FROM authenticated;
    `);

    results.push(await sql`
      GRANT SELECT ON public.meta_lead_forms TO authenticated;
    `);

    results.push(await sql`
      CREATE POLICY "Allow office staff to view meta_lead_forms" ON public.meta_lead_forms
          FOR SELECT TO authenticated
          USING (public.is_office_staff(auth.uid()));
    `);

    results.push(await sql`
      CREATE TABLE IF NOT EXISTS public.leads (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          facebook_lead_id TEXT UNIQUE,
          facebook_page_id TEXT,
          facebook_form_id TEXT,
          name TEXT,
          email TEXT,
          phone TEXT,
          source TEXT DEFAULT 'facebook',
          status TEXT DEFAULT 'new',
          received_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
      );
    `);

    results.push(await sql`
      ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
    `);

    results.push(await sql`
      DROP POLICY IF EXISTS "Allow office staff to manage leads" ON public.leads;
    `);

    results.push(await sql`
      REVOKE ALL ON public.leads FROM anon, public;
    `);

    results.push(await sql`
      REVOKE ALL ON public.leads FROM authenticated;
    `);

    results.push(await sql`
      GRANT ALL ON public.leads TO authenticated;
    `);

    results.push(await sql`
      CREATE POLICY "Allow office staff to manage leads" ON public.leads
          FOR ALL TO authenticated
          USING (public.is_office_staff(auth.uid()))
          WITH CHECK (public.is_office_staff(auth.uid()));
    `);

    results.push(await sql`
      CREATE TABLE IF NOT EXISTS public.assessments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
          customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
          assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
          scheduled_date DATE,
          start_time TIME,
          end_time TIME,
          status TEXT NOT NULL DEFAULT 'unscheduled',
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
          CONSTRAINT assessments_status_check CHECK (status IN ('unscheduled', 'scheduled', 'completed', 'cancelled'))
      );
    `);

    results.push(await sql`
      ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
    `);

    results.push(await sql`
      DROP POLICY IF EXISTS "Allow office staff to manage assessments" ON public.assessments;
    `);

    results.push(await sql`
      REVOKE ALL ON public.assessments FROM anon, public;
    `);

    results.push(await sql`
      REVOKE ALL ON public.assessments FROM authenticated;
    `);

    results.push(await sql`
      GRANT ALL ON public.assessments TO authenticated;
    `);

    results.push(await sql`
      CREATE POLICY "Allow office staff to manage assessments" ON public.assessments
          FOR ALL TO authenticated
          USING (public.is_office_staff(auth.uid()))
          WITH CHECK (public.is_office_staff(auth.uid()));
    `);

    results.push(await sql`
      CREATE INDEX IF NOT EXISTS idx_assessments_lead_id ON public.assessments(lead_id);
    `);

    results.push(await sql`
      CREATE INDEX IF NOT EXISTS idx_assessments_assigned_to ON public.assessments(assigned_to);
    `);

    results.push(await sql`
      CREATE INDEX IF NOT EXISTS idx_assessments_scheduled_date ON public.assessments(scheduled_date);
    `);

    results.push(await sql`
      CREATE INDEX IF NOT EXISTS idx_assessments_status ON public.assessments(status);
    `);

    results.push(await sql`
      ALTER TABLE public.leads
      ADD COLUMN IF NOT EXISTS pipeline_stage TEXT NOT NULL DEFAULT 'new_request';
    `);

    results.push(await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'leads_pipeline_stage_check'
        ) THEN
          ALTER TABLE public.leads
          ADD CONSTRAINT leads_pipeline_stage_check
          CHECK (pipeline_stage IN (
            'new_request',
            'assessment_unscheduled',
            'assessment_scheduled',
            'assessment_completed',
            'quote_draft',
            'awaiting_response',
            'changes_requested'
          ));
        END IF;
      END $$;
    `);

    results.push(await sql`
      CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage ON public.leads(pipeline_stage);
    `);

    results.push(await sql`
      UPDATE public.leads
      SET pipeline_stage = 'new_request'
      WHERE pipeline_stage IS NULL;
    `);

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
