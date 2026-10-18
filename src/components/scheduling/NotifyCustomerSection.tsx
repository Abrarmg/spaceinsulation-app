import React, { useEffect, useState } from 'react';
import { BellRing, Check, Loader2, Mail } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { Job } from './types';

type Kind = 'confirmation' | 'reminder';

const sentLabel = (iso: string | null) =>
  iso ? `Sent ${new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : null;

/** Email the customer an appointment confirmation or reminder (via /api/job-notify). */
export const NotifyCustomerSection: React.FC<{ job: Job }> = ({ job }) => {
  const [sent, setSent] = useState<Record<Kind, string | null>>({ confirmation: null, reminder: null });
  const [busy, setBusy] = useState<Kind | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const email = job.customers?.email;

  // Fetched separately so the calendar still loads before the notifications migration is run.
  useEffect(() => {
    let active = true;
    supabase
      .from('jobs')
      .select('confirmation_sent_at, reminder_sent_at')
      .eq('id', job.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) setSent({ confirmation: data.confirmation_sent_at, reminder: data.reminder_sent_at });
      });
    return () => {
      active = false;
    };
  }, [job.id]);

  const send = async (kind: Kind) => {
    setBusy(kind);
    setMessage(null);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch('/api/job-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` },
        body: JSON.stringify({ jobId: job.id, kind }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) throw new Error(body.message || `Request failed (${res.status})`);
      setSent(s => ({ ...s, [kind]: body.sentAt }));
      setMessage({ text: `${kind === 'confirmation' ? 'Confirmation' : 'Reminder'} sent to ${body.to}` });
    } catch (err: any) {
      setMessage({ text: err.message, error: true });
    } finally {
      setBusy(null);
    }
  };

  const button = (kind: Kind, label: string, Icon: typeof Mail) => (
    <div className="flex-1 min-w-[150px]">
      <button
        type="button"
        onClick={() => send(kind)}
        disabled={!!busy || !email || !job.scheduled_date}
        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-[#151A2D] hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
      >
        {busy === kind ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} className="text-[#16A34A]" />}
        {sent[kind] ? `Resend ${label.toLowerCase()}` : `Send ${label.toLowerCase()}`}
      </button>
      {sent[kind] && (
        <div className="text-[9.5px] text-slate-500 font-semibold mt-1 flex items-center gap-1">
          <Check size={10} className="text-[#16A34A]" /> {sentLabel(sent[kind])}
        </div>
      )}
    </div>
  );

  return (
    <div className="px-5 py-4 border-t border-[#E7E9ED] space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="text-[9px] uppercase font-bold text-[#737A86]">Notify customer</div>
        <div className="text-[10px] text-slate-500 font-semibold truncate max-w-[60%]">{email || 'No email on file'}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {button('confirmation', 'Confirmation', Mail)}
        {button('reminder', 'Reminder', BellRing)}
      </div>
      {message && (
        <div className={`text-[10.5px] font-semibold ${message.error ? 'text-red-600' : 'text-[#16A34A]'}`}>{message.text}</div>
      )}
      <p className="text-[9.5px] text-slate-400 m-0">Reminders also go out automatically the afternoon before (around 4–5pm) for scheduled jobs.</p>
    </div>
  );
};
