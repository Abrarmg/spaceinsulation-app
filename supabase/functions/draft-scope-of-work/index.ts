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

    const { notes } = await req.json();
    if (!notes || !notes.trim()) {
      return new Response(JSON.stringify({ error: "Inspection notes cannot be empty" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call OpenAI Chat Completions API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert technical writer for Space Insulation, a professional attic insulation and ventilation contractor.
Your task is to draft a polished, professional customer-facing scope-of-work paragraph based on raw inspection notes provided by a technician.

Strict guidelines:
1. Write a cohesive, professional paragraph suitable for a customer-facing estimate proposal.
2. Be technical but clear and readable.
3. Do NOT invent or fabricate any details that are not in the raw notes (e.g., do not guess/fabricate square footage, price, exact material specs, or building code references unless explicitly specified in the notes).
4. Do NOT include any pricing, costs, or dollar amounts.
5. If the notes are brief or sparse, keep the draft appropriately concise and general. Do not write a long, elaborate paragraph if there is very little source info.
6. Return ONLY the drafted plain text paragraph. Do not include introductory text (like "Here is the scope:"), conversational remarks, or markdown formatting. Just the paragraph text.`
          },
          {
            role: "user",
            content: `Technician notes: ${notes}`
          }
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API failed (Status ${response.status}): ${errText}`);
    }

    const data = await response.json();
    const draftText = data.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ draft: draftText }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Draft scope-of-work error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
