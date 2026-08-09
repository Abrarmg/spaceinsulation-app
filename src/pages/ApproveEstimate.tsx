import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';

interface EstimateData {
  estimate_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  home_size: number;
  insulation_type: string;
  insulation_rate: number;
  line_items: any[];
  subtotal: number;
  tax: number;
  total: number;
  total_amount: number;
  status: string;
  approved_at: string | null;
  intro_text: string;
  scope_of_work: string;
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

      if (data.status === 'Approved' || data.approved_at) {
        setApproved(true);
      }
    } catch (err: any) {
      setError('This link is no longer valid.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (approving) return;
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
      }
    } catch (err: any) {
      alert('Something went wrong. Please try again.');
    } finally {
      setApproving(false);
    }
  };

  const formatCurrency = (val: number) =>
    '$' + val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // ─── LOADING STATE ───
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #f7f8fa 0%, #edf2f7 100%)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px', height: '48px', border: '4px solid #e2e8f0', borderTopColor: '#76C442',
            borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px',
          }} />
          <p style={{ color: '#64748B', fontSize: '14px' }}>Loading estimate...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ─── ERROR STATE ───
  if (error || !estimate) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #f7f8fa 0%, #edf2f7 100%)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{
          background: '#fff', padding: '48px', borderRadius: '16px', textAlign: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)', maxWidth: '420px', width: '90%',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#151A2D', marginBottom: '8px' }}>
            This link is no longer valid
          </h2>
          <p style={{ fontSize: '14px', color: '#64748B', lineHeight: 1.6 }}>
            This estimate link may have expired or already been used. Please contact Space Insulation
            if you need assistance.
          </p>
          <div style={{ marginTop: '24px', padding: '12px', background: '#f7f8fa', borderRadius: '8px', fontSize: '12px', color: '#64748B' }}>
            📞 (647) 704-9021 &nbsp;|&nbsp; ✉ info@spaceinsulation.ca
          </div>
        </div>
      </div>
    );
  }

  // ─── SUCCESS / APPROVED STATE ───
  if (approved) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #f7f8fa 0%, #edf2f7 100%)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{
          background: '#fff', padding: '48px', borderRadius: '16px', textAlign: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)', maxWidth: '500px', width: '90%',
        }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%', background: '#f0fdf4',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', border: '3px solid #76C442',
          }}>
            <span style={{ fontSize: '32px' }}>✓</span>
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#151A2D', marginBottom: '12px' }}>
            Estimate Approved!
          </h2>
          <p style={{ fontSize: '15px', color: '#64748B', lineHeight: 1.7, marginBottom: '24px' }}>
            Thanks — we'll be in touch to schedule your installation.
            Our team will contact you shortly to confirm the details.
          </p>
          <div style={{
            padding: '16px', background: '#f7f8fa', borderRadius: '12px', fontSize: '13px',
            color: '#151A2D', fontWeight: 600,
          }}>
            Estimate {estimate.estimate_number} · {formatCurrency(estimate.total_amount || estimate.total)}
          </div>
          <div style={{ marginTop: '20px', fontSize: '12px', color: '#64748B' }}>
            📞 (647) 704-9021 &nbsp;|&nbsp; ✉ info@spaceinsulation.ca
          </div>
        </div>
      </div>
    );
  }

  // ─── MAIN: ESTIMATE REVIEW PAGE ───
  const lineItems = Array.isArray(estimate.line_items) ? estimate.line_items : [];
  const displayTotal = estimate.total_amount || estimate.total;

  return (
    <div style={{
      minHeight: '100vh', padding: '24px 16px',
      background: 'linear-gradient(135deg, #f7f8fa 0%, #edf2f7 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        maxWidth: '680px', margin: '0 auto', background: '#fff', borderRadius: '16px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden',
      }}>
        {/* ─── HEADER ─── */}
        <div style={{ padding: '24px 28px 16px', borderBottom: '2px solid #76C442' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ width: '56px', verticalAlign: 'top', padding: 0 }}>
                  <img
                    src="https://hcoxvaqeomtpcsegadip.supabase.co/storage/v1/object/public/job-media/logo.png"
                    alt="Logo" width="56" height="56"
                    style={{ width: '56px', height: '56px', objectFit: 'contain', display: 'block' }}
                  />
                </td>
                <td style={{ paddingLeft: '14px', verticalAlign: 'top', paddingTop: '2px' }}>
                  <h1 style={{ fontSize: '18px', fontWeight: 900, color: '#151A2D', margin: 0, letterSpacing: '-0.02em' }}>
                    SPACE INSULATION
                  </h1>
                  <span style={{ fontSize: '9px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                    Ontario's Trusted Insulation Experts
                  </span>
                </td>
                <td style={{ verticalAlign: 'top', textAlign: 'right', paddingTop: '4px' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
                    {estimate.estimate_number}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ─── BODY ─── */}
        <div style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#151A2D', marginBottom: '4px' }}>
            Insulation Estimate
          </h2>
          <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '24px', lineHeight: 1.5 }}>
            Please review your estimate details below and approve to proceed.
          </p>

          {/* ─── CUSTOMER & PROJECT CARDS ─── */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <div style={{
              flex: '1 1 240px', padding: '16px', borderRadius: '10px',
              border: '1px solid #E5E7EB', background: '#fafbfc',
            }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                Prepared For
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#151A2D', marginBottom: '6px' }}>
                👤 {estimate.customer_name}
              </div>
              {estimate.customer_phone && (
                <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '3px' }}>
                  📞 {estimate.customer_phone}
                </div>
              )}
              {estimate.customer_email && (
                <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '3px' }}>
                  ✉ {estimate.customer_email}
                </div>
              )}
              {estimate.customer_address && (
                <div style={{ fontSize: '12px', color: '#151A2D', fontWeight: 600 }}>
                  📍 {estimate.customer_address}
                </div>
              )}
            </div>

            <div style={{
              flex: '1 1 240px', padding: '16px', borderRadius: '10px',
              border: '1px solid #E5E7EB', background: '#fafbfc',
            }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                Project Details
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>
                <strong>Home Size:</strong> {Number(estimate.home_size).toLocaleString()} sq ft
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>
                <strong>Insulation:</strong> {estimate.insulation_type}
              </div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>
                <strong>Rate:</strong> {formatCurrency(Number(estimate.insulation_rate))}/sq ft
              </div>
            </div>
          </div>

          {/* ─── LINE ITEMS TABLE ─── */}
          {lineItems.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#151A2D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                Proposed Quotation & Services
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#151A2D' }}>
                    <th style={{ padding: '10px 12px', color: '#fff', fontWeight: 700, textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Service</th>
                    <th style={{ padding: '10px 12px', color: '#fff', fontWeight: 700, textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description</th>
                    <th style={{ padding: '10px 12px', color: '#fff', fontWeight: 700, textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Qty</th>
                    <th style={{ padding: '10px 12px', color: '#fff', fontWeight: 700, textAlign: 'right', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Rate</th>
                    <th style={{ padding: '10px 12px', color: '#fff', fontWeight: 700, textAlign: 'right', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#151A2D' }}>{item.service || item.description?.split(' ')[0] || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#64748B' }}>{item.description || '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#151A2D' }}>{item.quantity || 1}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#151A2D' }}>{formatCurrency(Number(item.unit_price || 0))}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#151A2D' }}>
                        {formatCurrency(Number(item.quantity || 1) * Number(item.unit_price || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── PRICING SUMMARY ─── */}
          <div style={{
            padding: '20px', background: '#fafbfc', borderRadius: '12px',
            border: '1px solid #E5E7EB', marginBottom: '28px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
              <span style={{ color: '#64748B' }}>Subtotal</span>
              <span style={{ color: '#151A2D', fontWeight: 600 }}>{formatCurrency(estimate.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13px' }}>
              <span style={{ color: '#64748B' }}>HST (13%)</span>
              <span style={{ color: '#151A2D', fontWeight: 600 }}>{formatCurrency(estimate.tax)}</span>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', background: '#fff', borderRadius: '8px',
              border: '2px solid #76C442',
            }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#151A2D', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Estimate
              </span>
              <span style={{ fontSize: '22px', fontWeight: 900, color: '#76C442' }}>
                {formatCurrency(displayTotal)} <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>CAD</span>
              </span>
            </div>
          </div>

          {/* ─── CTA BUTTON ─── */}
          <button
            onClick={handleApprove}
            disabled={approving}
            style={{
              width: '100%', padding: '16px', fontSize: '16px', fontWeight: 800,
              background: approving ? '#a3d977' : '#76C442', color: '#fff',
              border: 'none', borderRadius: '12px', cursor: approving ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              boxShadow: '0 4px 12px rgba(118,196,66,0.3)',
              transition: 'all 0.2s ease',
            }}
          >
            {approving ? 'Approving...' : '✓  Approve Estimate'}
          </button>

          <p style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', marginTop: '12px', lineHeight: 1.5 }}>
            By approving, you confirm acceptance of the above scope and pricing.
            Our team will contact you to schedule your installation.
          </p>
        </div>

        {/* ─── FOOTER ─── */}
        <div style={{
          padding: '16px 28px', background: '#151A2D', textAlign: 'center',
          fontSize: '11px', color: '#94a3b8', lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700, color: '#fff', marginBottom: '4px' }}>Space Insulation Inc.</div>
          <div>📞 (647) 704-9021 &nbsp;·&nbsp; ✉ info@spaceinsulation.ca &nbsp;·&nbsp; 🌐 spaceinsulation.ca</div>
        </div>
      </div>
    </div>
  );
};
