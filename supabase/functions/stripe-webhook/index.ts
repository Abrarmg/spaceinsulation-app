import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import postgres from "https://esm.sh/postgres@3.4.4";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
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

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      throw new Error("Missing STRIPE_WEBHOOK_SECRET environment variable");
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    // Read the raw request body as text
    const body = await req.text();

    // Verify webhook signature
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err: any) {
      console.error(`Signature verification failed: ${err.message}`);
      return new Response(`Signature verification failed: ${err.message}`, { status: 400 });
    }

    console.log(`Received Stripe event: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoice_id || session.client_reference_id;

      if (!invoiceId) {
        console.error("Missing invoice_id in session metadata/reference");
        return new Response("Missing invoice_id in session", { status: 400 });
      }

      const sql = postgres(dbUrl);

      // Check current invoice status
      const result = await sql`
        SELECT id, status, stripe_payment_id FROM public.invoices WHERE id = ${invoiceId}
      `;

      if (result.length === 0) {
        console.error(`Invoice with ID ${invoiceId} not found in database`);
        await sql.end();
        return new Response("Invoice not found", { status: 404 });
      }

      const invoice = result[0];

      if (invoice.status === "Paid") {
        console.warn(`DUPLICATE_PAYMENT_DETECTED: Invoice ${invoiceId} was already paid. Flagging for review.`);
        await sql`
          UPDATE public.invoices
          SET duplicate_payment_flagged = TRUE,
              stripe_payment_id = COALESCE(stripe_payment_id, ${session.payment_intent || session.id})
          WHERE id = ${invoiceId}
        `;
      } else {
        console.log(`Payment succeeded for Invoice ${invoiceId}. Updating status to Paid.`);
        await sql`
          UPDATE public.invoices
          SET status = 'Paid',
              paid_at = NOW(),
              stripe_payment_id = ${session.payment_intent || session.id}
          WHERE id = ${invoiceId}
        `;
      }

      await sql.end();
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
