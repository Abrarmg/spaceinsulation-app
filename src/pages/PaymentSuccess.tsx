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
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-grey text-brand-charcoal gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-brand-green" />
        <span className="text-sm font-semibold">Confirming your transaction...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-grey py-16 px-4 flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-md bg-white border border-brand-grey-medium rounded-2xl shadow-xl overflow-hidden p-8 md:p-10 text-center space-y-6">
        
        {/* Header Logo */}
        <div className="flex justify-center items-center gap-2 border-b border-brand-grey-medium pb-5">
          <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain" />
          <div className="text-left">
            <h1 className="text-lg font-black text-brand-charcoal tracking-tight leading-none">SPACE INSULATION</h1>
            <span className="text-[8px] font-bold text-brand-grey-dark uppercase tracking-wider block mt-1">Attic Insulation & Ventilation</span>
          </div>
        </div>

        {error ? (
          <div className="space-y-4 py-4">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto border border-red-200">
              <span className="text-2xl font-bold">!</span>
            </div>
            <h2 className="text-xl font-bold text-brand-charcoal">Something went wrong</h2>
            <p className="text-xs font-medium text-brand-grey-dark leading-relaxed">
              {error}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="w-16 h-16 bg-green-50 text-brand-green rounded-full flex items-center justify-center mx-auto border border-green-200 shadow-inner">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-brand-charcoal tracking-tight">Payment Received!</h2>
              <p className="text-xs font-semibold text-brand-grey-dark leading-relaxed">
                Thank you! Your payment for Invoice <strong>{invoice?.invoice_number}</strong> has been successfully received and processed automatically.
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="bg-brand-grey/50 border border-brand-grey-medium rounded-xl p-4 text-xs space-y-3.5">
              <div className="flex justify-between items-center">
                <span className="text-brand-grey-dark font-medium">Billed To</span>
                <span className="font-bold text-brand-charcoal">{invoice?.customers?.full_name || 'Client'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-brand-grey-dark font-medium">Stripe Payment Reference</span>
                <span className="font-mono text-[10px] text-brand-charcoal font-semibold">{invoice?.stripe_payment_id || '--'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-brand-grey-dark font-medium">Date Received</span>
                <span className="font-semibold text-brand-charcoal">
                  {invoice?.paid_at ? new Date(invoice.paid_at).toLocaleString() : new Date().toLocaleString()}
                </span>
              </div>
              <div className="border-t border-brand-grey-medium/60 pt-3 flex justify-between items-center">
                <span className="font-bold text-brand-charcoal">Total Amount Paid</span>
                <span className="font-mono font-black text-base text-brand-green">${invoice?.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Action */}
        <div className="pt-4 flex flex-col gap-2.5">
          <button
            onClick={() => navigate('/')}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-brand-charcoal hover:bg-brand-dark text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow cursor-pointer transition-colors"
          >
            <Home size={14} className="text-brand-green" />
            <span>Go to Dashboard</span>
          </button>
        </div>

      </div>
    </div>
  );
};
