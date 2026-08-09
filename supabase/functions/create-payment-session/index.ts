import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import postgres from "https://esm.sh/postgres@3.4.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      throw new Error("Missing SUPABASE_DB_URL environment variable");
    }

    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      throw new Error("Missing STRIPE_SECRET_KEY environment variable");
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // 1. Run migrations automatically to ensure database columns exist
    const sql = postgres(dbUrl);
    try {
      await sql`
        ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS stripe_checkout_url TEXT;
      `;
      await sql`
        ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
      `;
      await sql`
        ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS stripe_session_created_at TIMESTAMP WITH TIME ZONE;
      `;
      await sql`
        ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS duplicate_payment_flagged BOOLEAN DEFAULT FALSE;
      `;
    } catch (migErr) {
      console.error("Migration warning (non-fatal):", migErr);
    }

    // 2. Parse request payload
    const { invoiceId } = await req.json();
    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "Missing invoiceId parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch invoice details from Postgres
    const result = await sql`
      SELECT i.id, i.invoice_number, i.total, i.status, i.stripe_checkout_url, i.stripe_session_created_at, c.email as customer_email
      FROM public.invoices i
      LEFT JOIN public.customers c ON i.customer_id = c.id
      WHERE i.id = ${invoiceId}
    `;

    if (result.length === 0) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const invoice = result[0];

    // Duplicate payment check
    if (invoice.status === "Paid") {
      return new Response(JSON.stringify({ error: "Invoice is already paid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if existing checkout URL is fresh (generated less than 23 hours ago)
    if (invoice.stripe_checkout_url && invoice.stripe_session_created_at) {
      const createdTime = new Date(invoice.stripe_session_created_at).getTime();
      const now = Date.now();
      const ageHours = (now - createdTime) / (1000 * 60 * 60);
      if (ageHours < 23) {
        await sql.end();
        return new Response(JSON.stringify({ checkoutUrl: invoice.stripe_checkout_url }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 4. Create Stripe Checkout Session
    const clientUrl = Deno.env.get("CLIENT_URL") || "http://localhost:5173";
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: {
              name: `Space Insulation Invoice ${invoice.invoice_number}`,
              description: `Space Insulation Services - Invoice ${invoice.invoice_number}`,
            },
            unit_amount: Math.round(Number(invoice.total) * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${clientUrl}/payment-success?invoice_id=${invoice.id}`,
      cancel_url: `${clientUrl}/invoices/${invoice.id}`,
      client_reference_id: invoice.id,
      customer_email: invoice.customer_email || undefined,
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
      },
    });

    // 5. Save the checkout details to database
    await sql`
      UPDATE public.invoices
      SET stripe_checkout_url = ${session.url},
          stripe_session_id = ${session.id},
          stripe_session_created_at = NOW()
      WHERE id = ${invoice.id}
    `;

    await sql.end();

    return new Response(JSON.stringify({ checkoutUrl: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Create payment session error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
