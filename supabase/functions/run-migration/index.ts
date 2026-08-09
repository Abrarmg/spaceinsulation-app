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
