import React from 'react';
import { COMPANY_DETAILS } from '../../config/constants';

export interface InvoiceLineItem {
  name?: string;
  service?: string;
  title?: string;
  description?: string;
  quantity?: number | string;
  unit_price?: number;
  total?: number;
  [key: string]: any;
}

export interface InvoiceDocumentData {
  id?: string;
  invoice_number?: string;
  created_at?: string;
  due_date?: string;
  sent_at?: string | null;
  paid_at?: string | null;
  status?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  issue_date?: string;
  payment_terms?: string;
  discount_type?: string;
  discount_value?: number;
  tax_rate?: number;
  notes?: string;
  payment_instructions?: string;
  customer_message?: string;
  stripe_payment_id?: string | null;
  line_items?: InvoiceLineItem[] | null;
  customers?: {
    id?: string;
    full_name?: string;
    email?: string;
    phone?: string;
    service_address?: string;
    billing_address?: string;
    [key: string]: any;
  } | null;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  service_address?: string;
  billing_address?: string;
  [key: string]: any;
}

export interface InvoiceDocumentProps {
  invoice: InvoiceDocumentData;
  containerId?: string;
  className?: string;
}

/**
 * Format currency in CAD ($1,234.56)
 */
export const formatInvoiceCurrency = (val: number | string | undefined | null): string => {
  const num = typeof val === 'number' ? val : parseFloat(String(val || 0)) || 0;
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

/**
 * Format date in America/Toronto business timezone (e.g. "Aug 29, 2026")
 */
export const formatInvoiceDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  try {
    const raw = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/Toronto',
    }).format(d);
  } catch {
    return '';
  }
};

