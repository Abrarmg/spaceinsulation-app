import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { supabase } from '../../supabaseClient';

/**
 * Lead → Estimate → Job → Invoice → Paid.
 * Shown at the top of every lead, estimate, job and invoice so users always
 * know where a piece of work is and what to do next.
 */

export type WorkflowStage = 'lead' | 'estimate' | 'job' | 'invoice' | 'paid';

interface ChainRecord {
  id: string;
  number?: string | number | null;
  status?: string | null;
}

export interface WorkflowChain {
  lead?: ChainRecord | null;
  estimate?: ChainRecord | null;
  job?: ChainRecord | null;
  invoice?: ChainRecord | null;
}

interface ChainIds {
  leadId?: string | null;
  estimateId?: string | null;
  jobId?: string | null;
  invoiceId?: string | null;
}

const first = <T,>(rows: T[] | null | undefined): T | null => (rows && rows.length ? rows[0] : null);

/** Finds the records linked to the one being viewed (jobs store estimate_id and lead_id, invoices store job_id). */
const resolveChain = async (start: ChainIds): Promise<WorkflowChain> => {
  const ids = { ...start };
  const chain: WorkflowChain = {};

  if (ids.invoiceId) {
    const { data } = await supabase.from('invoices').select('id, invoice_number, status, job_id').eq('id', ids.invoiceId).limit(1);
    const inv = first(data as any[]);
    if (inv) {
      chain.invoice = { id: inv.id, number: inv.invoice_number, status: inv.status };
      ids.jobId = ids.jobId || inv.job_id;
    }
  }

  if (ids.jobId) {
    const { data } = await supabase.from('jobs').select('id, job_number, status, estimate_id, lead_id').eq('id', ids.jobId).limit(1);
    const job = first(data as any[]);
    if (job) {
      chain.job = { id: job.id, number: job.job_number, status: job.status };
      ids.estimateId = ids.estimateId || job.estimate_id;
      ids.leadId = ids.leadId || job.lead_id;
    }
  }

  if (ids.estimateId) {
    const { data } = await supabase.from('estimates').select('id, estimate_number, status, lead_id').eq('id', ids.estimateId).limit(1);
    const est = first(data as any[]);
    if (est) {
      chain.estimate = { id: est.id, number: est.estimate_number, status: est.status };
      ids.leadId = ids.leadId || est.lead_id;
    }
  }

  if (!chain.job && chain.estimate) {
    const { data } = await supabase.from('jobs').select('id, job_number, status').eq('estimate_id', chain.estimate.id).limit(1);
    const job = first(data as any[]);
    if (job) chain.job = { id: job.id, number: job.job_number, status: job.status };
  }

  if (ids.leadId) {
    chain.lead = { id: ids.leadId };
    if (!chain.estimate) {
      const { data } = await supabase
        .from('estimates')
        .select('id, estimate_number, status')
        .eq('lead_id', ids.leadId)
        .order('created_at', { ascending: false })
        .limit(1);
      const est = first(data as any[]);
      if (est) chain.estimate = { id: est.id, number: est.estimate_number, status: est.status };
    }
    if (!chain.job) {
      const { data } = await supabase.from('jobs').select('id, job_number, status').eq('lead_id', ids.leadId).limit(1);
      const job = first(data as any[]);
      if (job) chain.job = { id: job.id, number: job.job_number, status: job.status };
    }
  }

  if (chain.job && !chain.invoice) {
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, status')
      .eq('job_id', chain.job.id)
      .order('created_at', { ascending: false })
      .limit(1);
    const inv = first(data as any[]);
    if (inv) chain.invoice = { id: inv.id, number: inv.invoice_number, status: inv.status };
  }

  return chain;
};

/**
 * Loads the linked records. Pass whatever ids the page already knows;
 * `refreshKey` reloads the chain after the page changes a status.
 */
