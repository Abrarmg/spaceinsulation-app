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
          item.type === "section" || item.is_optional
            ? sum
            : sum + Number(item.quantity || 1) * Number(item.unit_price || 0),
        0
      );

      const taxRate = Number(est.tax_rate ?? 0.13);
      let discountAmount = 0;
      if (est.discount_type === "percentage") {
        discountAmount = Number(((subtotal * (Number(est.discount_value) || 0)) / 100).toFixed(2));
      } else if (est.discount_type === "fixed") {
        discountAmount = Math.max(0, Number(est.discount_value) || 0);
      }
      discountAmount = Math.min(discountAmount, subtotal);
      const discountedSubtotal = Math.max(0, Number((subtotal - discountAmount).toFixed(2)));
      const tax = Number((discountedSubtotal * taxRate).toFixed(2));
      const calculatedTotal = Number((discountedSubtotal + tax).toFixed(2));
      const total = est.total_amount ? Number(est.total_amount) : calculatedTotal;

      const customer = Array.isArray(est.customers) ? est.customers[0] : est.customers;

      return new Response(
        JSON.stringify({
          id: est.id,
          estimate_number: est.estimate_number,
          title: est.title,
          customer_name: est.customer_name || customer?.full_name || "Customer",
          customer_email: est.customer_email || customer?.email || "",
          customer_phone: est.customer_phone || customer?.phone || "",
          customer_address: est.property_address || customer?.service_address || est.service_location || "",
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
          discount_type: est.discount_type || "none",
          discount_value: Number(est.discount_value) || 0,
          discount_amount: discountAmount,
          discounted_subtotal: discountedSubtotal,
          tax_rate: taxRate,
          tax,
          total,
          total_amount: total,
          deposit_type: est.deposit_type || "none",
          deposit_value: Number(est.deposit_value) || 0,
          client_view_settings: est.client_view_settings || {
            show_quantity: true,
            show_unit_price: true,
            show_line_item_totals: true,
            show_total: true,
          },
          client_message: est.client_message,
          contract_disclaimer: est.contract_disclaimer,
          terms: est.terms,
          intro_title: est.intro_title || "Estimate / Scope of Work",
          intro_text: est.intro_text,
          header_image_url: est.header_image_url,
          status: est.status,
          approved_at: est.approved_at,
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

      // 4. If this quote is linked to a lead, update opportunity status to approved
      if (est.lead_id) {
        const { error: leadErr } = await supabase
          .from("leads")
          .update({
            status: "approved",
            updated_at: new Date().toISOString()
          })
          .eq("id", est.lead_id);

        if (leadErr) {
          console.error("Failed to update linked lead status:", leadErr);
        }
      }

      // NOTE FOR FUTURE "CONVERT TO JOB" FEATURE:
      // Automatic job creation has been removed per Jobber workflow.
      // Jobs will only be created when office staff explicitly clicks "Convert to Job".
      // Reusable job conversion logic:
      // const generateJobPayload = (estimate: any, nextJobNumber: number) => ({
      //   customer_id: estimate.customer_id,
      //   job_number: nextJobNumber,
      //   status: "Scheduled",
      //   quoted_amount: estimate.total_amount,
      // });

      return new Response(
        JSON.stringify({
          success: true,
          message: "Quote approved successfully.",
          estimate_number: est.estimate_number,
          status: "Approved",
          approved_at: new Date().toISOString(),
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
