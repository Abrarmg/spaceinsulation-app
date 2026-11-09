import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  CheckCircle2, 
  Printer, 
  Phone, 
  Mail, 
  MapPin, 
  User, 
  ShieldCheck, 
  Sparkles, 
  AlertCircle, 
  FileText, 
  Loader2, 
  Check 
} from 'lucide-react';

interface LineItem {
  id?: string;
  type?: 'item' | 'section';
  name?: string;
  service?: string;
  description?: string;
  quantity?: number | string;
  unit_price?: number | string;
  is_optional?: boolean;
  is_recommended?: boolean;
  image_url?: string | null;
}

interface ClientViewSettings {
  show_quantity?: boolean;
  show_unit_price?: boolean;
  show_line_item_totals?: boolean;
  show_total?: boolean;
}

interface EstimateData {
  id?: string;
  estimate_number: string;
  title?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  expert_name?: string | null;
  expert_role?: string | null;
  expert_email?: string | null;
  expert_phone?: string | null;
  expert_address?: string | null;
  line_items: LineItem[];
  subtotal: number;
  discount_type?: string;
  discount_value?: number;
  discount_amount?: number;
  discounted_subtotal?: number;
  tax_rate?: number;
  tax: number;
  total: number;
  total_amount: number;
  deposit_type?: string;
  deposit_value?: number;
  client_view_settings?: ClientViewSettings;
  client_message?: string | null;
  contract_disclaimer?: string | null;
  terms?: string | null;
  intro_title?: string;
  intro_text?: string;
  header_image_url?: string | null;
  status: string;
  approved_at: string | null;
  created_at: string;
}

