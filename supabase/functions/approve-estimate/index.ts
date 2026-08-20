import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── GET: Fetch estimate details by approval_token ───
    if (action === "get") {
      const { data: est, error: estErr } = await supabase
        .from("estimates")
        .select("*, customers(full_name, email, phone, service_address)")
        .eq("approval_token", token)
        .maybeSingle();

      if (estErr || !est) {
        return new Response(JSON.stringify({ error: "This link is no longer valid." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Format line items
      const lineItems = Array.isArray(est.line_items) ? est.line_items : [];
      const subtotal = lineItems.reduce(
        (sum: number, item: any) =>
          sum + Number(item.quantity || 1) * Number(item.unit_price || 0),
        0
      );
      const tax = Number((subtotal * 0.13).toFixed(2));
      const total = Number((subtotal + tax).toFixed(2));

      const customer = Array.isArray(est.customers) ? est.customers[0] : est.customers;

      return new Response(
        JSON.stringify({
          estimate_number: est.estimate_number,
          customer_name: est.customer_name || customer?.full_name || "Customer",
          customer_email: customer?.email || "",
          customer_phone: customer?.phone || "",
          customer_address: customer?.service_address || est.service_location || "",
          home_size: est.home_size,
          insulation_type: est.insulation_type,
          insulation_rate: est.insulation_rate,
          expert_name: est.expert_name,
          expert_role: est.expert_role,
          expert_email: est.expert_email,
          expert_phone: est.expert_phone,
          expert_address: est.expert_address,
          line_items: lineItems,
          subtotal,
          tax,
          total,
          total_amount: est.total_amount,
          status: est.status,
          approved_at: est.approved_at,
          intro_text: est.intro_text,
          scope_of_work: est.scope_of_work,
          created_at: est.created_at,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ─── APPROVE: Approve the estimate and create a job ───
    if (action === "approve") {
      // 1. Fetch the estimate
      const { data: est, error: estErr } = await supabase
        .from("estimates")
        .select("*")
        .eq("approval_token", token)
        .maybeSingle();

      if (estErr || !est) {
        return new Response(JSON.stringify({ error: "This link is no longer valid." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2. Check if already approved
      if (est.status === "Approved" || est.approved_at) {
        return new Response(
          JSON.stringify({
            error: "already_approved",
            message: "This estimate has already been approved.",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // 3. Update estimate status to Approved
      const { error: updateErr } = await supabase
        .from("estimates")
        .update({ status: "Approved", approved_at: new Date().toISOString() })
        .eq("id", est.id);

      if (updateErr) {
        throw new Error("Failed to approve estimate: " + updateErr.message);
      }

      // 4. Create a Job record (same logic as handleConvertToJob in frontend)
      const { data: maxJobData } = await supabase
        .from("jobs")
        .select("job_number")
        .order("job_number", { ascending: false })
        .limit(1);

      const nextJobNum =
        maxJobData && maxJobData.length > 0
          ? Number(maxJobData[0].job_number) + 1
          : 1001;

      const lineItems = Array.isArray(est.line_items) ? est.line_items : [];
      const itemsList = lineItems
        .map(
          (item: any) =>
            `- ${item.description} (Qty: ${item.quantity || 1} × $${Number(
              item.unit_price || 0
            ).toFixed(2)} = $${(
              Number(item.quantity || 1) * Number(item.unit_price || 0)
            ).toFixed(2)})`
        )
        .join("\n");

      const scopeOfWork = [
        `Converted from Estimate ${est.estimate_number}`,
        `Home Size: ${est.home_size} sq ft`,
        `Insulation Type: ${est.insulation_type} (Rate: $${Number(
          est.insulation_rate
        ).toFixed(2)}/sq ft)`,
        itemsList
          ? `\nDetailed Scope Items:\n${itemsList}`
          : est.extra_work_description
          ? `Extra Work: ${est.extra_work_description} ($${Number(
              est.extra_work_amount
            ).toFixed(2)})`
          : null,
      ]
        .filter(Boolean)
        .join("\n");

      const { error: jobErr } = await supabase.from("jobs").insert([
        {
          customer_id: est.customer_id,
          job_number: nextJobNum,
          status: "Scheduled",
          scope_of_work: scopeOfWork,
          quoted_amount: est.total_amount,
        },
      ]);

      if (jobErr) {
        console.error("Job creation error:", jobErr);
        // Don't throw — the estimate is already approved
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Estimate approved successfully. A job has been created.",
          job_number: nextJobNum,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("approve-estimate error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
