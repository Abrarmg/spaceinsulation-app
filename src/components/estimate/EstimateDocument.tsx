import React from "react";
import { COMPANY_DETAILS } from "../../config/constants";
import { ESTIMATE_VALID_DAYS } from "../../utils/estimates";
import { findServiceDescription } from "../../config/serviceDescriptions";
import { DocumentWatermark } from "../documents/DocumentWatermark";

export interface EstimateLineItem {
  type?: "item" | "section";
  name?: string;
  service?: string;
  description?: string;
  quantity?: number | string;
  unit_price?: number;
  is_optional?: boolean;
  is_recommended?: boolean;
  image_url?: string | null;
}

export interface EstimateDocumentData {
  id?: string;
  estimate_number: string;
  created_at?: string;
  sent_at?: string | null;
  customer_name?: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  property_address?: string | null;
  home_size?: number;
  insulation_type?: string;
  insulation_rate?: number;
  extra_work_description?: string | null;
  extra_work_amount?: number;
  line_items?: EstimateLineItem[] | null;
  discount_type?: string;
  discount_value?: number;
  tax_rate?: number;
  deposit_type?: string;
  deposit_value?: number;
  client_message?: string | null;
  intro_text?: string | null;
  terms?: string | null;
  contract_disclaimer?: string | null;
  total_amount?: number;
  customers?: {
    full_name?: string;
    email?: string;
    service_address?: string;
    phone?: string | null;
  } | null;
}

interface EstimateDocumentProps {
  estimate: EstimateDocumentData;
  containerId?: string;
  className?: string;
  /** Public approve-estimate link; shown so the customer can accept online. */
  approvalUrl?: string | null;
}

const formatCAD = (val: number): string => {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

export const formatEstimateDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      timeZone: "America/Toronto",
    }).format(date);
  } catch {
    return "";
  }
};

