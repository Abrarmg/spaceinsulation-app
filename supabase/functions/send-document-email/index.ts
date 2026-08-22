import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateEstimatePdf(est: any): Promise<{ bytes: Uint8Array; filename: string }> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Header Letterhead
  page.drawText("SPACE INSULATION INC.", { x: margin, y, size: 18, font: fontBold, color: rgb(0.08, 0.1, 0.18) });
  page.drawText("ESTIMATE", { x: pageWidth - margin - 100, y, size: 20, font: fontBold, color: rgb(0.46, 0.77, 0.26) });
  y -= 16;

  page.drawText("Ontario's Trusted Insulation Experts", { x: margin, y, size: 9, font, color: rgb(0.4, 0.45, 0.5) });
  page.drawText(`# ${est.estimate_number || ''}`, { x: pageWidth - margin - 100, y, size: 11, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  y -= 14;

  page.drawText("1070 Major MacKenzie Dr., Richmond Hill, ON L4S 1P3", { x: margin, y, size: 8.5, font, color: rgb(0.4, 0.45, 0.5) });
  y -= 12;
  page.drawText("Phone: (647) 704-9021 | Email: info@spaceinsulation.ca | spaceinsulation.ca", { x: margin, y, size: 8.5, font, color: rgb(0.4, 0.45, 0.5) });
  y -= 16;

  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: rgb(0.85, 0.88, 0.92) });
  y -= 25;

  const boxY = y;
  const col1X = margin;
  const col2X = margin + contentWidth / 2 + 10;

  // Client Info
  page.drawText("PREPARED FOR:", { x: col1X, y, size: 9, font: fontBold, color: rgb(0.4, 0.45, 0.5) });
  y -= 14;
  page.drawText(est.customer_name || "Valued Client", { x: col1X, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  y -= 14;
  if (est.customer_email) {
    page.drawText(String(est.customer_email), { x: col1X, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 12;
  }

  // Proposal Details
  let rightY = boxY;
  page.drawText("PROPOSAL DETAILS:", { x: col2X, y: rightY, size: 9, font: fontBold, color: rgb(0.4, 0.45, 0.5) });
  rightY -= 14;
  const estDateStr = est.created_at ? new Date(est.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  page.drawText(`Date: ${estDateStr}`, { x: col2X, y: rightY, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
  rightY -= 12;

  if (est.valid_until) {
    const validUntilStr = new Date(est.valid_until + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    page.drawText(`Valid Until: ${validUntilStr}`, { x: col2X, y: rightY, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
    rightY -= 12;
  }

  const displayStatus = est.status === 'Approved' ? 'Approved' : 'Sent';
  page.drawText(`Status: ${displayStatus}`, { x: col2X, y: rightY, size: 9, font: fontBold, color: displayStatus === 'Approved' ? rgb(0.13, 0.5, 0.24) : rgb(0.1, 0.4, 0.8) });
  rightY -= 12;

  y = Math.min(y, rightY) - 15;

  // Insulation Expert Details Section
  if (est.expert_name || est.expert_role || est.expert_email || est.expert_phone || est.expert_address) {
    page.drawText("INSULATION EXPERT DETAILS", { x: margin, y, size: 9, font: fontBold, color: rgb(0.4, 0.45, 0.5) });
    y -= 14;
    if (est.expert_name) {
      page.drawText(String(est.expert_name), { x: margin, y, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      y -= 12;
    }
    if (est.expert_role) {
      page.drawText(String(est.expert_role), { x: margin, y, size: 8.5, font, color: rgb(0.4, 0.45, 0.5) });
      y -= 12;
    }
    if (est.expert_email) {
      page.drawText(String(est.expert_email), { x: margin, y, size: 8.5, font, color: rgb(0.3, 0.3, 0.3) });
      y -= 12;
    }
    if (est.expert_phone) {
      page.drawText(String(est.expert_phone), { x: margin, y, size: 8.5, font, color: rgb(0.3, 0.3, 0.3) });
      y -= 12;
    }
    if (est.expert_address) {
      page.drawText(String(est.expert_address).slice(0, 60), { x: margin, y, size: 8.5, font, color: rgb(0.3, 0.3, 0.3) });
      y -= 12;
    }
    y -= 10;
  }

  // Line items
  page.drawRectangle({ x: margin, y: y - 4, width: contentWidth, height: 20, color: rgb(0.95, 0.96, 0.98) });
  page.drawText("DESCRIPTION", { x: margin + 8, y, size: 8.5, font: fontBold, color: rgb(0.4, 0.45, 0.5) });
  page.drawText("QTY", { x: margin + 310, y, size: 8.5, font: fontBold, color: rgb(0.4, 0.45, 0.5) });
  page.drawText("UNIT PRICE", { x: margin + 370, y, size: 8.5, font: fontBold, color: rgb(0.4, 0.45, 0.5) });
  page.drawText("AMOUNT", { x: margin + 450, y, size: 8.5, font: fontBold, color: rgb(0.4, 0.45, 0.5) });
  y -= 22;

  const rawLineItems = Array.isArray(est.line_items) ? est.line_items : [];
  const lineItems = rawLineItems.length > 0 ? rawLineItems : [
    {
      description: `Insulation Services: ${est.insulation_type || 'Attic Insulation'}`,
      quantity: 1,
      unit_price: Number(est.home_size || 0) * Number(est.insulation_rate || 0)
    }
  ];

  for (const item of lineItems) {
    if (y < margin + 120) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin - 20;
    }

    const desc = String(item.description || 'Service Line Item').slice(0, 55);
    const qty = Number(item.quantity || 1);
    const price = Number(item.unit_price || 0);
    const lineTotal = qty * price;

    page.drawText(desc, { x: margin + 8, y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(qty.toString(), { x: margin + 310, y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(`$${price.toFixed(2)}`, { x: margin + 370, y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(`$${lineTotal.toFixed(2)}`, { x: margin + 450, y, size: 9, font: fontBold, color: rgb(0.15, 0.15, 0.15) });

    y -= 18;
    page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: pageWidth - margin, y: y + 4 }, thickness: 0.5, color: rgb(0.9, 0.92, 0.95) });
  }

  y -= 15;
  if (y < margin + 140) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin - 20;
  }

  const totalsX = margin + 330;
  const subtotal = lineItems.reduce((sum: number, item: any) => sum + (Number(item.quantity || 1) * Number(item.unit_price || 0)), 0);
  const tax = Number((subtotal * 0.13).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));

  page.drawText("Subtotal:", { x: totalsX, y, size: 9.5, font, color: rgb(0.4, 0.45, 0.5) });
  page.drawText(`$${subtotal.toFixed(2)}`, { x: margin + 450, y, size: 9.5, font, color: rgb(0.2, 0.2, 0.2) });
  y -= 16;

  page.drawText("HST (13%):", { x: totalsX, y, size: 9.5, font, color: rgb(0.4, 0.45, 0.5) });
  page.drawText(`$${tax.toFixed(2)}`, { x: margin + 450, y, size: 9.5, font, color: rgb(0.2, 0.2, 0.2) });
  y -= 18;

  page.drawText("Estimate Total:", { x: totalsX, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(`$${total.toFixed(2)}`, { x: margin + 450, y, size: 12, font: fontBold, color: rgb(0.46, 0.77, 0.26) });
  y -= 25;

  page.drawText("Thank you for considering Space Insulation Inc.!", { x: margin, y: margin + 10, size: 8.5, font: fontBold, color: rgb(0.4, 0.45, 0.5) });

  const bytes = await pdfDoc.save();
  const sanitizedNum = String(est.estimate_number || 'EST').replace(/[^a-zA-Z0-9_-]/g, '_');
  return { bytes, filename: `Estimate_${sanitizedNum}.pdf` };
}

async function generateInvoicePdf(inv: any, cust: any, checkoutUrl: string | null): Promise<{ bytes: Uint8Array; filename: string }> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Header Letterhead
  page.drawText("SPACE INSULATION INC.", { x: margin, y, size: 18, font: fontBold, color: rgb(0.08, 0.1, 0.18) });
  page.drawText("INVOICE", { x: pageWidth - margin - 90, y, size: 20, font: fontBold, color: rgb(0.46, 0.77, 0.26) });
  y -= 16;

  page.drawText("Ontario's Trusted Insulation Experts", { x: margin, y, size: 9, font, color: rgb(0.4, 0.45, 0.5) });
  page.drawText(`# ${inv.invoice_number || ''}`, { x: pageWidth - margin - 90, y, size: 11, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  y -= 14;

  page.drawText("1070 Major MacKenzie Dr., Richmond Hill, ON L4S 1P3", { x: margin, y, size: 8.5, font, color: rgb(0.4, 0.45, 0.5) });
  y -= 12;
  page.drawText("Phone: (647) 704-9021 | Email: info@spaceinsulation.ca | spaceinsulation.ca", { x: margin, y, size: 8.5, font, color: rgb(0.4, 0.45, 0.5) });
  y -= 16;

  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: rgb(0.85, 0.88, 0.92) });
  y -= 25;

  const boxY = y;
  const col1X = margin;
  const col2X = margin + contentWidth / 2 + 10;

  // Left Col: Client Info
  page.drawText("BILLED TO:", { x: col1X, y, size: 9, font: fontBold, color: rgb(0.4, 0.45, 0.5) });
  y -= 14;
  page.drawText(cust?.full_name || inv.customer_name || "Valued Client", { x: col1X, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  y -= 14;
  if (cust?.service_address) {
    page.drawText(String(cust.service_address).slice(0, 45), { x: col1X, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 12;
  }
  if (cust?.email || inv.customer_email) {
    page.drawText(cust?.email || inv.customer_email || "", { x: col1X, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 12;
  }

  // Right Col: Invoice Info
  let rightY = boxY;
  page.drawText("INVOICE DETAILS:", { x: col2X, y: rightY, size: 9, font: fontBold, color: rgb(0.4, 0.45, 0.5) });
  rightY -= 14;
  const invDateStr = inv.created_at ? new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  const dueDateStr = inv.due_date ? new Date(inv.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

  page.drawText(`Invoice Date: ${invDateStr}`, { x: col2X, y: rightY, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
  rightY -= 12;
  page.drawText(`Due Date: ${dueDateStr}`, { x: col2X, y: rightY, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  rightY -= 12;

  const displayStatus = inv.status === 'Paid' ? 'Paid' : 'Sent';
  page.drawText(`Status: ${displayStatus}`, { x: col2X, y: rightY, size: 9, font: fontBold, color: displayStatus === 'Paid' ? rgb(0.13, 0.5, 0.24) : rgb(0.1, 0.4, 0.8) });

  y = Math.min(y, rightY) - 20;

  // Line items
  page.drawRectangle({ x: margin, y: y - 4, width: contentWidth, height: 20, color: rgb(0.95, 0.96, 0.98) });
  page.drawText("DESCRIPTION", { x: margin + 8, y, size: 8.5, font: fontBold, color: rgb(0.4, 0.45, 0.5) });
  page.drawText("QTY", { x: margin + 310, y, size: 8.5, font: fontBold, color: rgb(0.4, 0.45, 0.5) });
  page.drawText("UNIT PRICE", { x: margin + 370, y, size: 8.5, font: fontBold, color: rgb(0.4, 0.45, 0.5) });
  page.drawText("AMOUNT", { x: margin + 450, y, size: 8.5, font: fontBold, color: rgb(0.4, 0.45, 0.5) });
  y -= 22;

  const rawItems = Array.isArray(inv.line_items) ? inv.line_items : [];
  const items = rawItems.length > 0 ? rawItems : [{ description: 'Insulation Services', quantity: 1, unit_price: Number(inv.subtotal || inv.total || 0) }];

  for (const item of items) {
    if (y < margin + 120) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin - 20;
    }

    const desc = String(item.description || 'Service Line Item').slice(0, 55);
    const qty = Number(item.quantity || 1);
    const price = Number(item.unit_price || 0);
    const lineTotal = qty * price;

    page.drawText(desc, { x: margin + 8, y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(qty.toString(), { x: margin + 310, y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(`$${price.toFixed(2)}`, { x: margin + 370, y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(`$${lineTotal.toFixed(2)}`, { x: margin + 450, y, size: 9, font: fontBold, color: rgb(0.15, 0.15, 0.15) });

    y -= 18;
    page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: pageWidth - margin, y: y + 4 }, thickness: 0.5, color: rgb(0.9, 0.92, 0.95) });
  }

  y -= 15;
  if (y < margin + 140) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin - 20;
  }

  const totalsX = margin + 330;
  const subtotal = Number(inv.subtotal || 0);
  const tax = Number(inv.tax || 0);
  const total = Number(inv.total || 0);

  page.drawText("Subtotal:", { x: totalsX, y, size: 9.5, font, color: rgb(0.4, 0.45, 0.5) });
  page.drawText(`$${subtotal.toFixed(2)}`, { x: margin + 450, y, size: 9.5, font, color: rgb(0.2, 0.2, 0.2) });
  y -= 16;

  page.drawText("HST (13%):", { x: totalsX, y, size: 9.5, font, color: rgb(0.4, 0.45, 0.5) });
  page.drawText(`$${tax.toFixed(2)}`, { x: margin + 450, y, size: 9.5, font, color: rgb(0.2, 0.2, 0.2) });
  y -= 18;

  page.drawText("Invoice Total Due:", { x: totalsX, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(`$${total.toFixed(2)}`, { x: margin + 450, y, size: 12, font: fontBold, color: rgb(0.46, 0.77, 0.26) });
  y -= 25;

  if (checkoutUrl && inv.status !== 'Paid') {
    page.drawText("Payment Link:", { x: margin, y, size: 9, font: fontBold, color: rgb(0.4, 0.45, 0.5) });
    y -= 14;
    page.drawText(checkoutUrl.slice(0, 85), { x: margin, y, size: 8.5, font, color: rgb(0.2, 0.4, 0.8) });
    y -= 20;
  }

  page.drawText("Thank you for choosing Space Insulation Inc.!", { x: margin, y: margin + 10, size: 8.5, font: fontBold, color: rgb(0.4, 0.45, 0.5) });

  const bytes = await pdfDoc.save();
  const sanitizedNum = String(inv.invoice_number || 'INV').replace(/[^a-zA-Z0-9_-]/g, '_');
  return { bytes, filename: `Invoice_${sanitizedNum}.pdf` };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { documentId, documentType, recipientEmail, personalMessage } = await req.json();

    if (!documentId || !documentType || !recipientEmail) {
      return new Response(JSON.stringify({ error: "Missing documentId, documentType, or recipientEmail" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (documentType !== "estimate" && documentType !== "invoice") {
      return new Response(JSON.stringify({ error: "Invalid documentType. Must be 'estimate' or 'invoice'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize Resend API Key
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY environment secret in Supabase");
    }

    // Get Sender Email Configurations
    const senderEmail = Deno.env.get("RESEND_SENDER_EMAIL") || "invoices@app.spaceinsulation.ca";
    const resendFrom = `Space Insulation <${senderEmail}>`;

    const companyPhone = "(647) 704-9021";
    const companyEmail = "info@spaceinsulation.ca";
    const companyWeb = "spaceinsulation.ca";
    const companyAddress = "1070 Major MacKenzie Dr., Richmond Hill, ON L4S 1P3";

    let emailSubject = "";
    let emailHtml = "";
    let pdfResult: { bytes: Uint8Array; filename: string } | null = null;

    if (documentType === "estimate") {
      // 1. Fetch estimate from database
      const { data: est, error: estErr } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", documentId)
        .maybeSingle();

      if (estErr || !est) {
        throw new Error(estErr?.message || "Estimate not found");
      }

      // Build the approval URL
      const approvalToken = est.approval_token || '';
      const appDomain = Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || "https://spaceinsulation-app.vercel.app";
      const approvalUrl = approvalToken ? `${appDomain}/approve-estimate/${approvalToken}` : '';

      // Calculations
      const lineItems = Array.isArray(est.line_items) ? est.line_items : [];
      const finalLineItems = lineItems.length > 0 ? lineItems : [
        {
          description: `Insulation Services: ${est.insulation_type} Insulation (${est.home_size} sq ft at $${Number(est.insulation_rate).toFixed(2)}/sq ft)`,
          quantity: 1,
          unit_price: Number(est.home_size) * Number(est.insulation_rate)
        }
      ];

      const subtotal = finalLineItems.reduce((sum, item) => sum + (Number(item.quantity || 1) * Number(item.unit_price || 0)), 0);
      const tax = Number((subtotal * 0.13).toFixed(2));
      const totalAmount = Number((subtotal + tax).toFixed(2));

      // Generate Estimate PDF
      pdfResult = await generateEstimatePdf(est);

      const formattedValidUntil = est.valid_until ? new Date(est.valid_until + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

      emailSubject = `Space Insulation Estimate Proposal: ${est.estimate_number}`;
      emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Insulation Estimate ${est.estimate_number}</title>
        </head>
        <body style="margin: 0; padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f6f6f6; color: #333333;">
          <div style="max-width: 560px; margin: 30px auto; background-color: #ffffff; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            
            <!-- Header letterhead -->
            <table style="width: 100%; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 24px; border-collapse: collapse;">
              <tr>
                <td style="vertical-align: middle; text-align: left; width: 56px; padding: 0;">
                  <img src="https://hcoxvaqeomtpcsegadip.supabase.co/storage/v1/object/public/job-media/logo.png" alt="Logo" width="48" height="48" style="width: 48px; height: 48px; object-fit: contain; border-radius: 6px; display: block;" />
                </td>
                <td style="vertical-align: middle; text-align: left; padding: 0 0 0 10px;">
                  <h1 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: -0.03em; color: #1a1a1a; line-height: 1.1;">SPACE INSULATION</h1>
                  <span style="font-size: 10px; font-weight: bold; color: #718096; letter-spacing: 0.02em; text-transform: uppercase; display: block; margin-top: 2px;">Ontario's Trusted Insulation Experts</span>
                </td>
              </tr>
            </table>

            <div style="font-size: 14px; line-height: 1.6; color: #2d3748;">
              <p style="margin: 0 0 16px 0;">Hi ${est.customer_name || 'Client'},</p>
              
              <p style="margin: 0 0 16px 0;">Thank you for considering Space Insulation for your project.</p>
              
              <p style="margin: 0 0 16px 0;">Please find <strong>Estimate #${est.estimate_number}</strong> attached to this email as a PDF document.</p>

              ${personalMessage ? `
              <div style="margin: 0 0 20px 0; padding: 14px 16px; border-left: 4px solid #84cc16; font-size: 13px; line-height: 1.5; color: #4a5568; background-color: #f8fafc; border-radius: 0 6px 6px 0;">
                <strong>Note from team:</strong> ${personalMessage}
              </div>
              ` : ""}

              <!-- Summary Card -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
                <div style="font-size: 13px; color: #64748b; margin-bottom: 6px;">
                  <strong>Estimated Total:</strong> <span style="font-size: 16px; font-weight: 800; color: #84cc16; margin-left: 4px;">$${totalAmount.toFixed(2)}</span>
                </div>
                ${formattedValidUntil ? `
                <div style="font-size: 13px; color: #64748b;">
                  <strong>Valid Until:</strong> <span style="color: #334155; font-weight: 600; margin-left: 4px;">${formattedValidUntil}</span>
                </div>
                ` : ""}
              </div>

              ${approvalUrl ? `
              <p style="margin: 0 0 16px 0;">You can review and approve your estimate online using the button below:</p>
              
              <div style="margin: 0 0 24px 0; text-align: center;">
                <a href="${approvalUrl}" style="display: inline-block; padding: 12px 28px; background-color: #84cc16; color: #1a1a1a; text-decoration: none; font-weight: bold; font-size: 13px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">Review & Approve Estimate</a>
              </div>
              ` : ''}

              <p style="margin: 0 0 24px 0;">If you have any questions or would like to discuss the estimate, simply reply to this email.</p>

              <div style="border-top: 1px solid #edf2f7; padding-top: 20px; font-size: 12px; color: #64748b; line-height: 1.6;">
                <strong style="color: #1e293b;">Best regards,</strong><br />
                Space Insulation Inc.<br />
                Phone: ${companyPhone} | Email: ${companyEmail}<br />
                Website: <a href="https://${companyWeb}" style="color: #84cc16; text-decoration: none; font-weight: bold;">${companyWeb}</a>
              </div>
            </div>

          </div>
        </body>
      </html>
      `;

    } else if (documentType === "invoice") {
      // 2. Fetch invoice from database with customer details
      const { data: inv, error: invErr } = await supabase
        .from("invoices")
        .select("*, customers(full_name, email, service_address)")
        .eq("id", documentId)
        .maybeSingle();

      if (invErr || !inv) {
        throw new Error(invErr?.message || "Invoice not found");
      }

      const cust = Array.isArray(inv.customers) ? inv.customers[0] : inv.customers;

      let checkoutUrl = inv.stripe_checkout_url || null;
      if (inv.status !== "Paid") {
        try {
          const createSessionRes = await fetch(`${supabaseUrl}/functions/v1/create-payment-session`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ invoiceId: inv.id }),
          });
          if (createSessionRes.ok) {
            const sessionData = await createSessionRes.json();
            checkoutUrl = sessionData.checkoutUrl;
          } else {
            console.error("Failed to generate payment link:", await createSessionRes.text());
          }
        } catch (sessionErr) {
          console.error("Error creating payment session during email dispatch:", sessionErr);
        }
      }

      // Generate Invoice PDF
      pdfResult = await generateInvoicePdf(inv, cust, checkoutUrl);

      const invDueDateStr = inv.due_date ? new Date(inv.due_date + 'T00:00:00').toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : '';

      emailSubject = `Space Insulation Invoice Statement: ${inv.invoice_number}`;
      emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Invoice Statement ${inv.invoice_number}</title>
        </head>
        <body style="margin: 0; padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f6f6f6; color: #333333;">
          <div style="max-width: 560px; margin: 30px auto; background-color: #ffffff; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            
            <!-- Header letterhead -->
            <table style="width: 100%; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 24px; border-collapse: collapse;">
              <tr>
                <td style="vertical-align: middle; text-align: left; width: 56px; padding: 0;">
                  <img src="https://hcoxvaqeomtpcsegadip.supabase.co/storage/v1/object/public/job-media/logo.png" alt="Logo" width="48" height="48" style="width: 48px; height: 48px; object-fit: contain; border-radius: 6px; display: block;" />
                </td>
                <td style="vertical-align: middle; text-align: left; padding: 0 0 0 10px;">
                  <h1 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: -0.03em; color: #1a1a1a; line-height: 1.1;">SPACE INSULATION</h1>
                  <span style="font-size: 10px; font-weight: bold; color: #718096; letter-spacing: 0.02em; text-transform: uppercase; display: block; margin-top: 2px;">Ontario's Trusted Insulation Experts</span>
                </td>
              </tr>
            </table>

            <div style="font-size: 14px; line-height: 1.6; color: #2d3748;">
              <p style="margin: 0 0 16px 0;">Hi ${cust?.full_name || 'Client'},</p>
              
              <p style="margin: 0 0 16px 0;">Thank you for choosing Space Insulation.</p>
              
              <p style="margin: 0 0 16px 0;">Please find <strong>Invoice #${inv.invoice_number}</strong> attached to this email as a PDF document.</p>

              ${personalMessage ? `
              <div style="margin: 0 0 20px 0; padding: 14px 16px; border-left: 4px solid #84cc16; font-size: 13px; line-height: 1.5; color: #4a5568; background-color: #f8fafc; border-radius: 0 6px 6px 0;">
                <strong>Note from team:</strong> ${personalMessage}
              </div>
              ` : ""}

              <!-- Summary Card -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
                <div style="font-size: 13px; color: #64748b; margin-bottom: 6px;">
                  <strong>Invoice Total:</strong> <span style="font-size: 16px; font-weight: 800; color: #84cc16; margin-left: 4px;">$${Number(inv.total).toFixed(2)}</span>
                </div>
                ${invDueDateStr ? `
                <div style="font-size: 13px; color: #64748b;">
                  <strong>Due Date:</strong> <span style="color: #334155; font-weight: 600; margin-left: 4px;">${invDueDateStr}</span>
                </div>
                ` : ""}
              </div>

              ${(inv.status !== "Paid" && checkoutUrl) ? `
              <p style="margin: 0 0 16px 0;">You can pay your invoice securely using the button below:</p>
              
              <div style="margin: 0 0 24px 0; text-align: center;">
                <a href="${checkoutUrl}" style="display: inline-block; padding: 12px 28px; background-color: #84cc16; color: #1a1a1a; text-decoration: none; font-weight: bold; font-size: 13px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">Pay Invoice</a>
              </div>
              ` : ''}

              ${inv.status === "Paid" ? `
              <div style="margin: 0 0 24px 0; text-align: center;">
                <div style="display: inline-block; padding: 8px 20px; border: 1px solid #bbf7d0; background-color: #f0fdf4; color: #15803d; font-weight: bold; font-size: 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em;">Paid In Full</div>
              </div>
              ` : ''}

              <p style="margin: 0 0 24px 0;">If you have any questions about your invoice, simply reply to this email and our team will be happy to help.</p>

              <div style="border-top: 1px solid #edf2f7; padding-top: 20px; font-size: 12px; color: #64748b; line-height: 1.6;">
                <strong style="color: #1e293b;">Best regards,</strong><br />
                Space Insulation Inc.<br />
                Phone: ${companyPhone} | Email: ${companyEmail}<br />
                Website: <a href="https://${companyWeb}" style="color: #84cc16; text-decoration: none; font-weight: bold;">${companyWeb}</a>
              </div>
            </div>

          </div>
        </body>
      </html>
      `;
    }

    // Validate PDF generation
    if (!pdfResult || !pdfResult.bytes || pdfResult.bytes.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Unable to generate PDF attachment." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate PDF magic bytes (%PDF -> 0x25 0x50 0x44 0x46)
    const b = pdfResult.bytes;
    if (b[0] !== 0x25 || b[1] !== 0x50 || b[2] !== 0x44 || b[3] !== 0x46 || !pdfResult.filename.endsWith(".pdf")) {
      return new Response(JSON.stringify({ success: false, error: "Generated PDF attachment is invalid." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const attachments = [
      {
        filename: pdfResult.filename,
        content: base64Encode(pdfResult.bytes),
      }
    ];

    console.log(`[send-document-email] PDF attachment created. Document: ${documentType}, Filename: ${pdfResult.filename}, Bytes: ${pdfResult.bytes.length}`);

    // Call Resend send API
    const emailPayload = {
      from: resendFrom,
      to: [recipientEmail],
      subject: emailSubject,
      html: emailHtml,
      attachments
    };

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      throw new Error(`Resend dispatch failure (Status ${resendRes.status}): ${errText}`);
    }

    // Update database status and sent_at timestamp ONLY after Resend succeeds with PDF
    const nowStr = new Date().toISOString();
    if (documentType === "estimate") {
      const { error: updErr } = await supabase
        .from("estimates")
        .update({ status: "Sent", sent_at: nowStr })
        .eq("id", documentId);
      if (updErr) throw updErr;
    } else if (documentType === "invoice") {
      const { error: updErr } = await supabase
        .from("invoices")
        .update({ status: "Sent", sent_at: nowStr })
        .eq("id", documentId);
      if (updErr) throw updErr;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("send-document-email edge function failure:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
