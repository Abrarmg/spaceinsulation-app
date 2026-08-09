import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      throw new Error("Missing OPENAI_API_KEY environment secret in Supabase");
    }

    const { image } = await req.json();
    if (!image) {
      return new Response(JSON.stringify({ error: "Image base64 data is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call OpenAI Chat Completions API with Vision
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert at extracting structured information from business expense receipts.
Your task is to analyze the provided receipt image and extract the following fields:
- vendor_name: The name of the store or vendor.
- amount: The total amount paid (number only, no currency symbol).
- tax_amount: The total tax amount (number only, 0 if none is found).
- category: Pick one of the following exact categories: 'Materials', 'Fuel', 'Meals', 'Tools', 'Vehicle Maintenance', 'Office Supplies', 'Software', 'Other'. Default to 'Other' if unsure.
- expense_date: The date of the transaction in YYYY-MM-DD format.
- invoice_number: The receipt or invoice number, if available.
- description: A brief description of what was purchased (e.g. "Insulation Batts", "Gas for Truck").

You MUST return the output as a strict JSON object containing EXACTLY these keys. Do not include markdown blocks, backticks, or extra text.`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the details from this receipt." },
              { type: "image_url", image_url: { url: image } }
            ]
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API failed (Status ${response.status}): ${errText}`);
    }

    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content?.trim() || "{}";
    let parsedResult = {};
    try {
      parsedResult = JSON.parse(resultText);
    } catch (e) {
      console.error("Failed to parse OpenAI JSON response", resultText);
      throw new Error("Failed to parse AI response into JSON");
    }

    return new Response(JSON.stringify(parsedResult), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Scan receipt error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