const capitalize = (text: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

const MONO = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
const GREEN = "#76C442";
const INK = "#151A2D";
const MUTED = "#64748B";

const labelStyle: React.CSSProperties = {
  fontSize: "8.5px",
  fontWeight: 800,
  letterSpacing: "0.08em",
  color: MUTED,
  textTransform: "uppercase",
  marginBottom: "3px",
};

export const EstimateDocument: React.FC<EstimateDocumentProps> = ({
  estimate,
  containerId = "estimate-document",
  className = "",
  approvalUrl,
}) => {
  const cust = estimate.customers;
  const customerName = estimate.customer_name || cust?.full_name || "Valued Customer";
  const customerAddress = estimate.property_address || cust?.service_address || "";
  const customerPhone = estimate.customer_phone || cust?.phone || "";
  const customerEmail = estimate.customer_email || cust?.email || "";

  // Format dynamic estimate date: sent date or created date (consistently in America/Toronto)
  const rawDate = estimate.sent_at || estimate.created_at || new Date().toISOString();
  const formattedDate = formatEstimateDate(rawDate);

  // Normalize line items supporting historical records
  const rawItems: EstimateLineItem[] = Array.isArray(estimate.line_items) && estimate.line_items.length > 0
    ? estimate.line_items
    : [
        {
          type: "item",
          name: "Attic Insulation",
          description: estimate.insulation_type
            ? `Supply and install blown ${estimate.insulation_type.toLowerCase()} insulation to achieve optimal thermal coverage.`
            : "Supply and install blown attic insulation to achieve code thermal resistance.",
          quantity: estimate.home_size && estimate.home_size > 0 ? estimate.home_size : 1,
          unit_price: estimate.insulation_rate && estimate.insulation_rate > 0
            ? Number(estimate.insulation_rate)
            : Number(estimate.total_amount || 0),
        },
        ...(Number(estimate.extra_work_amount || 0) > 0
          ? [
              {
                type: "item" as const,
                name: "Attic Air Sealing",
                description: estimate.extra_work_description || "Comprehensive attic bypass air sealing and preparation.",
                quantity: 1,
                unit_price: Number(estimate.extra_work_amount),
              },
            ]
          : []),
      ];

  const processedItems = rawItems.map((item) => {
    const isSection = item.type === "section";
    if (isSection) {
      return {
        isSection: true,
        title: item.name || item.description || "Section",
        description: item.description && item.description !== item.name ? item.description : "",
        quantity: "",
        unitPrice: 0,
        isOptional: false,
        isRecommended: false,
      };
    }

    const rawService = (item.service || "").trim();
    const rawName = (item.name || "").trim();
    let rawDesc = (item.description || "").trim();

    // Priority 1 & 2: Explicit service or name provided
    let title = "";
    if (rawService && rawName) {
      if (rawService.length + 4 <= rawName.length || rawName.length > 35) {
        title = rawService;
      } else {
        title = rawName;
      }
    } else if (rawService) {
      title = rawService;
    } else if (rawName) {
      title = rawName;
    }

    let displayDesc = rawDesc;

    // Priority 3: Fallback if neither service nor name exists
    if (!title && rawDesc) {
      if (rawDesc.includes("\n")) {
        const parts = rawDesc.split("\n");
        const firstLine = parts[0].trim();
        const rest = parts.slice(1).join("\n").trim();
        if (firstLine.length > 0 && firstLine.length <= 60 && rest.length > 0) {
          title = firstLine;
          displayDesc = rest;
        } else {
          title = rawDesc;
          displayDesc = rawDesc;
        }
      } else if (rawDesc.includes(":") && rawDesc.indexOf(":") <= 40) {
        const colonIdx = rawDesc.indexOf(":");
        const head = rawDesc.slice(0, colonIdx).trim();
        const tail = rawDesc.slice(colonIdx + 1).trim();
        if (head.length > 2 && head.length <= 40 && tail.length > 0) {
          title = head;
          displayDesc = tail;
        } else {
          title = rawDesc;
          displayDesc = rawDesc;
        }
      } else {
        // Historical single-line description: render in BOTH Product Service and Description
        title = rawDesc;
        displayDesc = rawDesc;
      }
    } else if (title && displayDesc) {
      // Both explicit title (from service/name) and description exist:
      if (displayDesc.startsWith(title + "\n")) {
        displayDesc = displayDesc.slice(title.length + 1).trim();
      } else if (displayDesc.startsWith(title + ":")) {
        displayDesc = displayDesc.slice(title.length + 1).trim();
      } else if (displayDesc.toLowerCase() === title.toLowerCase()) {
        // ONLY omit when explicit service/name was provided AND description is literally identical
        displayDesc = "";
      }
    }

    const quantity = item.quantity != null ? item.quantity : 1;
    const unitPrice = Number(item.unit_price) || 0;

    return {
      isSection: false,
      title: capitalize(title || "Service"),
      description: displayDesc || findServiceDescription(title) || "",
      quantity,
      unitPrice,
      isOptional: Boolean(item.is_optional),
      isRecommended: Boolean(item.is_recommended),
    };
  });

  // Calculate Subtotal (excluding sections and optional items)
  const billableItems = processedItems.filter((i) => !i.isSection && !i.isOptional);
  const calculatedSubtotal = billableItems.reduce((sum, item) => {
    const qty = typeof item.quantity === "number" ? item.quantity : parseFloat(String(item.quantity)) || 1;
    return sum + qty * item.unitPrice;
  }, 0);

  // Discount
  let discountAmount = 0;
  if (estimate.discount_type === "percentage") {
    discountAmount = (calculatedSubtotal * (Number(estimate.discount_value) || 0)) / 100;
  } else if (estimate.discount_type === "fixed" || estimate.discount_type === "$") {
    discountAmount = Number(estimate.discount_value) || 0;
  } else if (Number(estimate.discount_value) > 0) {
    discountAmount = Number(estimate.discount_value);
  }
  const discountedSubtotal = Math.max(0, calculatedSubtotal - discountAmount);

  // Tax
  const taxRate = typeof estimate.tax_rate === "number" && estimate.tax_rate >= 0 ? estimate.tax_rate : 0.13;
  const taxAmount = Number((discountedSubtotal * taxRate).toFixed(2));

  // Total
  const calculatedTotal = Number((discountedSubtotal + taxAmount).toFixed(2));
  const finalTotal = estimate.total_amount && estimate.total_amount > 0 ? Number(estimate.total_amount) : calculatedTotal;

  // Deposit
  let depositAmount = 0;
  if (estimate.deposit_type === "percentage") {
    depositAmount = (finalTotal * (Number(estimate.deposit_value) || 0)) / 100;
  } else if (estimate.deposit_type === "fixed" || estimate.deposit_type === "$") {
    depositAmount = Number(estimate.deposit_value) || 0;
  } else if (estimate.deposit_type !== "none" && Number(estimate.deposit_value) > 0) {
    // Legacy rows without a deposit_type store a fixed amount.
    depositAmount = Number(estimate.deposit_value);
  }

  const clientNotes = (estimate.client_message || estimate.intro_text || "").trim();
  const termsText = (estimate.terms || "").trim();
  const disclaimerText = (estimate.contract_disclaimer || "").trim();

  // Normalize estimate number: "EST-1045" -> "1045", "1045" -> "1045"
  const rawNum = String(estimate.estimate_number || "1001").trim();
  const normalizedNum = rawNum.replace(/^EST[-_\s]*/i, "").replace(/^#/, "");
  const displayEstimateNumber = normalizedNum || rawNum;

  const qtyNum = (q: number | string) => (typeof q === "number" ? q : parseFloat(String(q)) || 1);
  const billable = processedItems.filter(i => !i.isSection);
  // When every line is flagged "recommended" the tag carries no information, so hide it.
  const showRecommended = billable.some(i => i.isRecommended) && !billable.every(i => i.isRecommended);
  const issueDate = estimate.sent_at || estimate.created_at || new Date().toISOString();
  const validUntil = formatEstimateDate(
    new Date(new Date(issueDate).getTime() + ESTIMATE_VALID_DAYS * 24 * 60 * 60 * 1000).toISOString()
  );
  const websiteLabel = COMPANY_DETAILS.website.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <div
      id={containerId}
      className={`bg-white mx-auto print:shadow-none print:m-0 ${className}`}
      style={{
        width: "100%",
        maxWidth: "816px",
        boxSizing: "border-box",
        padding: "40px 44px 32px",
        backgroundColor: "#FFFFFF",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        lineHeight: 1.35,
        color: INK,
        position: "relative",
        isolation: "isolate",
      }}
    >
      <DocumentWatermark />
      {/* Header: logo lockup + estimate meta */}
      <div data-pdf-block style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "24px", paddingBottom: "14px", borderBottom: `3px solid ${GREEN}` }}>
        <img src="/logo-full.png" alt="Space Insulation" style={{ height: "64px", width: "auto", display: "block" }} />
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "24px", fontWeight: 900, letterSpacing: "-0.01em", lineHeight: 1.1 }}>ESTIMATE</div>
          <div style={{ fontSize: "12px", fontWeight: 700, color: MUTED, marginTop: "2px" }}>#{displayEstimateNumber}</div>
        </div>
      </div>

      {/* Meta strip */}
      <div data-pdf-block style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "16px", padding: "10px 0", borderBottom: "1px solid #E5E7EB", marginBottom: "16px" }}>
        <div>
          <div style={labelStyle}>{estimate.sent_at ? "Date issued" : "Date"}</div>
          <div style={{ fontSize: "11px", fontWeight: 700 }}>{formattedDate}</div>
        </div>
        <div>
          <div style={labelStyle}>Valid until</div>
          <div style={{ fontSize: "11px", fontWeight: 700 }}>{validUntil}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={labelStyle}>Estimate total</div>
          <div style={{ fontSize: "13px", fontWeight: 900, fontFamily: MONO }}>{formatCAD(finalTotal)}</div>
        </div>
      </div>

      {/* Parties */}
      <div data-pdf-block style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "28px", marginBottom: "18px" }}>
        <div>
          <div style={labelStyle}>Prepared for</div>
          <div style={{ fontSize: "13px", fontWeight: 800, marginBottom: "3px" }}>{customerName}</div>
          {customerAddress && (
            <div style={{ fontSize: "10.5px", color: "#334155", marginBottom: "3px" }}>
              <span style={{ color: MUTED, fontWeight: 600 }}>Service address: </span>
              {customerAddress}
            </div>
          )}
          {customerPhone && <div style={{ fontSize: "10px", color: "#475569" }}>{customerPhone}</div>}
          {customerEmail && <div style={{ fontSize: "10px", color: "#475569" }}>{customerEmail}</div>}
        </div>
        <div>
          <div style={labelStyle}>From</div>
          <div style={{ fontSize: "13px", fontWeight: 800, marginBottom: "3px" }}>{COMPANY_DETAILS.name}</div>
          <div style={{ fontSize: "10.5px", color: "#334155" }}>{COMPANY_DETAILS.addressLine1}</div>
          <div style={{ fontSize: "10.5px", color: "#334155", marginBottom: "3px" }}>{COMPANY_DETAILS.addressLine2}</div>
          <div style={{ fontSize: "10px", color: "#475569" }}>{COMPANY_DETAILS.phone} · {COMPANY_DETAILS.email}</div>
          <div style={{ fontSize: "9px", color: MUTED, marginTop: "2px" }}>{COMPANY_DETAILS.taxNumber}</div>
        </div>
      </div>

      {/* Line items */}
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: "10px", marginBottom: "12px" }}>
        <thead>
          <tr data-pdf-block style={{ backgroundColor: INK, color: "#FFFFFF", fontSize: "8.5px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            <th style={{ border: "none", width: "58%", padding: "7px 10px", textAlign: "left" }}>Service</th>
            <th style={{ border: "none", width: "8%", padding: "7px 4px", textAlign: "center" }}>Qty</th>
            <th style={{ border: "none", width: "16%", padding: "7px 8px", textAlign: "right" }}>Unit price</th>
            <th style={{ border: "none", width: "18%", padding: "7px 10px", textAlign: "right" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {processedItems.map((item, idx) => {
            if (item.isSection) {
              return (
                <tr key={idx} data-pdf-block style={{ backgroundColor: "#F1F5F9" }}>
                  <td colSpan={4} style={{ padding: "7px 10px" }}>
                    <div style={{ fontSize: "10.5px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>{item.title}</div>
                    {item.description && <div style={{ fontSize: "9.5px", color: MUTED, marginTop: "1px" }}>{item.description}</div>}
                  </td>
                </tr>
              );
            }
            const lineTotal = qtyNum(item.quantity) * item.unitPrice;
            const included = item.unitPrice === 0;
            return (
              <tr key={idx} data-pdf-block style={{ borderBottom: "1px solid #E5E7EB", verticalAlign: "top" }}>
                <td style={{ padding: "8px 10px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, lineHeight: 1.3 }}>
                    {item.title}
                    {item.isOptional && (
                      <span style={{ marginLeft: "6px", fontSize: "8px", fontWeight: 700, color: MUTED, border: "1px solid #CBD5E1", borderRadius: "999px", padding: "0 6px", verticalAlign: "1px" }}>
                        OPTIONAL
                      </span>
                    )}
                    {showRecommended && item.isRecommended && (
                      <span style={{ marginLeft: "6px", fontSize: "8px", fontWeight: 700, color: "#3F7D1C", backgroundColor: "#EEF8E6", borderRadius: "999px", padding: "0 6px", verticalAlign: "1px" }}>
                        RECOMMENDED
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <div style={{ fontSize: "9.5px", color: "#475569", lineHeight: 1.35, marginTop: "2px", whiteSpace: "pre-line" }}>{item.description}</div>
                  )}
                </td>
                <td style={{ padding: "8px 4px", textAlign: "center", fontWeight: 600 }}>{item.quantity}</td>
                <td style={{ padding: "8px 8px", textAlign: "right", fontFamily: MONO, color: "#475569", whiteSpace: "nowrap" }}>
                  {included ? "—" : formatCAD(item.unitPrice)}
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: MONO, fontWeight: 700, whiteSpace: "nowrap", color: included ? "#3F7D1C" : INK }}>
                  {included ? "Included" : item.isOptional ? <span style={{ color: MUTED }}>{formatCAD(lineTotal)}</span> : formatCAD(lineTotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div data-pdf-block style={{ display: "flex", justifyContent: "flex-end", marginBottom: "18px" }}>
        <table style={{ width: "280px", borderCollapse: "collapse", fontSize: "10.5px" }}>
          <tbody>
            <tr>
              <td style={{ color: MUTED, fontWeight: 600, padding: "3px 0" }}>Subtotal</td>
              <td style={{ textAlign: "right", fontWeight: 700, fontFamily: MONO, padding: "3px 0" }}>{formatCAD(calculatedSubtotal)}</td>
            </tr>
            {discountAmount > 0 && (
              <tr>
                <td style={{ color: "#16A34A", fontWeight: 600, padding: "3px 0" }}>
                  Discount{estimate.discount_type === "percentage" ? ` (${estimate.discount_value}%)` : ""}
                </td>
                <td style={{ textAlign: "right", fontWeight: 700, fontFamily: MONO, color: "#16A34A", padding: "3px 0" }}>-{formatCAD(discountAmount)}</td>
              </tr>
            )}
            <tr>
              <td style={{ color: MUTED, fontWeight: 600, padding: "3px 0" }}>HST ({(taxRate * 100).toFixed(0)}%)</td>
              <td style={{ textAlign: "right", fontWeight: 700, fontFamily: MONO, padding: "3px 0" }}>{formatCAD(taxAmount)}</td>
            </tr>
            <tr>
              <td colSpan={2} style={{ padding: "6px 0 0" }}>
                <div style={{ backgroundColor: INK, color: "#FFFFFF", borderRadius: "6px", padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: 900, letterSpacing: "0.08em" }}>TOTAL (CAD)</span>
                  <span style={{ fontSize: "16px", fontWeight: 900, fontFamily: MONO }}>{formatCAD(finalTotal)}</span>
                </div>
              </td>
            </tr>
            {depositAmount > 0 && (
              <tr>
                <td style={{ color: "#475569", fontWeight: 700, padding: "6px 0 0" }}>
                  Deposit due on approval{estimate.deposit_type === "percentage" ? ` (${estimate.deposit_value}%)` : ""}
                </td>
                <td style={{ textAlign: "right", fontWeight: 800, fontFamily: MONO, padding: "6px 0 0" }}>{formatCAD(depositAmount)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Notes & terms */}
      {(clientNotes || termsText || disclaimerText) && (
        <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: "10px", marginBottom: "16px" }}>
          {clientNotes && (
            <div data-pdf-block style={{ marginBottom: "8px" }}>
              <div style={labelStyle}>Message</div>
              <div style={{ fontSize: "10px", color: "#334155", lineHeight: 1.4, whiteSpace: "pre-line" }}>{clientNotes}</div>
            </div>
          )}
          {termsText && (
            <div data-pdf-block style={{ marginBottom: "8px" }}>
              <div style={labelStyle}>Terms & conditions</div>
              <div style={{ fontSize: "9px", color: "#475569", lineHeight: 1.4, whiteSpace: "pre-line" }}>{termsText}</div>
            </div>
          )}
          {disclaimerText && (
            <div data-pdf-block>
              <div style={labelStyle}>Contract / disclaimer</div>
              <div style={{ fontSize: "8.5px", color: MUTED, lineHeight: 1.4, whiteSpace: "pre-line" }}>{disclaimerText}</div>
            </div>
          )}
        </div>
      )}

      {/* Acceptance */}
      <div data-pdf-block style={{ border: "1px solid #E5E7EB", borderRadius: "8px", padding: "12px 14px", marginBottom: "18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "16px", marginBottom: "12px" }}>
          <div style={{ fontSize: "11px", fontWeight: 900, letterSpacing: "0.06em" }}>ACCEPTANCE</div>
          {approvalUrl && (
            <div style={{ fontSize: "9px", color: MUTED, textAlign: "right" }}>
              Approve online: <span style={{ color: "#3F7D1C", fontWeight: 700, wordBreak: "break-all" }}>{approvalUrl}</span>
            </div>
          )}
        </div>
        <div style={{ fontSize: "9px", color: "#475569", marginBottom: "18px" }}>
          By signing below, I accept this estimate and authorize {COMPANY_DETAILS.name} to perform the work described above.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
          <div style={{ borderTop: "1px solid #94A3B8", paddingTop: "3px", fontSize: "8.5px", color: MUTED, fontWeight: 700 }}>Customer signature</div>
          <div style={{ borderTop: "1px solid #94A3B8", paddingTop: "3px", fontSize: "8.5px", color: MUTED, fontWeight: 700 }}>Date</div>
        </div>
      </div>

      {/* Footer */}
      <div data-pdf-block style={{ borderTop: `3px solid ${GREEN}`, paddingTop: "8px", display: "flex", justifyContent: "space-between", gap: "12px", fontSize: "9px", color: MUTED }}>
        <span style={{ fontWeight: 700, color: INK }}>Thank you for choosing {COMPANY_DETAILS.name}</span>
        <span>{COMPANY_DETAILS.phone} · {COMPANY_DETAILS.email} · {websiteLabel}</span>
      </div>
    </div>
  );
};
