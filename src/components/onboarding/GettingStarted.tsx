import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';

/**
 * "Get set up" checklist on Home for new accounts. Each step ticks itself off
 * from real data, and the card disappears once everything is done or the user
 * hides it.
 */

interface Step {
  key: string;
  title: string;
  description: string;
  to: string;
  cta: string;
  done: boolean;
}

const countOf = async (query: PromiseLike<{ count: number | null; error: unknown }>) => {
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
};

const storageKey = (userId?: string) => `si.gettingStarted.hidden.${userId || 'anon'}`;

export const GettingStarted: React.FC = () => {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(storageKey(userId)) === '1';
    } catch {
      return false;
    }
  });
  const [steps, setSteps] = useState<Step[] | null>(null);

  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    const head = { count: 'exact' as const, head: true };
    Promise.allSettled([
      countOf(supabase.from('profiles').select('id', head).eq('role', 'field_worker')),
      countOf(supabase.from('customers').select('id', head)),
      countOf(supabase.from('estimates').select('id', head).in('status', ['Sent', 'Approved', 'Rejected'])),
      countOf(supabase.from('jobs').select('id', head)),
      countOf(supabase.from('invoices').select('id', head).in('status', ['Sent', 'Paid', 'Overdue'])),
    ]).then(results => {
      if (cancelled) return;
      // If nothing could be read (e.g. permissions), don't show a checklist that can never complete.
      if (results.every(r => r.status === 'rejected')) {
        setSteps([]);
        return;
      }
      const has = (i: number) => results[i].status === 'fulfilled' && (results[i] as PromiseFulfilledResult<number>).value > 0;
      setSteps([
        {
          key: 'crew',
          title: 'Add your crew',
          description: 'Add the installers so you can put them on jobs and track their hours.',
          to: '/employees',
          cta: 'Add crew',
          done: has(0),
        },
        {
          key: 'contact',
          title: 'Add a customer',
          description: 'Save their name, phone and address once and reuse them everywhere.',
          to: '/contacts?new=1',
          cta: 'Add customer',
          done: has(1),
        },
        {
          key: 'estimate',
          title: 'Send an estimate',
          description: 'Price the job and email it. Customers can approve it online.',
          to: '/estimates/new',
          cta: 'New estimate',
          done: has(2),
        },
        {
          key: 'job',
          title: 'Book a job',
          description: 'Pick a date and crew. It appears on the schedule and the crew’s phone.',
          to: '/scheduling?new=1',
          cta: 'Book job',
          done: has(3),
        },
        {
          key: 'invoice',
          title: 'Send an invoice',
          description: 'Bill the customer when the work is done and record the payment.',
          to: '/invoices/new',
          cta: 'New invoice',
          done: has(4),
        },
      ]);
    });
    return () => {
      cancelled = true;
    };
  }, [hidden]);

  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(storageKey(userId), '1');
    } catch {
      /* storage unavailable — hidden for this visit only */
    }
  };

  if (hidden || !steps || steps.length === 0) return null;
  const doneCount = steps.filter(s => s.done).length;
  if (doneCount === steps.length) return null;
  const nextIndex = steps.findIndex(s => !s.done);

  return (
    <section className="bg-white border border-line rounded-xl shadow-card overflow-hidden" aria-label="Getting started">
      <div className="px-4 md:px-5 pt-4 md:pt-5 pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="m-0 text-base font-semibold text-navy">Get set up</h2>
          <p className="m-0 mt-0.5 text-sm text-muted">Five quick steps to run your first job from start to finish.</p>
        </div>
        <button
          type="button"
          onClick={hide}
          aria-label="Hide checklist"
          title="Hide checklist"
          className="w-9 h-9 -mr-1.5 -mt-1 shrink-0 flex items-center justify-center rounded-lg text-muted hover:text-navy hover:bg-mist border-0 bg-transparent"
        >
          <X size={18} />
        </button>
      </div>

      <div className="px-4 md:px-5 pb-3 flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-mist overflow-hidden">
          <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
        <span className="text-xs font-medium text-muted tabular-nums shrink-0">
          {doneCount} of {steps.length} done
        </span>
      </div>

      <ol className="m-0 p-0 list-none border-t border-line divide-y divide-line">
        {steps.map((s, i) => {
          const isNext = i === nextIndex;
          return (
            <li key={s.key}>
              <Link
                to={s.to}
                className={`flex items-center gap-3 px-4 md:px-5 py-3 no-underline transition-colors ${
                  isNext ? 'bg-brand-soft/50 hover:bg-brand-soft' : 'hover:bg-canvas'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold ${
                    s.done ? 'bg-brand text-navy' : isNext ? 'bg-white border-2 border-brand text-navy' : 'bg-mist text-muted'
                  }`}
                >
                  {s.done ? <Check size={15} strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${s.done ? 'text-muted line-through decoration-line-strong' : 'text-navy'}`}>
                    {s.title}
                  </span>
                  {!s.done && <span className="block text-xs text-muted mt-0.5">{s.description}</span>}
                </span>
                {s.done ? (
                  <span className="text-xs font-medium text-brand-ink shrink-0">Done</span>
                ) : isNext ? (
                  <span className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-brand text-navy text-xs font-semibold shrink-0">
                    {s.cta} <ChevronRight size={14} />
                  </span>
                ) : (
                  <ChevronRight size={16} className="text-subtle shrink-0" />
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