export const useWorkflowChain = (ids: ChainIds, refreshKey: unknown = 0) => {
  const [chain, setChain] = useState<WorkflowChain | null>(null);
  const key = `${ids.leadId || ''}|${ids.estimateId || ''}|${ids.jobId || ''}|${ids.invoiceId || ''}`;

  useEffect(() => {
    if (key === '|||') return;
    let cancelled = false;
    resolveChain(ids)
      .then(c => !cancelled && setChain(c))
      .catch(err => {
        console.warn('Could not load linked records for the workflow bar:', err);
        if (!cancelled) setChain({});
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshKey]);

  return chain;
};

const lower = (s?: string | null) => (s || '').toLowerCase();
const JOB_DONE = ['completed', 'invoiced', 'paid'];
const INVOICE_SENT = ['sent', 'paid', 'overdue', 'partially paid', 'partial'];

interface StageView {
  key: WorkflowStage;
  label: string;
  done: boolean;
  detail: string;
  to?: string;
}

const buildStages = (c: WorkflowChain): StageView[] => {
  const est = c.estimate;
  const job = c.job;
  const inv = c.invoice;
  const estApproved = lower(est?.status) === 'approved' || !!job || !!inv;
  const jobDone = JOB_DONE.includes(lower(job?.status)) || !!inv;
  const invSent = INVOICE_SENT.includes(lower(inv?.status));
  const paid = lower(inv?.status) === 'paid';

  return [
    {
      key: 'lead',
      label: 'Lead',
      done: !!c.lead || !!est || !!job || !!inv,
      detail: c.lead ? 'Received' : est || job || inv ? 'Added directly' : 'Not started',
      to: c.lead ? `/leads/${c.lead.id}` : undefined,
    },
    {
      key: 'estimate',
      label: 'Estimate',
      done: estApproved,
      detail: est ? `#${est.number ?? ''} · ${est.status || 'Draft'}` : job || inv ? 'Skipped' : 'Not created',
      to: est ? `/estimates/${est.id}` : undefined,
    },
    {
      key: 'job',
      label: 'Job',
      done: jobDone,
      detail: job ? `#${job.number ?? ''} · ${job.status || 'Scheduled'}` : inv ? 'Skipped' : 'Not booked',
      to: job ? `/jobs/${job.id}` : undefined,
    },
    {
      key: 'invoice',
      label: 'Invoice',
      done: invSent,
      detail: inv ? `${inv.number ?? ''} · ${inv.status || 'Draft'}` : 'Not created',
      to: inv ? `/invoices/${inv.id}` : undefined,
    },
    {
      key: 'paid',
      label: 'Paid',
      done: paid,
      detail: paid ? 'Paid in full' : inv ? 'Waiting for payment' : '—',
      to: inv ? `/invoices/${inv.id}` : undefined,
    },
  ];
};

/** Plain-English description of the next step. */
const nextHint = (c: WorkflowChain, stages: StageView[]): string => {
  const current = stages.find(s => !s.done)?.key;
  const est = lower(c.estimate?.status);
  const job = lower(c.job?.status);
  const inv = lower(c.invoice?.status);
  switch (current) {
    case 'lead':
      return 'Add the lead, then book an assessment.';
    case 'estimate':
      if (!c.estimate) return 'Create an estimate for this customer.';
      if (est === 'sent') return 'Waiting for the customer to approve the estimate. Follow up or convert it to a job.';
      if (est === 'rejected') return 'The customer turned this estimate down. Revise it or send a new one.';
      return 'Send the estimate to the customer.';
    case 'job':
      if (!c.job) return 'Convert the approved estimate into a job.';
      if (job === 'in progress') return 'The crew is on site. Mark the job complete when the work is done.';
      if (job === 'cancelled') return 'This job was cancelled.';
      return 'Do the work, then mark the job complete.';
    case 'invoice':
      if (!c.invoice) return 'Create the invoice for this job.';
      return 'Send the invoice to the customer.';
    case 'paid':
      if (inv === 'overdue') return 'The invoice is overdue. Follow up and record the payment.';
      return 'Record the payment when the customer pays.';
    default:
      return 'All done — this job is paid in full.';
  }
};

interface WorkflowTrackerProps {
  chain: WorkflowChain | null;
  /** The record being viewed, so it isn't shown as a link to itself. */
  here: Exclude<WorkflowStage, 'paid'>;
  /** Overrides the next-step text, e.g. for assessment steps on a lead. */
  hint?: string | null;
}

export const WorkflowTracker: React.FC<WorkflowTrackerProps> = ({ chain, here, hint }) => {
  if (!chain) {
    return <div className="h-[104px] md:h-[92px] rounded-xl border border-line bg-white animate-pulse print:hidden" aria-hidden />;
  }

  const stages = buildStages(chain);
  const currentIndex = stages.findIndex(s => !s.done);
  const allDone = currentIndex === -1;

  return (
    <section className="bg-white border border-line rounded-xl shadow-card print:hidden" aria-label="Progress">
      <ol className="m-0 px-2 pt-3 pb-2 md:px-4 list-none grid grid-cols-5">
        {stages.map((s, i) => {
          const current = i === currentIndex;
          const isHere = s.key === here;
          const reached = s.done || current;
          const circle = (
            <span
              className={`relative z-10 w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                s.done ? 'bg-brand text-navy' : current ? 'bg-white border-2 border-brand text-navy' : 'bg-mist text-muted'
              }`}
            >
              {s.done ? <Check size={15} strokeWidth={3} /> : i + 1}
            </span>
          );
          const body = (
            <>
              {circle}
              <span className={`mt-1.5 text-xs md:text-sm leading-tight ${reached ? 'text-navy font-semibold' : 'text-muted font-medium'}`}>
                {s.label}
              </span>
              <span className="hidden sm:block mt-0.5 text-2xs text-muted leading-tight truncate max-w-full px-1">{s.detail}</span>
            </>
          );
          return (
            <li key={s.key} className="relative flex flex-col items-center text-center min-w-0">
              {i > 0 && (
                <span
                  className={`absolute top-3.5 md:top-4 right-1/2 w-full h-0.5 ${s.done || current ? 'bg-brand' : 'bg-line'}`}
                  aria-hidden
                />
              )}
              {s.to && !isHere ? (
                <Link
                  to={s.to}
                  className="relative flex flex-col items-center w-full no-underline rounded-lg py-1 hover:bg-canvas"
                  title={`Open ${s.label.toLowerCase()}`}
                >
                  {body}
                </Link>
              ) : (
                <div className={`relative flex flex-col items-center w-full py-1 rounded-lg ${isHere ? 'bg-brand-soft/60' : ''}`} aria-current={isHere ? 'step' : undefined}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <div
        className={`mx-3 mb-3 md:mx-4 px-3 py-2 rounded-lg text-sm flex items-start gap-2 ${
          allDone ? 'bg-brand-soft text-brand-ink' : 'bg-canvas text-ink-soft'
        }`}
      >
        <span className="font-semibold text-navy shrink-0">{allDone ? 'Done' : 'Next'}</span>
        <span>{(!allDone && hint) || nextHint(chain, stages)}</span>
      </div>
    </section>
  );
};