export const ApproveEstimate: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [estimate, setEstimate] = useState<EstimateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchEstimate();
  }, [token]);

  // Staff previewing a link while signed in shouldn't count as a customer view.
  const recordView = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) return;
      await fetch('/api/estimate-viewed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        keepalive: true,
      });
    } catch (err) {
      console.warn('Could not record quote view:', err);
    }
  };

  const fetchEstimate = async () => {
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('approve-estimate', {
        body: { action: 'get', token },
      });

      if (fnErr) throw fnErr;
      if (data?.error) {
        setError(data.error);
        return;
      }

      setEstimate(data);
      recordView();

      if (data.status === 'Approved' || data.approved_at) {
        setApproved(true);
      }
    } catch (err: any) {
      console.error('Fetch quote error:', err);
      setError('This quote link is no longer valid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (approving || approved) return;
    setApproving(true);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('approve-estimate', {
        body: { action: 'approve', token },
      });

      if (fnErr) throw fnErr;
      if (data?.error === 'already_approved') {
        setApproved(true);
        return;
      }
      if (data?.success) {
        setApproved(true);
        if (estimate) {
          setEstimate({
            ...estimate,
            status: 'Approved',
            approved_at: new Date().toISOString()
          });
        }
      }
    } catch (err: any) {
      console.error('Approval error:', err);
      alert('Something went wrong while approving the quote. Please try again or contact our office.');
    } finally {
      setApproving(false);
    }
  };

  const formatCurrency = (val: number | string | undefined | null) => {
    const num = Number(val || 0);
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(num);
  };

  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return new Date().toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });
    try {
      return new Date(dateStr).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // ─── LOADING STATE ───
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas font-sans p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-line border-t-brand rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-muted">Loading your estimate…</p>
        </div>
      </div>
    );
  }

  // ─── ERROR STATE ───
  if (error || !estimate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas font-sans p-4">
        <div className="bg-white p-8 sm:p-12 rounded-2xl shadow-xl border border-line text-center max-w-md w-full space-y-5">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
            <AlertCircle size={32} />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-navy">This estimate link isn't active</h2>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              {error || 'This quote link may have expired, been updated, or already completed. Please reach out to our team if you need assistance.'}
            </p>
          </div>
          <div className="p-4 bg-canvas rounded-xl border border-line text-xs text-muted space-y-1">
            <div className="font-bold text-navy">Space Insulation Support</div>
            <div><a href="tel:6477049021" className="text-navy">(647) 704-9021</a> · <a href="mailto:info@spaceinsulation.ca" className="text-navy">info@spaceinsulation.ca</a></div>
          </div>
        </div>
      </div>
    );
  }

  // ─── VIEW SETTINGS DEFAULTS ───
  const viewSettings: ClientViewSettings = {
    show_quantity: estimate.client_view_settings?.show_quantity ?? true,
    show_unit_price: estimate.client_view_settings?.show_unit_price ?? true,
    show_line_item_totals: estimate.client_view_settings?.show_line_item_totals ?? true,
    show_total: estimate.client_view_settings?.show_total ?? true,
  };

  const rawLineItems = Array.isArray(estimate.line_items) ? estimate.line_items : [];
  
  // Normalize items to support both new and historical formats
  const normalizedItems = rawLineItems.map((item, idx) => {
    const isSection = item.type === 'section';
    const name = item.name || item.service || item.description || `Service Item #${idx + 1}`;
    const description = item.name ? (item.description || '') : '';
    const qty = isSection ? 0 : Number(item.quantity ?? 1);
    const price = isSection ? 0 : Number(item.unit_price ?? 0);
    const is_optional = Boolean(item.is_optional);
    const is_recommended = Boolean(item.is_recommended);
    const image_url = item.image_url || null;

    return {
      type: isSection ? ('section' as const) : ('item' as const),
      name,
      description,
      quantity: qty,
      unit_price: price,
      line_total: qty * price,
      is_optional,
      is_recommended,
      image_url,
    };
  });

  const hasOptionalItems = normalizedItems.some(i => i.is_optional);

  // Exact calculations from normalized data
  const calculatedSubtotal = normalizedItems.reduce((acc, item) => {
    if (item.type === 'section' || item.is_optional) return acc;
    return acc + item.line_total;
  }, 0);

  const subtotal = estimate.subtotal ?? calculatedSubtotal;
  const taxRate = estimate.tax_rate ?? 0.13;

  let discountAmount = estimate.discount_amount ?? 0;
  if (discountAmount === 0 && estimate.discount_type && estimate.discount_type !== 'none') {
    if (estimate.discount_type === 'percentage') {
      discountAmount = (subtotal * (Number(estimate.discount_value) || 0)) / 100;
    } else if (estimate.discount_type === 'fixed') {
      discountAmount = Number(estimate.discount_value) || 0;
    }
  }
  discountAmount = Math.min(discountAmount, subtotal);

  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const tax = estimate.tax ?? Number((discountedSubtotal * taxRate).toFixed(2));
  const finalTotal = estimate.total_amount || estimate.total || (discountedSubtotal + tax);

  // Deposit calculation
  let depositAmount = 0;
  if (estimate.deposit_type && estimate.deposit_type !== 'none') {
    if (estimate.deposit_type === 'percentage') {
      depositAmount = (finalTotal * (Number(estimate.deposit_value) || 0)) / 100;
    } else if (estimate.deposit_type === 'fixed') {
      depositAmount = Number(estimate.deposit_value) || 0;
    }
  }

  const isApproved = approved || estimate.status === 'Approved' || Boolean(estimate.approved_at);

  return (
    <div className="min-h-screen bg-canvas pt-4 sm:pt-10 pb-28 sm:pb-10 px-3 sm:px-6 font-sans text-navy print:bg-white print:p-0">
      
      {/* Print styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body, html { background: #ffffff !important; color: #000000 !important; }
          .print\\:hidden { display: none !important; }
          .shadow-xl, .shadow-md, .shadow-sm { box-shadow: none !important; }
          .border-line { border-color: #cbd5e1 !important; }
        }
      `}} />

      {/* ─── TOP UTILITY BAR (Web Only) ─── */}
      <header className="max-w-4xl mx-auto mb-6 flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <img 
            src="/logo.png" 
            alt="Space Insulation" 
            className="w-10 h-10 object-contain rounded-lg shadow-2xs"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://hcoxvaqeomtpcsegadip.supabase.co/storage/v1/object/public/job-media/logo.png';
            }}
          />
          <div>
            <div className="font-bold text-[0.9375rem] text-navy tracking-tight">Space Insulation</div>
            <div className="text-xs text-muted">Your estimate</div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href="tel:6477049021"
            className="hidden sm:inline-flex items-center gap-1.5 h-10 px-3 text-sm font-medium text-navy bg-white border border-line rounded-lg hover:bg-mist transition-colors no-underline"
          >
            <Phone size={13} className="text-brand-hover" />
            <span>(647) 704-9021</span>
          </a>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 h-10 px-3.5 text-sm font-medium text-navy bg-white border border-line rounded-lg hover:bg-mist transition-colors cursor-pointer"
          >
            <Printer size={13} />
            <span>Print or save PDF</span>
          </button>
        </div>
      </header>

      {/* ─── MAIN DOCUMENT CONTAINER ─── */}
      <main className="max-w-4xl mx-auto bg-white rounded-2xl shadow-card border border-line overflow-hidden print:border-none print:shadow-none">
        
        {/* ─── 1. HEADER & BRANDING ─── */}
        <section className="p-6 sm:p-10 border-b border-mist bg-white">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-mist">
            {/* Logo and Brand */}
            <div className="flex items-start gap-4">
              <img 
                src="/logo.png" 
                alt="Space Insulation Logo" 
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-xl"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://hcoxvaqeomtpcsegadip.supabase.co/storage/v1/object/public/job-media/logo.png';
                }}
              />
              <div className="space-y-1">
                <h1 className="text-xl sm:text-2xl font-bold text-navy tracking-tight m-0">
                  SPACE INSULATION
                </h1>
                <p className="text-2xs font-bold uppercase tracking-wide text-subtle m-0">
                  Ontario's Trusted Insulation Experts
                </p>
                <p className="text-xs text-muted pt-1 m-0">
                  1070 Major MacKenzie Dr. E, Richmond Hill, ON L4S 1P3
                </p>
              </div>
            </div>

            {/* Reference, Date, Status */}
            <div className="sm:text-right space-y-1.5">
              <div className="inline-flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-muted">
                  #{estimate.estimate_number}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider ${
                  isApproved 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                  {isApproved ? '✓ Approved' : (estimate.status || 'Quote Sent')}
                </span>
              </div>
              <div className="text-xs text-muted font-medium">
                Issued: {formatDate(estimate.created_at)}
              </div>
            </div>
          </div>

          {/* Quote Title */}
          <div className="pt-6 pb-2">
            <h2 className="text-xl sm:text-2xl font-bold text-navy tracking-tight m-0">
              {estimate.title || 'Attic Insulation Quotation'}
            </h2>
          </div>

          {/* Client & Estimator Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            {/* Prepared For */}
            <div className="p-4 rounded-xl bg-canvas border border-line/80 space-y-1.5 text-xs">
              <span className="text-2xs font-bold uppercase tracking-wider text-subtle block">
                Prepared For
              </span>
              <div className="font-bold text-sm text-navy flex items-center gap-1.5">
                <User size={14} className="text-brand-hover" />
                <span>{estimate.customer_name}</span>
              </div>
              {estimate.customer_address && (
                <div className="text-ink-soft flex items-start gap-1.5 pt-0.5">
                  <MapPin size={13} className="text-subtle shrink-0 mt-0.5" />
                  <span className="font-semibold">{estimate.customer_address}</span>
                </div>
              )}
              {estimate.customer_phone && (
                <div className="text-muted flex items-center gap-1.5">
                  <Phone size={12} className="text-subtle" />
                  <span>{estimate.customer_phone}</span>
                </div>
              )}
              {estimate.customer_email && (
                <div className="text-muted flex items-center gap-1.5">
                  <Mail size={12} className="text-subtle" />
                  <span>{estimate.customer_email}</span>
                </div>
              )}
            </div>

            {/* Prepared By (Estimator) */}
            <div className="p-4 rounded-xl bg-canvas border border-line/80 space-y-1.5 text-xs">
              <span className="text-2xs font-bold uppercase tracking-wider text-subtle block">
                Your Estimator
              </span>
              <div className="font-bold text-sm text-navy flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-brand-hover" />
                <span>{estimate.expert_name || 'Space Insulation Specialist'}</span>
                {estimate.expert_role && (
                  <span className="text-xs font-normal text-muted">({estimate.expert_role})</span>
                )}
              </div>
              {estimate.expert_phone && (
                <div className="text-muted flex items-center gap-1.5 pt-0.5">
                  <Phone size={12} className="text-subtle" />
                  <span>{estimate.expert_phone}</span>
                </div>
              )}
              {estimate.expert_email && (
                <div className="text-muted flex items-center gap-1.5">
                  <Mail size={12} className="text-subtle" />
                  <span>{estimate.expert_email}</span>
                </div>
              )}
              {estimate.expert_address && (
                <div className="text-muted flex items-start gap-1.5">
                  <MapPin size={12} className="text-subtle shrink-0 mt-0.5" />
                  <span>{estimate.expert_address}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ─── 2. HERO IMAGE & INTRODUCTION ─── */}
        {(estimate.header_image_url || estimate.intro_text) && (
          <section className="p-6 sm:p-10 border-b border-mist bg-canvas/50 space-y-4">
            {/* Header Hero Image */}
            {estimate.header_image_url && (
              <div className="w-full h-44 sm:h-56 rounded-2xl overflow-hidden shadow-xs border border-line">
                <img 
                  src={estimate.header_image_url} 
                  alt="Scope Banner" 
                  className="w-full h-full object-cover" 
                />
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-navy m-0">
                {estimate.intro_title || 'Estimate / Scope of Work'}
              </h3>
              {estimate.intro_text && (
                <p className="text-xs sm:text-sm leading-relaxed text-ink-soft whitespace-pre-line m-0">
                  {estimate.intro_text}
                </p>
              )}
            </div>
          </section>
        )}

        {/* ─── 3. PRODUCTS & SERVICES ─── */}
        <section className="p-6 sm:p-10 border-b border-mist space-y-5">
          <div className="border-b border-mist pb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-navy m-0">
              Products & Services
            </h3>
            <span className="text-2xs text-subtle font-semibold">
              {normalizedItems.filter(i => i.type !== 'section').length} items proposed
            </span>
          </div>

          <div className="space-y-4">
            {normalizedItems.map((item, idx) => {
              if (item.type === 'section') {
                // TEXT SECTION
                return (
                  <div 
                    key={idx} 
                    className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-1.5 my-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-wider bg-indigo-600 text-white">
                        Information
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-navy m-0">
                        {item.name}
                      </h4>
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted leading-relaxed m-0 whitespace-pre-line">
                        {item.description}
                      </p>
                    )}
                  </div>
                );
              }

              // PRICED ITEM
              return (
                <div 
                  key={idx}
                  className={`p-4 rounded-xl border transition-all ${
                    item.is_optional 
                      ? 'bg-amber-50/25 border-amber-200' 
                      : 'bg-white border-line hover:border-line-strong'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    {/* Item details */}
                    <div className="space-y-1.5 flex-grow">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-navy">
                          {item.name}
                        </span>

                        {item.is_recommended && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wide">
                            <Sparkles size={10} />
                            Recommended
                          </span>
                        )}

                        {item.is_optional && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wide">
                            Optional Upgrade
                          </span>
                        )}
                      </div>

                      {item.description && (
                        <p className="text-xs text-muted leading-relaxed m-0 whitespace-pre-line">
                          {item.description}
                        </p>
                      )}

                      {item.image_url && (
                        <div className="pt-2">
                          <img 
                            src={item.image_url} 
                            alt={item.name} 
                            className="w-32 h-20 object-cover rounded-lg border border-line"
                          />
                        </div>
                      )}

                      {/* Quantity & Unit price (if enabled in client_view_settings) */}
                      {(viewSettings.show_quantity || viewSettings.show_unit_price) && (
                        <div className="text-2xs text-muted pt-1 font-medium flex items-center gap-2">
                          {viewSettings.show_quantity && (
                            <span>Quantity: <strong>{item.quantity}</strong></span>
                          )}
                          {viewSettings.show_quantity && viewSettings.show_unit_price && <span>·</span>}
                          {viewSettings.show_unit_price && (
                            <span>Unit Price: <strong>{formatCurrency(item.unit_price)}</strong></span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Line total (if enabled) */}
                    {viewSettings.show_line_item_totals && (
                      <div className="sm:text-right shrink-0 pt-1 sm:pt-0">
                        <span className={`text-sm sm:text-base font-mono font-bold block ${
                          item.is_optional ? 'text-amber-800' : 'text-navy'
                        }`}>
                          {formatCurrency(item.line_total)}
                        </span>
                        {item.is_optional && (
                          <span className="text-2xs text-amber-700 font-semibold block">
                            (Optional)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── 4. PRICING SUMMARY ─── */}
        <section className="p-6 sm:p-10 border-b border-mist bg-canvas/40">
          <div className="max-w-md ml-auto space-y-3 text-xs sm:text-sm">
            
            {/* Subtotal */}
            <div className="flex justify-between items-center text-muted">
              <span>Subtotal</span>
              <span className="font-mono font-bold text-navy">{formatCurrency(subtotal)}</span>
            </div>

            {/* Discount */}
            {discountAmount > 0 && (
              <div className="flex justify-between items-center text-emerald-700">
                <span>
                  Discount {estimate.discount_type === 'percentage' ? `(${estimate.discount_value}%)` : ''}
                </span>
                <span className="font-mono font-bold">-{formatCurrency(discountAmount)}</span>
              </div>
            )}

            {/* Discounted Subtotal */}
            {discountAmount > 0 && (
              <div className="flex justify-between items-center text-muted border-t border-line/60 pt-2">
                <span>Discounted Subtotal</span>
                <span className="font-mono font-bold text-navy">{formatCurrency(discountedSubtotal)}</span>
              </div>
            )}

            {/* Tax */}
            <div className="flex justify-between items-center text-muted">
              <span>HST ({(taxRate * 100).toFixed(1)}%)</span>
              <span className="font-mono font-bold text-navy">{formatCurrency(tax)}</span>
            </div>

            {/* Total (if viewSettings.show_total) */}
            {viewSettings.show_total && (
              <div className="border-t-2 border-line-strong pt-3 flex justify-between items-baseline">
                <div>
                  <span className="text-sm font-bold text-navy uppercase tracking-wider block">
                    Quote Total
                  </span>
                  <span className="text-2xs text-subtle">All applicable taxes included</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl sm:text-3xl font-mono font-bold text-brand-hover">
                    {formatCurrency(finalTotal)}
                  </span>
                  <span className="text-xs text-subtle font-bold ml-1.5">CAD</span>
                </div>
              </div>
            )}

            {/* Optional items callout note */}
            {hasOptionalItems && (
              <div className="pt-2 text-2xs text-amber-800 font-semibold bg-amber-50 border border-amber-200/80 p-3 rounded-xl">
                ℹ️ Optional services are not included in the current quote total.
              </div>
            )}

            {/* ─── 5. DEPOSIT REQUIRED ─── */}
            {depositAmount > 0 && (
              <div className="mt-3 p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl space-y-1">
                <div className="flex justify-between items-center text-xs sm:text-sm font-bold text-indigo-950">
                  <span>Deposit Required</span>
                  <span className="font-mono">{formatCurrency(depositAmount)}</span>
                </div>
                <p className="text-2xs text-indigo-700 m-0">
                  {estimate.deposit_type === 'percentage' 
                    ? `${estimate.deposit_value}% deposit required upon approval.`
                    : 'Upfront deposit required upon quote approval.'}
                </p>
              </div>
            )}

          </div>
        </section>

        {/* ─── 6. CLIENT MESSAGE ─── */}
        {estimate.client_message && (
          <section className="p-6 sm:p-10 border-b border-mist bg-white">
            <div className="p-4 sm:p-5 bg-canvas border border-line rounded-2xl space-y-1.5">
              <span className="text-2xs font-bold uppercase tracking-wider text-subtle flex items-center gap-1.5">
                <Mail size={12} className="text-brand-hover" />
                Message from Space Insulation
              </span>
              <p className="text-xs sm:text-sm leading-relaxed text-ink-soft m-0 whitespace-pre-line">
                {estimate.client_message}
              </p>
            </div>
          </section>
        )}

        {/* ─── 7. TERMS & DISCLAIMERS ─── */}
        {(estimate.contract_disclaimer || estimate.terms) && (
          <section className="p-6 sm:p-10 border-b border-mist bg-canvas/30 space-y-6">
            {estimate.contract_disclaimer && (
              <div className="space-y-1.5">
                <h4 className="text-sm font-semibold text-navy flex items-center gap-1.5 m-0">
                  <ShieldCheck size={14} className="text-brand-hover" />
                  Contract & Disclaimers
                </h4>
                <p className="text-xs text-muted leading-relaxed m-0 whitespace-pre-line">
                  {estimate.contract_disclaimer}
                </p>
              </div>
            )}

            {estimate.terms && (
              <div className="space-y-1.5">
                <h4 className="text-sm font-semibold text-navy flex items-center gap-1.5 m-0">
                  <FileText size={14} className="text-brand-hover" />
                  Terms & Conditions
                </h4>
                <p className="text-xs text-muted leading-relaxed m-0 whitespace-pre-line">
                  {estimate.terms}
                </p>
              </div>
            )}
          </section>
        )}

        {/* ─── 8. APPROVAL AREA (Web Only) ─── */}
        <section id="approve" className="p-6 sm:p-10 bg-white print:hidden scroll-mt-4">
          {isApproved ? (
            /* APPROVED STATE */
            <div className="p-6 sm:p-8 bg-brand-soft border border-brand/40 rounded-2xl text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-brand text-navy flex items-center justify-center mx-auto">
                <Check size={28} className="stroke-[3]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg sm:text-xl font-bold text-emerald-950 m-0">
                  Estimate approved
                </h3>
                <p className="text-xs sm:text-sm text-emerald-800 font-medium">
                  {estimate.approved_at ? `Approved on ${formatDate(estimate.approved_at)}` : 'Approved by customer'}
                </p>
              </div>
              <p className="text-xs text-emerald-700 max-w-md mx-auto leading-relaxed m-0">
                Thank you for your business! Our project coordinator has received your approval and will reach out shortly to schedule your insulation installation.
              </p>
            </div>
          ) : (
            /* READY TO APPROVE ACTION */
            <div className="p-6 sm:p-8 bg-canvas border border-line rounded-2xl text-center space-y-4">
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-navy m-0">
                  Ready to move forward?
                </h3>
                <p className="text-xs sm:text-sm text-muted max-w-md mx-auto leading-relaxed m-0">
                  Approve this estimate and our team will get in touch to book your installation date.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={approving}
                  className="w-full sm:w-auto min-w-[280px] inline-flex items-center justify-center gap-2 h-14 px-8 bg-brand hover:bg-brand-hover disabled:bg-line-strong disabled:cursor-not-allowed text-navy font-semibold text-base rounded-xl transition-colors cursor-pointer border-none"
                >
                  {approving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Approving…</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Approve estimate</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-muted m-0">
                By approving, you confirm acceptance of the quoted scope, materials, and pricing outlined above.
              </p>
            </div>
          )}
        </section>

        {/* ─── FOOTER ─── */}
        <footer className="p-6 sm:p-8 bg-navy text-white text-center text-xs space-y-2">
          <div className="font-bold text-sm">Space Insulation Inc.</div>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-subtle">
            <a href="tel:6477049021" className="text-subtle no-underline hover:text-white">(647) 704-9021</a>
            <a href="mailto:info@spaceinsulation.ca" className="text-subtle no-underline hover:text-white">info@spaceinsulation.ca</a>
            <a href="https://spaceinsulation.ca" className="text-subtle no-underline hover:text-white">spaceinsulation.ca</a>
          </div>
          <p className="text-2xs text-muted pt-2 m-0 border-t border-navy">
            Professional blown-in, fiberglass & spray foam insulation across Ontario · Conforming to OBC standards
          </p>
        </footer>

      </main>


      {/* Phone: approve is always one tap away */}
      {!isApproved && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-line px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-3 print:hidden">
          {viewSettings.show_total && (
            <div className="min-w-0">
              <div className="text-2xs text-muted">Total</div>
              <div className="text-lg font-bold text-navy leading-tight">{formatCurrency(finalTotal)}</div>
            </div>
          )}
          <a
            href="#approve"
            className="flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-hover text-navy text-base font-semibold no-underline"
          >
            <CheckCircle2 size={18} /> Review & approve
          </a>
        </div>
      )}

    </div>
  );
};
