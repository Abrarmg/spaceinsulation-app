import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { CheckCircle2, Loader2, Home } from 'lucide-react';

interface Invoice {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
  paid_at: string | null;
  stripe_payment_id: string | null;
  customers: {
    full_name: string;
    email: string;
  } | null;
}

export const PaymentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const invoiceId = searchParams.get('invoice_id');

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!invoiceId) {
        setError('Missing invoice reference parameter.');
        setLoading(false);
        return;
      }

      try {
        const { data, error: dbErr } = await supabase
          .from('invoices')
          .select('id, invoice_number, total, status, paid_at, stripe_payment_id, customers(full_name, email)')
          .eq('id', invoiceId)
          .maybeSingle();

        if (dbErr) throw dbErr;

        if (!data) {
          setError('Invoice not found.');
        } else {
          // Type assertion for nested relation
          const formattedData: Invoice = {
            id: data.id,
            invoice_number: data.invoice_number,
            total: Number(data.total),
            status: data.status,
            paid_at: data.paid_at,
            stripe_payment_id: data.stripe_payment_id,
            customers: Array.isArray(data.customers) ? data.customers[0] : data.customers,
          };
          setInvoice(formattedData);
        }
      } catch (err: any) {
        console.error('Error loading invoice details:', err);
        setError('Failed to retrieve transaction details.');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [invoiceId]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-canvas text-navy gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
        <span className="text-sm font-medium text-muted">Confirming your payment…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas py-10 sm:py-16 px-4 flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-md bg-white border border-line rounded-2xl shadow-card overflow-hidden p-6 sm:p-10 text-center space-y-6">
        
        {/* Header Logo */}
        <div className="flex justify-center items-center gap-3 border-b border-line pb-5">
          <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain" />
          <div className="text-left">
            <h1 className="text-lg font-bold text-navy tracking-tight leading-none m-0">Space Insulation</h1>
            <span className="text-xs text-muted block mt-1">Attic insulation & ventilation</span>
          </div>
        </div>

        {error ? (
          <div className="space-y-4 py-4">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto border border-red-200">
              <span className="text-2xl font-bold">!</span>
            </div>
            <h2 className="text-xl font-bold text-navy">Something went wrong</h2>
            <p className="text-sm text-muted leading-relaxed">
              {error}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="w-16 h-16 bg-brand-soft text-brand-ink rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-navy tracking-tight">Payment received</h2>
              <p className="text-sm text-muted leading-relaxed">
                Thank you! Your payment for Invoice <strong>{invoice?.invoice_number}</strong> has been received. Thank you for choosing Space Insulation.
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="bg-canvas border border-line rounded-xl p-4 text-sm space-y-3 text-left">
              <div className="flex justify-between items-center">
                <span className="text-muted">Billed To</span>
                <span className="font-semibold text-navy">{invoice?.customers?.full_name || 'Client'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Payment reference</span>
                <span className="font-mono text-2xs text-navy">{invoice?.stripe_payment_id || '--'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Date Received</span>
                <span className="text-navy">
                  {invoice?.paid_at ? new Date(invoice.paid_at).toLocaleString() : new Date().toLocaleString()}
                </span>
              </div>
              <div className="border-t border-line pt-3 flex justify-between items-center">
                <span className="font-semibold text-navy">Amount paid</span>
                <span className="font-bold text-lg text-brand-ink">${invoice?.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Action */}
        <div className="pt-4 flex flex-col gap-2.5">
          <button
            onClick={() => navigate('/')}
            className="w-full inline-flex items-center justify-center gap-2 h-12 px-5 bg-navy hover:bg-navy-soft text-white font-semibold text-sm rounded-lg cursor-pointer transition-colors border-0"
          >
            <Home size={16} className="text-brand" />
            <span>Done</span>
          </button>
        </div>

      </div>
    </div>
  );
};