export const InvoiceDocument: React.FC<InvoiceDocumentProps> = ({
  invoice,
  containerId = 'invoice-document',
  className = '',
}) => {
  const cust = invoice.customers;
  const customerName = invoice.customer_name || cust?.full_name || 'Valued Customer';
  const customerAddress = invoice.billing_address || cust?.billing_address || invoice.service_address || cust?.service_address || '';
  const customerPhone = invoice.customer_phone || cust?.phone || '';
  const customerEmail = invoice.customer_email || cust?.email || '';

  // Bottom left secondary / service location (if distinct or available)
  const secondaryServiceAddress = (cust?.service_address && cust?.service_address !== customerAddress)
    ? cust.service_address
    : (cust?.billing_address && cust?.billing_address !== customerAddress ? cust.billing_address : '');

  // Normalized Invoice Number: "INV-419" -> "419", "419" -> "419"
  const rawNum = String(invoice.invoice_number || '1001').trim();
  const normalizedNum = rawNum.replace(/^INV[-_\s]*/i, '').replace(/^#/, '');
  const displayInvoiceNumber = normalizedNum || rawNum;

  // Issued & Due dates formatted in America/Toronto
  const formattedIssueDate = formatInvoiceDate(invoice.issue_date || invoice.created_at || new Date().toISOString());
  const formattedDueDate = formatInvoiceDate(invoice.due_date || invoice.created_at || new Date().toISOString());

  // Normalize line items
  const rawItems: InvoiceLineItem[] = Array.isArray(invoice.line_items) && invoice.line_items.length > 0
    ? invoice.line_items
    : [
        {
          service: 'Insulation Services',
          description: 'Attic insulation upgrade and related services.',
          quantity: 1,
          unit_price: Number(invoice.subtotal || invoice.total || 0),
        },
      ];

  const processedItems = rawItems.map((item) => {
    const rawService = (item.service || item.name || item.title || '').trim();
    let rawDesc = (item.description || '').trim();

    let title = rawService;
    let desc = rawDesc;

    // If title is missing and description contains a colon (e.g. "Insulation removal: Remove and safely dispose...")
    if (!title && rawDesc) {
      if (rawDesc.includes(':') && rawDesc.indexOf(':') <= 45) {
        const colonIdx = rawDesc.indexOf(':');
        title = rawDesc.slice(0, colonIdx).trim();
        desc = rawDesc.slice(colonIdx + 1).trim();
      } else {
        title = rawDesc;
        desc = rawDesc;
      }
    } else if (title && desc) {
      // Strip redundant duplicate title prefixes from description
      if (desc.startsWith(title + ':')) {
        desc = desc.slice(title.length + 1).trim();
      } else if (desc.startsWith(title + '\n')) {
        desc = desc.slice(title.length + 1).trim();
      }
    }

    const qty = item.quantity != null ? (typeof item.quantity === 'number' ? item.quantity : parseFloat(String(item.quantity)) || 1) : 1;
    const unitPrice = Number(item.unit_price) || 0;
    const rowTotal = item.total != null && Number(item.total) > 0 ? Number(item.total) : qty * unitPrice;

    return {
      title: title || 'Service Item',
      description: desc,
      quantity: qty,
      unitPrice,
      total: rowTotal,
    };
  });

  // Calculate Subtotal, Discount, Tax, Total
  const calculatedSubtotal = processedItems.reduce((sum, item) => sum + item.total, 0);
  const authoritativeSubtotal = invoice.subtotal != null && Number(invoice.subtotal) > 0 ? Number(invoice.subtotal) : calculatedSubtotal;
  
  // Discount
  const discountType = invoice.discount_type || 'none';
  const discountVal = Number(invoice.discount_value || 0);
  let discountAmt = 0;
  let discountLabel = 'Discount';
  if (discountType === 'percentage' && discountVal > 0) {
    discountAmt = Math.min(authoritativeSubtotal, Number(((authoritativeSubtotal * discountVal) / 100).toFixed(2)));
    discountLabel = `Discount (${discountVal}%)`;
  } else if (discountType === 'fixed' && discountVal > 0) {
    discountAmt = Math.min(authoritativeSubtotal, discountVal);
    discountLabel = 'Discount';
  }
  const discountedSubtotal = Math.max(0, authoritativeSubtotal - discountAmt);

  // Tax
  const taxRate = invoice.tax_rate != null ? Number(invoice.tax_rate) : 13.0;
  const calculatedTax = Number(((discountedSubtotal * taxRate) / 100).toFixed(2));
  const authoritativeTax = invoice.tax != null ? Number(invoice.tax) : calculatedTax;
  
  // Total
  const calculatedTotal = Number((discountedSubtotal + authoritativeTax).toFixed(2));
  const authoritativeTotal = invoice.total != null && Number(invoice.total) > 0 ? Number(invoice.total) : calculatedTotal;

  // Address lines split helper
  const renderAddressLines = (addrStr: string) => {
    if (!addrStr) return null;
    const lines = addrStr.split(/[\n,]+/).map((l) => l.trim()).filter(Boolean);
    return lines.map((line, idx) => (
      <div key={idx} style={{ fontSize: '10.5px', color: '#334155', lineHeight: 1.35 }}>
        {line}
      </div>
    ));
  };

  return (
    <div
      id={containerId}
      className={`bg-white text-[#151A2D] mx-auto print:shadow-none print:m-0 ${className}`}
      style={{
        width: '100%',
        maxWidth: '816px',
        boxSizing: 'border-box',
        padding: '40px 44px',
        backgroundColor: '#FFFFFF',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        lineHeight: 1.35,
        color: '#151A2D',
      }}
    >
      {/* 1. TOP HEADER: Branding Lockup on Left, INVOICE # and ISSUED/DUE on Right */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '20px',
        }}
      >
        {/* Left Branding Lockup: [HOUSE LOGO] + SPACE INSULATION */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '92px',
            textAlign: 'center',
          }}
        >
          <img
            src="/logo.png"
            alt="Space Insulation"
            style={{
              width: '70px',
              height: '70px',
              display: 'block',
              objectFit: 'contain',
            }}
          />
          <div
            style={{
              fontSize: '13.5px',
              fontWeight: 900,
              letterSpacing: '0.14em',
              color: '#151A2D',
              textTransform: 'uppercase',
              lineHeight: 1.15,
              marginTop: '2px',
            }}
          >
            SPACE
          </div>
          <div
            style={{
              fontSize: '10.5px',
              fontWeight: 800,
              letterSpacing: '0.16em',
              color: '#76C442',
              textTransform: 'uppercase',
              lineHeight: 1.1,
              marginTop: '1px',
            }}
          >
            INSULATION
          </div>
        </div>

        {/* Right Header: INVOICE #419 + short green underline + ISSUED / DUE */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            minWidth: '220px',
          }}
        >
          <div
            style={{
              fontSize: '24px',
              fontWeight: 800,
              letterSpacing: '-0.01em',
              color: '#151A2D',
              textTransform: 'uppercase',
              lineHeight: 1.15,
              whiteSpace: 'nowrap',
            }}
          >
            INVOICE #{displayInvoiceNumber}
          </div>

          {/* Short green underline directly beneath INVOICE # */}
          <div
            style={{
              height: '2px',
              backgroundColor: '#76C442',
              width: '100%',
              marginTop: '5px',
              marginBottom: '10px',
            }}
          />

          {/* ISSUED and DUE Side by Side Columns */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '16px',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '8.5px',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: '#64748B',
                  textTransform: 'uppercase',
                  lineHeight: 1.2,
                }}
              >
                ISSUED:
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#151A2D',
                  marginTop: '2px',
                  lineHeight: 1.3,
                }}
              >
                {formattedIssueDate}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: '8.5px',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: '#64748B',
                  textTransform: 'uppercase',
                  lineHeight: 1.2,
                }}
              >
                DUE:
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#151A2D',
                  marginTop: '2px',
                  lineHeight: 1.3,
                }}
              >
                {formattedDueDate}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. RECIPIENT / SENDER SECTION: Two equal columns with separate green top lines */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '28px',
          marginBottom: '20px',
        }}
      >
        {/* LEFT: RECIPIENT */}
        <div
          style={{
            borderTop: '2px solid #76C442',
            paddingTop: '6px',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: '#64748B',
              textTransform: 'uppercase',
              marginBottom: '4px',
            }}
          >
            RECIPIENT:
          </div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#151A2D', marginBottom: '3px' }}>
            {customerName}
          </div>
          {customerAddress ? (
            <div style={{ marginBottom: '3px' }}>
              {renderAddressLines(customerAddress)}
            </div>
          ) : null}
          {customerPhone && (
            <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>
              <span style={{ color: '#64748B', fontWeight: 600 }}>Phone: </span>
              {customerPhone}
            </div>
          )}
          {customerEmail && (
            <div style={{ fontSize: '10px', color: '#475569', marginTop: '1px' }}>
              <span style={{ color: '#64748B', fontWeight: 600 }}>Email: </span>
              {customerEmail}
            </div>
          )}
        </div>

        {/* RIGHT: SENDER */}
        <div
          style={{
            borderTop: '2px solid #76C442',
            paddingTop: '6px',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: '#64748B',
              textTransform: 'uppercase',
              marginBottom: '4px',
            }}
          >
            SENDER:
          </div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#151A2D', marginBottom: '3px' }}>
            {COMPANY_DETAILS.name}
          </div>
          <div style={{ fontSize: '10px', color: '#475569', marginBottom: '3px' }}>
            {COMPANY_DETAILS.taxNumber}
          </div>
          <div style={{ fontSize: '10.5px', color: '#334155', lineHeight: 1.35, marginBottom: '6px' }}>
            <div>{COMPANY_DETAILS.addressLine1}</div>
            <div>{COMPANY_DETAILS.addressLine2}</div>
          </div>
          <div style={{ fontSize: '10px', color: '#475569', lineHeight: 1.4 }}>
            <div>
              <span style={{ color: '#64748B', fontWeight: 600 }}>Phone: </span>
              {COMPANY_DETAILS.phone}
            </div>
            <div>
              <span style={{ color: '#64748B', fontWeight: 600 }}>Email: </span>
              {COMPANY_DETAILS.email}
            </div>
            <div>
              <span style={{ color: '#64748B', fontWeight: 600 }}>Website: </span>
              {COMPANY_DETAILS.website}
            </div>
          </div>
        </div>
      </div>

      {/* 3. "For Services Rendered" SECTION */}
      <div style={{ marginTop: '12px', marginBottom: '8px' }}>
        {/* Full width green divider line */}
        <div
          style={{
            height: '2px',
            backgroundColor: '#76C442',
            width: '100%',
            marginBottom: '10px',
          }}
        />
        <div
          style={{
            fontSize: '14.5px',
            fontWeight: 800,
            color: '#151A2D',
            textAlign: 'left',
            letterSpacing: '-0.01em',
          }}
        >
          For Services Rendered
        </div>
      </div>

      {/* 4. LINE ITEMS TABLE */}
      <div style={{ marginBottom: '20px' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: '#76C442',
                color: '#FFFFFF',
              }}
            >
              <th
                style={{
                  width: '24%',
                  padding: '7px 10px',
                  fontSize: '9px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textAlign: 'left',
                }}
              >
                Product/Service
              </th>
              <th
                style={{
                  width: '43%',
                  padding: '7px 10px',
                  fontSize: '9px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textAlign: 'left',
                }}
              >
                Description
              </th>
              <th
                style={{
                  width: '7%',
                  padding: '7px 10px',
                  fontSize: '9px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textAlign: 'center',
                }}
              >
                Qty.
              </th>
              <th
                style={{
                  width: '13%',
                  padding: '7px 10px',
                  fontSize: '9px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textAlign: 'right',
                }}
              >
                Unit Price
              </th>
              <th
                style={{
                  width: '13%',
                  padding: '7px 10px',
                  fontSize: '9px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textAlign: 'right',
                }}
              >
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {processedItems.map((item, index) => (
              <tr
                key={index}
                style={{
                  borderBottom: '1px solid #E5E7EB',
                }}
              >
                {/* Product/Service */}
                <td
                  style={{
                    padding: '9px 10px',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    color: '#151A2D',
                    verticalAlign: 'top',
                  }}
                >
                  {item.title}
                </td>

                {/* Description */}
                <td
                  style={{
                    padding: '9px 10px',
                    fontSize: '9.5px',
                    color: '#334155',
                    lineHeight: 1.35,
                    verticalAlign: 'top',
                  }}
                >
                  {item.description}
                </td>

                {/* Qty. */}
                <td
                  style={{
                    padding: '9px 10px',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#151A2D',
                    textAlign: 'center',
                    verticalAlign: 'top',
                  }}
                >
                  {item.quantity}
                </td>

                {/* Unit Price */}
                <td
                  style={{
                    padding: '9px 10px',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#151A2D',
                    textAlign: 'right',
                    verticalAlign: 'top',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatInvoiceCurrency(item.unitPrice)}
                </td>

                {/* Total */}
                <td
                  style={{
                    padding: '9px 10px',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    color: '#151A2D',
                    textAlign: 'right',
                    verticalAlign: 'top',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatInvoiceCurrency(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Gray bottom border matching client reference */}
        <div
          style={{
            height: '1.5px',
            backgroundColor: '#94A3B8',
            width: '100%',
          }}
        />
      </div>

      {/* 5. LOWER SECTION: Secondary/Service Address (Bottom Left) + Compact Totals (Bottom Right) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginTop: '28px',
        }}
      >
        {/* Bottom Left: Customer Secondary / Service Location Address if available */}
        <div style={{ maxWidth: '280px', textAlign: 'left' }}>
          {secondaryServiceAddress ? (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#151A2D', marginBottom: '2px' }}>
                {customerName}
              </div>
              {renderAddressLines(secondaryServiceAddress)}
            </div>
          ) : null}
        </div>

        {/* Bottom Right: Compact Totals */}
        <div
          style={{
            width: '260px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Subtotal */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '10.5px',
              padding: '3px 0',
            }}
          >
            <span style={{ color: '#475569', fontWeight: 600 }}>Subtotal</span>
            <span style={{ fontWeight: 600, color: '#151A2D' }}>
              {formatInvoiceCurrency(authoritativeSubtotal)}
            </span>
          </div>

          {/* Discount (if configured) */}
          {discountAmt > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '10.5px',
                padding: '3px 0',
              }}
            >
              <span style={{ color: '#475569', fontWeight: 600 }}>{discountLabel}</span>
              <span style={{ fontWeight: 600, color: '#DC2626' }}>
                -{formatInvoiceCurrency(discountAmt)}
              </span>
            </div>
          )}

          {/* HST with dynamic Tax Rate */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '10.5px',
              padding: '3px 0',
            }}
          >
            <span style={{ color: '#475569', fontWeight: 600 }}>
              HST ({taxRate.toFixed(1)}%)
            </span>
            <span style={{ fontWeight: 600, color: '#151A2D' }}>
              {formatInvoiceCurrency(authoritativeTax)}
            </span>
          </div>

          {/* Dark divider line above TOTAL */}
          <div
            style={{
              height: '1.5px',
              backgroundColor: '#151A2D',
              width: '100%',
              margin: '6px 0 8px 0',
            }}
          />

          {/* TOTAL */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '14.5px',
              fontWeight: 800,
              padding: '2px 0',
            }}
          >
            <span style={{ color: '#151A2D', letterSpacing: '0.02em' }}>TOTAL</span>
            <span style={{ color: '#151A2D' }}>
              {formatInvoiceCurrency(authoritativeTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* 6. OPTIONAL PAYMENT INSTRUCTIONS, NOTES / TERMS, AND MESSAGE TO CUSTOMER */}
      {(invoice.payment_instructions || invoice.notes || invoice.customer_message) && (
        <div
          style={{
            marginTop: '28px',
            paddingTop: '16px',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            textAlign: 'left',
          }}
        >
          {invoice.payment_instructions && (
            <div>
              <div
                style={{
                  fontSize: '9.5px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#76C442',
                  marginBottom: '3px',
                }}
              >
                Payment Instructions
              </div>
              <div
                style={{
                  fontSize: '9.5px',
                  color: '#334155',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.45,
                }}
              >
                {invoice.payment_instructions}
              </div>
            </div>
          )}

          {invoice.notes && (
            <div>
              <div
                style={{
                  fontSize: '9.5px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#151A2D',
                  marginBottom: '3px',
                }}
              >
                Notes / Terms
              </div>
              <div
                style={{
                  fontSize: '9.5px',
                  color: '#475569',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.45,
                }}
              >
                {invoice.notes}
              </div>
            </div>
          )}

          {invoice.customer_message && (
            <div>
              <div
                style={{
                  fontSize: '9.5px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#151A2D',
                  marginBottom: '3px',
                }}
              >
                Message to Customer
              </div>
              <div
                style={{
                  fontSize: '9.5px',
                  color: '#475569',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.45,
                }}
              >
                {invoice.customer_message}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
