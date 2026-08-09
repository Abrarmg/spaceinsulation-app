import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import Stripe from "https://esm.sh/stripe@14.15.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { invoiceId } = await req.json();
    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "Missing invoiceId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client using Service Role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch invoice and customer details
    const { data: invoice, error: invoiceErr } = await supabase
      .from("invoices")
      .select("*, customers(full_name, email)")
      .eq("id", invoiceId)
      .maybeSingle();

    if (invoiceErr || !invoice) {
      throw new Error(invoiceErr?.message || "Invoice not found");
    }

    const customer = Array.isArray(invoice.customers) ? invoice.customers[0] : invoice.customers;
    const customerEmail = customer?.email || "";
    const customerName = customer?.full_name || "Client";

    // Initialize Stripe client
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    if (!stripeSecretKey) {
      throw new Error("Missing STRIPE_SECRET_KEY environment variable");
    }
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Determine the origin for redirects
    const origin = req.headers.get("origin") || "http://localhost:5173";

    // Map invoice line items for Stripe line_items structure
    // If line_items array is empty or corrupt, fallback to total amount
    const rawLineItems = Array.isArray(invoice.line_items) ? invoice.line_items : [];
    let stripeLineItems = [];

    if (rawLineItems.length > 0) {
      stripeLineItems = rawLineItems.map((item: any) => {
        const desc = item.description || "Line Item";
        const qty = Number(item.quantity) || 1;
        
        // Stripe expects unit amount in cents. Apply HST (13%) directly to line items or separately?
        // Let's apply 13% tax directly by adding it to each unit amount, or let's create a single line item
        // for subtotal and a separate line item for tax to keep it simple and mathematically clean.
        const unitPriceInCents = Math.round((Number(item.unit_price) || 0) * 100);
        return {
          price_data: {
            currency: "cad",
            product_data: {
              name: desc,
            },
            unit_amount: unitPriceInCents,
          },
          quantity: qty,
        };
      });

      // Add tax as a line item if greater than 0
      const taxInCents = Math.round(Number(invoice.tax) * 100);
      if (taxInCents > 0) {
        stripeLineItems.push({
          price_data: {
            currency: "cad",
            product_data: {
              name: "HST (13% Tax)",
            },
            unit_amount: taxInCents,
          },
          quantity: 1,
        });
      }
    } else {
      // Fallback: single item representing the total invoice amount
      const totalInCents = Math.round(Number(invoice.total) * 100);
      stripeLineItems.push({
        price_data: {
          currency: "cad",
          product_data: {
            name: `Invoice #${invoice.invoice_number} Payment`,
            description: `Total amount due for customer ${customerName}`,
          },
          unit_amount: totalInCents,
        },
        quantity: 1,
      });
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: stripeLineItems,
      mode: "payment",
      customer_email: customerEmail || undefined,
      success_url: `${origin}/invoices/${invoiceId}?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${origin}/invoices/${invoiceId}?success=false`,
      metadata: {
        invoiceId: invoiceId,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
