import React from "react";
import { COMPANY_DETAILS } from "../../config/constants";

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
}

const formatCAD = (val: number): string => {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

export const EstimateDocument: React.FC<EstimateDocumentProps> = ({
  estimate,
  containerId = "estimate-document",
  className = "",
}) => {
  const cust = estimate.customers;
  const customerName = estimate.customer_name || cust?.full_name || "Valued Customer";
  const customerAddress = estimate.property_address || cust?.service_address || "";
  const customerPhone = estimate.customer_phone || cust?.phone || "";
  const customerEmail = estimate.customer_email || cust?.email || "";

  // Format dynamic estimate date: sent date or created date
  const rawDate = estimate.sent_at || estimate.created_at || new Date().toISOString();
  const formattedDate = new Date(rawDate).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

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

    // 1. Prefer service if meaningfully shorter than name, or if name is a long sentence/description
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

    // 2. Fallback to description
    if (!title) {
      title = rawDesc;
    }

    // 3. If title is long (>40 chars) and contains colon or dash, extract concise service title
    if (title.length > 40 && (title.includes(":") || title.includes(" - "))) {
      const separator = title.includes(":") ? ":" : " - ";
      const parts = title.split(separator);
      const head = parts[0].trim();
      if (head.length > 2 && head.length <= 40) {
        if (!rawDesc || rawDesc === title) {
          rawDesc = parts.slice(1).join(separator).trim();
        }
        title = head;
      }
    }

    // 4. Do not duplicate identical description if title already displays it
    if (rawDesc.toLowerCase() === title.toLowerCase()) {
      rawDesc = "";
    } else if (rawDesc.toLowerCase().startsWith(title.toLowerCase() + ":")) {
      rawDesc = rawDesc.slice(title.length + 1).trim();
    } else if (rawDesc.toLowerCase().startsWith(title.toLowerCase() + " - ")) {
      rawDesc = rawDesc.slice(title.length + 3).trim();
    }

    const quantity = item.quantity != null ? item.quantity : 1;
    const unitPrice = Number(item.unit_price) || 0;

    return {
      isSection: false,
      title,
      description: rawDesc,
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
  } else if (Number(estimate.deposit_value) > 0) {
    depositAmount = Number(estimate.deposit_value);
  }

  const clientNotes = (estimate.client_message || estimate.intro_text || "").trim();
  const termsText = (estimate.terms || "").trim();
  const disclaimerText = (estimate.contract_disclaimer || "").trim();

  // Normalize estimate number: "EST-1045" -> "1045", "1045" -> "1045"
  const rawNum = String(estimate.estimate_number || "1001").trim();
  const normalizedNum = rawNum.replace(/^EST[-_\s]*/i, "").replace(/^#/, "");
  const displayEstimateNumber = normalizedNum || rawNum;

  return (
    <div
      id={containerId}
      className={`bg-white text-[#151A2D] mx-auto print:shadow-none print:m-0 ${className}`}
      style={{
        width: "100%",
        maxWidth: "816px",
        boxSizing: "border-box",
        padding: "40px 44px",
        backgroundColor: "#FFFFFF",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        lineHeight: 1.35,
        color: "#151A2D",
      }}
    >
      {/* 1. TOP HEADER: Branding Lockup on Left, ESTIMATE # and SENT ON on Right */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "16px",
        }}
      >
        {/* Left Branding Lockup: [HOUSE LOGO] + SPACE INSULATION */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "92px",
            textAlign: "center",
          }}
        >
          <img
            src="/logo.png"
            alt="Space Insulation"
            style={{
              width: "70px",
              height: "70px",
              display: "block",
              objectFit: "contain",
            }}
          />
          <div
            style={{
              fontSize: "13.5px",
              fontWeight: 900,
              letterSpacing: "0.14em",
              color: "#151A2D",
              textTransform: "uppercase",
              lineHeight: 1.15,
              marginTop: "2px",
            }}
          >
            SPACE
          </div>
          <div
            style={{
              fontSize: "10.5px",
              fontWeight: 800,
              letterSpacing: "0.16em",
              color: "#76C442",
              textTransform: "uppercase",
              lineHeight: 1.1,
              marginTop: "1px",
            }}
          >
            INSULATION
          </div>
        </div>

        {/* Right side: ESTIMATE #1046 + short green underline + SENT ON */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              fontSize: "23px",
              fontWeight: 800,
              letterSpacing: "-0.01em",
              color: "#151A2D",
              textTransform: "uppercase",
              lineHeight: 1.15,
              whiteSpace: "nowrap",
            }}
          >
            ESTIMATE #{displayEstimateNumber}
          </div>
          <div
            style={{
              height: "2px",
              backgroundColor: "#76C442",
              width: "100%",
              marginTop: "5px",
              marginBottom: "8px",
            }}
          />
          <div
            style={{
              fontSize: "8.5px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "#64748B",
              textTransform: "uppercase",
              lineHeight: 1.2,
              textAlign: "left",
            }}
          >
            SENT ON
          </div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 500,
              color: "#151A2D",
              marginTop: "2px",
              lineHeight: 1.3,
              textAlign: "left",
            }}
          >
            {formattedDate}
          </div>
        </div>
      </div>

      {/* 2. RECIPIENT / SENDER SECTION: Two equal columns with separate green top lines */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "28px",
          marginBottom: "16px",
        }}
      >
        {/* LEFT: RECIPIENT */}
        <div
          style={{
            borderTop: "2px solid #76C442",
            paddingTop: "6px",
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: "#64748B",
              textTransform: "uppercase",
              marginBottom: "4px",
            }}
          >
            RECIPIENT
          </div>
          <div style={{ fontSize: "12.5px", fontWeight: 800, color: "#151A2D", marginBottom: "2px" }}>
            {customerName}
          </div>
          {customerAddress && (
            <div style={{ fontSize: "10.5px", color: "#334155", lineHeight: 1.35, marginBottom: "2px" }}>
              {customerAddress}
            </div>
          )}
          {customerPhone && (
            <div style={{ fontSize: "10px", color: "#475569", marginTop: "1px" }}>
              <span style={{ color: "#64748B", fontWeight: 600 }}>Phone: </span>
              {customerPhone}
            </div>
          )}
          {customerEmail && (
            <div style={{ fontSize: "10px", color: "#475569", marginTop: "1px" }}>
              <span style={{ color: "#64748B", fontWeight: 600 }}>Email: </span>
              {customerEmail}
            </div>
          )}
        </div>

        {/* RIGHT: SENDER */}
        <div
          style={{
            borderTop: "2px solid #76C442",
            paddingTop: "6px",
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: "#64748B",
              textTransform: "uppercase",
              marginBottom: "4px",
            }}
          >
            SENDER
          </div>
          <div style={{ fontSize: "12.5px", fontWeight: 800, color: "#151A2D", marginBottom: "2px" }}>
            {COMPANY_DETAILS.name}
          </div>
          <div style={{ fontSize: "10px", fontWeight: 600, color: "#475569", marginBottom: "1px" }}>
            {COMPANY_DETAILS.taxNumber}
          </div>
          <div style={{ fontSize: "10.5px", color: "#334155", lineHeight: 1.35 }}>
            {COMPANY_DETAILS.addressLine1}
          </div>
          <div style={{ fontSize: "10.5px", color: "#334155", lineHeight: 1.35, marginBottom: "1px" }}>
            {COMPANY_DETAILS.addressLine2}
          </div>
          <div style={{ fontSize: "10px", color: "#475569", marginTop: "1px" }}>
            <span style={{ color: "#64748B", fontWeight: 600 }}>Phone: </span>
            {COMPANY_DETAILS.phone}
          </div>
          <div style={{ fontSize: "10px", color: "#475569", marginTop: "1px" }}>
            <span style={{ color: "#64748B", fontWeight: 600 }}>Email: </span>
            {COMPANY_DETAILS.email}
          </div>
          <div style={{ fontSize: "10px", color: "#475569", marginTop: "1px" }}>
            <span style={{ color: "#64748B", fontWeight: 600 }}>Website: </span>
            {COMPANY_DETAILS.website}
          </div>
        </div>
      </div>

      {/* 3. PRODUCTS / SERVICES TABLE */}
      <div style={{ marginBottom: "14px" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
            fontSize: "10px",
          }}
        >
          <thead style={{ display: "table-header-group" }}>
            <tr
              style={{
                backgroundColor: "#76C442",
                color: "#FFFFFF",
                fontWeight: 800,
                textTransform: "uppercase",
                fontSize: "9.5px",
                letterSpacing: "0.06em",
                lineHeight: "1.2",
              }}
            >
              <th
                style={{
                  width: "22%",
                  padding: "6px 8px",
                  textAlign: "left",
                  verticalAlign: "middle",
                }}
              >
                PRODUCT SERVICE
              </th>
              <th
                style={{
                  width: "57%",
                  padding: "6px 8px",
                  textAlign: "left",
                  verticalAlign: "middle",
                }}
              >
                DESCRIPTION
              </th>
              <th
                style={{
                  width: "7%",
                  padding: "6px 4px",
                  textAlign: "center",
                  verticalAlign: "middle",
                }}
              >
                QTY
              </th>
              <th
                style={{
                  width: "14%",
                  padding: "6px 8px",
                  textAlign: "right",
                  verticalAlign: "middle",
                }}
              >
                UNIT PRICE
              </th>
            </tr>
          </thead>
          <tbody>
            {processedItems.map((item, idx) => {
              if (item.isSection) {
                return (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: "1px solid #E5E7EB",
                      backgroundColor: "#F8FAFC",
                      pageBreakInside: "avoid",
                      breakInside: "avoid",
                    }}
                  >
                    <td
                      colSpan={4}
                      style={{
                        padding: "6px 8px",
                        textAlign: "left",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 800,
                          color: "#151A2D",
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                        }}
                      >
                        {item.title}
                      </div>
                      {item.description && (
                        <div
                          style={{
                            fontSize: "9.5px",
                            color: "#64748B",
                            marginTop: "1px",
                            lineHeight: 1.3,
                          }}
                        >
                          {item.description}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={idx}
                  style={{
                    borderBottom: "1px solid #E5E7EB",
                    backgroundColor: "#FFFFFF",
                    verticalAlign: "top",
                    pageBreakInside: "avoid",
                    breakInside: "avoid",
                  }}
                >
                  <td
                    style={{
                      padding: "6px 8px",
                      textAlign: "left",
                      width: "22%",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "10.5px",
                        fontWeight: 700,
                        color: "#151A2D",
                        lineHeight: 1.25,
                      }}
                    >
                      {item.title}
                      {item.isOptional && (
                        <span
                          style={{
                            color: "#64748B",
                            fontWeight: 500,
                            fontStyle: "italic",
                            fontSize: "8.5px",
                            marginLeft: "3px",
                          }}
                        >
                          (Optional)
                        </span>
                      )}
                      {item.isRecommended && (
                        <span
                          style={{
                            color: "#5aa32a",
                            fontWeight: 600,
                            fontStyle: "italic",
                            fontSize: "8.5px",
                            marginLeft: "3px",
                          }}
                        >
                          (Recommended)
                        </span>
                      )}
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      textAlign: "left",
                      color: "#475569",
                      fontSize: "9.5px",
                      lineHeight: 1.28,
                      width: "57%",
                    }}
                  >
                    {item.description}
                  </td>
                  <td
                    style={{
                      padding: "6px 4px",
                      textAlign: "center",
                      color: "#151A2D",
                      fontSize: "10px",
                      fontWeight: 600,
                      lineHeight: 1.25,
                      width: "7%",
                    }}
                  >
                    {item.quantity}
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      textAlign: "right",
                      color: "#151A2D",
                      fontSize: "10px",
                      fontWeight: 600,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      whiteSpace: "nowrap",
                      lineHeight: 1.25,
                      width: "14%",
                    }}
                  >
                    {formatCAD(item.unitPrice)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 4. TOTALS SECTION (Bottom-Right, Compact) */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "14px",
          pageBreakInside: "avoid",
          breakInside: "avoid",
        }}
      >
        <div style={{ width: "260px" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "10px",
            }}
          >
            <tbody>
              {/* Subtotal */}
              <tr style={{ height: "19px" }}>
                <td style={{ color: "#64748B", fontWeight: 600, textAlign: "left", padding: "1.5px 0" }}>
                  Subtotal
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#151A2D",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    padding: "1.5px 0",
                  }}
                >
                  {formatCAD(calculatedSubtotal)}
                </td>
              </tr>

              {/* Discount if present */}
              {discountAmount > 0 && (
                <tr style={{ height: "19px" }}>
                  <td style={{ color: "#16A34A", fontWeight: 600, textAlign: "left", padding: "1.5px 0" }}>
                    Discount {estimate.discount_type === "percentage" ? `(${estimate.discount_value}%)` : ""}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      fontWeight: 700,
                      color: "#16A34A",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      padding: "1.5px 0",
                    }}
                  >
                    -{formatCAD(discountAmount)}
                  </td>
                </tr>
              )}

              {/* HST */}
              <tr style={{ height: "19px" }}>
                <td style={{ color: "#64748B", fontWeight: 600, textAlign: "left", padding: "1.5px 0" }}>
                  HST ({(taxRate * 100).toFixed(0)}%)
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#151A2D",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    padding: "1.5px 0",
                  }}
                >
                  {formatCAD(taxAmount)}
                </td>
              </tr>

              {/* Divider before TOTAL */}
              <tr>
                <td colSpan={2} style={{ padding: "3px 0" }}>
                  <div style={{ height: "1.5px", backgroundColor: "#151A2D", width: "100%" }} />
                </td>
              </tr>

              {/* TOTAL */}
              <tr style={{ height: "25px" }}>
                <td
                  style={{
                    fontSize: "12px",
                    fontWeight: 900,
                    color: "#151A2D",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    textAlign: "left",
                    padding: "3px 0",
                  }}
                >
                  TOTAL
                </td>
                <td
                  style={{
                    fontSize: "14px",
                    fontWeight: 900,
                    color: "#151A2D",
                    textAlign: "right",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    padding: "3px 0",
                  }}
                >
                  {formatCAD(finalTotal)}
                </td>
              </tr>

              {/* Deposit Required if configured */}
              {depositAmount > 0 && (
                <>
                  <tr>
                    <td colSpan={2} style={{ padding: "1.5px 0" }}>
                      <div style={{ height: "1px", backgroundColor: "#E5E7EB", width: "100%" }} />
                    </td>
                  </tr>
                  <tr style={{ height: "19px" }}>
                    <td style={{ color: "#475569", fontWeight: 600, textAlign: "left", padding: "1.5px 0", fontSize: "9.5px" }}>
                      Deposit Required
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 700,
                        color: "#151A2D",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        padding: "1.5px 0",
                        fontSize: "9.5px",
                      }}
                    >
                      {formatCAD(depositAmount)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. TERMS / NOTES SECTION */}
      {(clientNotes || termsText || disclaimerText) && (
        <div
          style={{
            borderTop: "1px solid #E5E7EB",
            paddingTop: "8px",
            marginTop: "6px",
            textAlign: "left",
          }}
        >
          {clientNotes && (
            <div style={{ marginBottom: "6px" }}>
              <div
                style={{
                  fontSize: "8.5px",
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  color: "#64748B",
                  textTransform: "uppercase",
                  marginBottom: "2px",
                }}
              >
                CLIENT MESSAGE
              </div>
              <div style={{ fontSize: "9px", color: "#334155", lineHeight: 1.3, whiteSpace: "pre-line" }}>
                {clientNotes}
              </div>
            </div>
          )}

          {termsText && (
            <div style={{ marginBottom: "6px", pageBreakInside: "avoid", breakInside: "avoid" }}>
              <div
                style={{
                  fontSize: "8.5px",
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  color: "#64748B",
                  textTransform: "uppercase",
                  marginBottom: "2px",
                }}
              >
                TERMS & CONDITIONS
              </div>
              <div style={{ fontSize: "8.5px", color: "#475569", lineHeight: 1.3, whiteSpace: "pre-line" }}>
                {termsText}
              </div>
            </div>
          )}

          {disclaimerText && (
            <div style={{ marginBottom: "4px", pageBreakInside: "avoid", breakInside: "avoid" }}>
              <div
                style={{
                  fontSize: "8.5px",
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  color: "#64748B",
                  textTransform: "uppercase",
                  marginBottom: "2px",
                }}
              >
                CONTRACT / DISCLAIMER
              </div>
              <div style={{ fontSize: "8px", color: "#64748B", lineHeight: 1.25, whiteSpace: "pre-line" }}>
                {disclaimerText}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
