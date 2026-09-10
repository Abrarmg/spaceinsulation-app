import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { encode as base64Encode, decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateEstimatePdf(est: any): Promise<{ bytes: Uint8Array; filename: string }> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // US Letter dimensions: 8.5 x 11 inches (612 x 792 points at 72 dpi)
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 36; // 0.5 inch margins
  const contentWidth = pageWidth - margin * 2;

  const brandGreen = rgb(0.463, 0.769, 0.259); // #76C442
  const textDark = rgb(0.082, 0.102, 0.176);   // #151A2D
  const textMuted = rgb(0.392, 0.455, 0.545);  // #64748B
  const borderLight = rgb(0.898, 0.906, 0.922);// #E5E7EB

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // 1. TOP HEADER
  page.drawText("SPACE INSULATION", { x: margin, y: y - 10, size: 20, font: fontBold, color: textDark });
  page.drawText("Ontario's Trusted Insulation Experts", { x: margin, y: y - 24, size: 8.5, font: fontBold, color: textMuted });

  const estNumText = `ESTIMATE #${est.estimate_number || '1001'}`;
  const estNumWidth = fontBold.widthOfTextAtSize(estNumText, 18);
  page.drawText(estNumText, { x: pageWidth - margin - estNumWidth, y: y - 8, size: 18, font: fontBold, color: textDark });

  const sentDateStr = est.sent_at || est.created_at
    ? new Date(est.sent_at || est.created_at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
    : "";
  const sentLabel = "SENT ON";
  const sentLabelWidth = fontBold.widthOfTextAtSize(sentLabel, 8.5);
  page.drawText(sentLabel, { x: pageWidth - margin - sentLabelWidth, y: y - 22, size: 8.5, font: fontBold, color: textMuted });

  const dateWidth = fontBold.widthOfTextAtSize(sentDateStr, 10);
  page.drawText(sentDateStr, { x: pageWidth - margin - dateWidth, y: y - 34, size: 10, font: fontBold, color: textDark });

  y -= 46;

  // Thin Green Divider Line
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 2, color: brandGreen });
  y -= 16;

  // 2. RECIPIENT / SENDER SECTION: Two equal columns with green top borders
  const colWidth = (contentWidth - 24) / 2;
  const col1X = margin;
  const col2X = margin + colWidth + 24;

  page.drawLine({ start: { x: col1X, y }, end: { x: col1X + colWidth, y }, thickness: 2, color: brandGreen });
  page.drawLine({ start: { x: col2X, y }, end: { x: col2X + colWidth, y }, thickness: 2, color: brandGreen });
  y -= 12;

  const colY = y;
  // RECIPIENT
  page.drawText("RECIPIENT", { x: col1X, y, size: 9, font: fontBold, color: textMuted });
  y -= 13;
  const custName = est.customer_name || "Valued Customer";
  page.drawText(custName.slice(0, 40), { x: col1X, y, size: 11, font: fontBold, color: textDark });
  y -= 13;
  const custAddress = est.property_address || est.service_address || "";
  if (custAddress) {
    page.drawText(custAddress.slice(0, 45), { x: col1X, y, size: 9.5, font, color: textDark });
    y -= 12;
  }
  if (est.customer_phone) {
    page.drawText(`Phone: ${est.customer_phone}`, { x: col1X, y, size: 9, font, color: textMuted });
    y -= 11;
  }
  if (est.customer_email) {
    page.drawText(`Email: ${String(est.customer_email).slice(0, 40)}`, { x: col1X, y, size: 9, font, color: textMuted });
    y -= 11;
  }

  // SENDER
  let rY = colY;
  page.drawText("SENDER", { x: col2X, y: rY, size: 9, font: fontBold, color: textMuted });
  rY -= 13;
  page.drawText("Space Insulation Inc.", { x: col2X, y: rY, size: 11, font: fontBold, color: textDark });
  rY -= 13;
  page.drawText("GST/HST: 775225360RT0001", { x: col2X, y: rY, size: 9, font, color: textMuted });
  rY -= 12;
  page.drawText("10660 Yonge Street", { x: col2X, y: rY, size: 9.5, font, color: textDark });
  rY -= 12;
  page.drawText("Richmond Hill, Ontario L4C 3C9", { x: col2X, y: rY, size: 9.5, font, color: textDark });
  rY -= 12;
  page.drawText("Phone: 647-704-9021", { x: col2X, y: rY, size: 9, font, color: textMuted });
  rY -= 11;
  page.drawText("Email: space@spaceinsulations.com", { x: col2X, y: rY, size: 9, font, color: textMuted });
  rY -= 11;
  page.drawText("Website: https://spaceinsulation.ca/", { x: col2X, y: rY, size: 9, font, color: textMuted });
  rY -= 11;

  y = Math.min(y, rY) - 16;

  // 3. PRODUCTS / SERVICES TABLE
  const c1W = Math.round(contentWidth * 0.23);
  const c2W = Math.round(contentWidth * 0.57);
  const c3W = Math.round(contentWidth * 0.07);
  const c4W = contentWidth - c1W - c2W - c3W;

  const colProdX = margin;
  const colDescX = colProdX + c1W;
  const colQtyX = colDescX + c2W;
  const colPriceX = colQtyX + c3W;

  page.drawRectangle({ x: margin, y: y - 6, width: contentWidth, height: 20, color: brandGreen });
  page.drawText("PRODUCT SERVICE", { x: colProdX + 6, y: y, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("DESCRIPTION", { x: colDescX + 6, y: y, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("QTY.", { x: colQtyX + 6, y: y, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
  const upHeader = "UNIT PRICE";
  const upHeaderW = fontBold.widthOfTextAtSize(upHeader, 8.5);
  page.drawText(upHeader, { x: colPriceX + c4W - upHeaderW - 6, y: y, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });

  y -= 22;

  const rawLineItems = Array.isArray(est.line_items) ? est.line_items : [];
  const lineItems = rawLineItems.length > 0 ? rawLineItems : [
    {
      type: "item",
      name: "Attic Insulation",
      description: est.insulation_type
        ? `Supply and install blown ${String(est.insulation_type).toLowerCase()} insulation to achieve code thermal resistance.`
        : "Supply and install blown attic insulation to achieve code thermal resistance.",
      quantity: Number(est.home_size || 1),
      unit_price: Number(est.insulation_rate || est.total_amount || 0),
    }
  ];

  for (const item of lineItems) {
    if (y < margin + 120) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin - 20;
    }

    const isSection = item.type === "section";
    if (isSection) {
      const sTitle = String(item.name || item.description || "Section").slice(0, 50);
      page.drawText(sTitle, { x: margin + 6, y, size: 9.5, font: fontBold, color: textDark });
      y -= 14;
      if (item.description && item.description !== item.name) {
        page.drawText(String(item.description).slice(0, 90), { x: margin + 6, y, size: 8.5, font, color: textMuted });
        y -= 12;
      }
      page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: pageWidth - margin, y: y + 4 }, thickness: 0.5, color: borderLight });
      y -= 8;
      continue;
    }

    const prodName = String(item.name || item.service || (item.description ? item.description.split(":")[0] : "Service")).slice(0, 22);
    const desc = String(item.description || "").slice(0, 65);
    const qty = String(item.quantity != null ? item.quantity : 1);
    const unitPrice = Number(item.unit_price || 0);

    page.drawText(prodName, { x: colProdX + 6, y, size: 9, font: fontBold, color: textDark });
    page.drawText(desc, { x: colDescX + 6, y, size: 8.5, font, color: textMuted });
    page.drawText(qty, { x: colQtyX + 10, y, size: 8.5, font, color: textDark });

    const pText = `$${unitPrice.toFixed(2)}`;
    const pWidth = font.widthOfTextAtSize(pText, 8.5);
    page.drawText(pText, { x: colPriceX + c4W - pWidth - 6, y, size: 8.5, font, color: textDark });

    y -= 16;
    page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: pageWidth - margin, y: y + 4 }, thickness: 0.5, color: borderLight });
  }

  y -= 16;
  if (y < margin + 140) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin - 20;
  }

  // 4. TOTALS (Bottom-Right)
  const totalsW = 200;
  const totalsX = pageWidth - margin - totalsW;
  const subtotal = lineItems.reduce((sum: number, item: any) => {
    if (item.type === "section" || item.is_optional) return sum;
    return sum + (Number(item.quantity || 1) * Number(item.unit_price || 0));
  }, 0);

  let discountAmount = 0;
  if (est.discount_type === "percentage") {
    discountAmount = (subtotal * (Number(est.discount_value) || 0)) / 100;
  } else if (Number(est.discount_value) > 0) {
    discountAmount = Number(est.discount_value);
  }
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const taxRate = typeof est.tax_rate === "number" ? est.tax_rate : 0.13;
  const tax = Number((discountedSubtotal * taxRate).toFixed(2));
  const total = Number((discountedSubtotal + tax).toFixed(2));

  page.drawText("Subtotal", { x: totalsX, y, size: 9, font: fontBold, color: textMuted });
  const subText = `$${subtotal.toFixed(2)}`;
  const subW = font.widthOfTextAtSize(subText, 9);
  page.drawText(subText, { x: pageWidth - margin - subW, y, size: 9, font, color: textDark });
  y -= 14;

  if (discountAmount > 0) {
    page.drawText("Discount", { x: totalsX, y, size: 9, font: fontBold, color: rgb(0.086, 0.639, 0.29) });
    const discText = `-$${discountAmount.toFixed(2)}`;
    const discW = font.widthOfTextAtSize(discText, 9);
    page.drawText(discText, { x: pageWidth - margin - discW, y, size: 9, font, color: rgb(0.086, 0.639, 0.29) });
    y -= 14;
  }

  page.drawText(`HST (${(taxRate * 100).toFixed(0)}%)`, { x: totalsX, y, size: 9, font: fontBold, color: textMuted });
  const taxText = `$${tax.toFixed(2)}`;
  const taxW = font.widthOfTextAtSize(taxText, 9);
  page.drawText(taxText, { x: pageWidth - margin - taxW, y, size: 9, font, color: textDark });
  y -= 16;

  page.drawLine({ start: { x: totalsX, y: y + 6 }, end: { x: pageWidth - margin, y: y + 6 }, thickness: 1.5, color: textDark });

  page.drawText("TOTAL", { x: totalsX, y, size: 12, font: fontBold, color: textDark });
  const totText = `$${total.toFixed(2)}`;
  const totW = fontBold.widthOfTextAtSize(totText, 13);
  page.drawText(totText, { x: pageWidth - margin - totW, y, size: 13, font: fontBold, color: textDark });
  y -= 22;

  // 5. Terms / Notes
  const clientNotes = (est.client_message || est.intro_text || "").trim();
  const termsText = (est.terms || "").trim();
  if (clientNotes || termsText) {
    if (y < margin + 60) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin - 20;
    }
    page.drawLine({ start: { x: margin, y: y + 6 }, end: { x: pageWidth - margin, y: y + 6 }, thickness: 1, color: borderLight });
    if (clientNotes) {
      page.drawText("CLIENT MESSAGE", { x: margin, y, size: 8, font: fontBold, color: textMuted });
      y -= 12;
      page.drawText(clientNotes.slice(0, 100), { x: margin, y, size: 8.5, font, color: textDark });
      y -= 14;
    }
    if (termsText) {
      page.drawText("TERMS & CONDITIONS", { x: margin, y, size: 8, font: fontBold, color: textMuted });
      y -= 12;
      page.drawText(termsText.slice(0, 100), { x: margin, y, size: 8.5, font, color: textMuted });
      y -= 14;
    }
  }

  const bytes = await pdfDoc.save();
  const sanitizedNum = String(est.estimate_number || "EST").replace(/[^a-zA-Z0-9_-]/g, "_");
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

  page.drawText("HST:", { x: totalsX, y, size: 9.5, font, color: rgb(0.4, 0.45, 0.5) });
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
    const { documentId, documentType, recipientEmail, personalMessage, pdfBase64, pdfFilename } = await req.json();

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

    const companyPhone = "647-704-9021";
    const companyEmail = "space@spaceinsulations.com";
    const companyWeb = "spaceinsulation.ca";
    const companyAddress = "10660 Yonge Street, Richmond Hill, Ontario L4C 3C9";

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

      // Check if client provided exact shared template PDF
      if (pdfBase64) {
        try {
          const decodedBytes = base64Decode(pdfBase64);
          const sanitizedNum = String(est.estimate_number || 'EST').replace(/[^a-zA-Z0-9_-]/g, '_');
          pdfResult = {
            bytes: decodedBytes,
            filename: pdfFilename || `estimate_${sanitizedNum}.pdf`,
          };
          console.log(`[send-document-email] Used client-provided shared template PDF for Estimate ${est.estimate_number}. Bytes: ${decodedBytes.length}`);
        } catch (decodeErr) {
          console.warn("[send-document-email] Failed to decode client pdfBase64, falling back to server PDF:", decodeErr);
        }
      }

      // Generate Estimate PDF fallback if needed
      if (!pdfResult) {
        pdfResult = await generateEstimatePdf(est);
      }

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

      if (est?.lead_id) {
        await supabase
          .from("leads")
          .update({
            pipeline_stage: "awaiting_response",
            updated_at: nowStr
          })
          .eq("id", est.lead_id);
      }
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
