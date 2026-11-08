import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardList, FileSpreadsheet, Loader2, Search, Users, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { StatusBadge } from '../ui';

interface Results {
  customers: any[];
  jobs: any[];
  invoices: any[];
}

const EMPTY: Results = { customers: [], jobs: [], invoices: [] };

/** Debounced search across contacts, jobs and invoices. */
const useGlobalSearch = (query: string) => {
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (debounced.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    let alive = true;

    const run = async () => {
      setLoading(true);
      try {
        const term = debounced;
        const { data: customerData } = await supabase
          .from('customers')
          .select('id, full_name, email, phone, service_address')
          .or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,service_address.ilike.%${term}%`)
          .limit(5);

        const customers = customerData || [];
        const ids = customers.map((c: any) => c.id);

        let jobsQuery = supabase.from('jobs').select('id, job_number, status, customers(full_name, service_address)');
        if (ids.length > 0) {
          jobsQuery = !isNaN(Number(term))
            ? jobsQuery.or(`job_number.eq.${Number(term)},customer_id.in.(${ids.join(',')})`)
            : jobsQuery.in('customer_id', ids);
        } else if (!isNaN(Number(term))) {
          jobsQuery = jobsQuery.eq('job_number', Number(term));
        } else {
          jobsQuery = jobsQuery.limit(0);
        }
        const { data: jobsData } = await jobsQuery.limit(5);

        let invoicesQuery = supabase.from('invoices').select('id, invoice_number, total, status, customers(full_name)');
        invoicesQuery =
          ids.length > 0
            ? invoicesQuery.or(`invoice_number.ilike.%${term}%,customer_id.in.(${ids.join(',')})`)
            : invoicesQuery.ilike('invoice_number', `%${term}%`);
        const { data: invoicesData } = await invoicesQuery.limit(5);

        if (alive) setResults({ customers, jobs: jobsData || [], invoices: invoicesData || [] });
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        if (alive) setLoading(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [debounced]);

  return { results, loading, ready: debounced.length >= 2 };
};

const ResultGroup: React.FC<{ icon: typeof Users; label: string; children: React.ReactNode }> = ({ icon: Icon, label, children }) => (
  <div className="py-1">
    <div className="px-4 py-1.5 text-2xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
      <Icon size={13} /> {label}
    </div>
    {children}
  </div>
);

const ResultRow: React.FC<{ title: React.ReactNode; meta?: React.ReactNode; right?: React.ReactNode; onClick: () => void }> = ({
  title,
  meta,
  right,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-mist border-0 bg-transparent"
  >
    <div className="min-w-0">
      <div className="text-sm font-medium text-navy truncate">{title}</div>
      {meta && <div className="text-xs text-muted truncate">{meta}</div>}
    </div>
    {right}
  </button>
);

const ResultsList: React.FC<{ query: string; results: Results; loading: boolean; ready: boolean; go: (to: string) => void }> = ({
  query,
  results,
  loading,
  ready,
  go,
}) => {
  if (!ready) {
    return <div className="px-4 py-6 text-sm text-muted text-center">Type at least 2 letters to search contacts, jobs and invoices.</div>;
  }
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted">
        <Loader2 size={16} className="animate-spin text-brand" /> Searching…
      </div>
    );
  }
  const none = !results.customers.length && !results.jobs.length && !results.invoices.length;
  if (none) return <div className="px-4 py-8 text-sm text-muted text-center">No results for "{query}".</div>;

  return (
    <div className="divide-y divide-line">
      {results.customers.length > 0 && (
        <ResultGroup icon={Users} label="Contacts">
          {results.customers.map(c => (
            <ResultRow key={c.id} title={c.full_name} meta={c.email || c.phone || c.service_address} onClick={() => go(`/contacts/${c.id}`)} />
          ))}
        </ResultGroup>
      )}
      {results.jobs.length > 0 && (
        <ResultGroup icon={ClipboardList} label="Jobs">
          {results.jobs.map(j => (
            <ResultRow
              key={j.id}
              title={
                <>
                  Job #{j.job_number}
                  {j.customers?.full_name && <span className="font-normal text-muted"> · {j.customers.full_name}</span>}
                </>
              }
              meta={j.customers?.service_address}
              right={<StatusBadge status={j.status} />}
              onClick={() => go(`/jobs/${j.id}`)}
            />
          ))}
        </ResultGroup>
      )}
      {results.invoices.length > 0 && (
        <ResultGroup icon={FileSpreadsheet} label="Invoices">
          {results.invoices.map(inv => (
            <ResultRow
              key={inv.id}
              title={
                <>
                  Invoice #{inv.invoice_number}
                  {inv.customers?.full_name && <span className="font-normal text-muted"> · {inv.customers.full_name}</span>}
                </>
              }
              meta={`$${Number(inv.total || 0).toFixed(2)}`}
              right={<StatusBadge status={inv.status} />}
              onClick={() => go(`/invoices/${inv.id}`)}
            />
          ))}
        </ResultGroup>
      )}
    </div>
  );
};

/** Desktop: search field in the top bar with a results dropdown. ⌘K / Ctrl+K focuses it. */
export const InlineSearch: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const { results, loading, ready } = useGlobalSearch(query);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      } else if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, []);

  const go = (to: string) => {
    setOpen(false);
    setQuery('');
    navigate(to);
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search contacts, jobs, invoices…"
        className="w-full h-10 pl-9 pr-14 rounded-lg border border-line bg-canvas text-sm text-navy placeholder:text-subtle hover:border-line-strong focus:outline-none focus:bg-white focus:border-brand focus:ring-3 focus:ring-brand/15 transition-colors"
      />
      {query ? (
        <button
          type="button"
          onClick={() => {
            setQuery('');
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md text-muted hover:bg-mist border-0 bg-transparent"
        >
          <X size={14} />
        </button>
      ) : (
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded border border-line bg-white text-2xs font-medium text-muted font-sans pointer-events-none">
          ⌘K
        </kbd>
      )}

      {open && query.trim().length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-line rounded-xl shadow-pop overflow-hidden z-50 max-h-[70vh] overflow-y-auto animate-fade-in">
          <ResultsList query={query} results={results} loading={loading} ready={ready} go={go} />
        </div>
      )}
    </div>
  );
};

/** Phone: full-screen search. */
export const SearchOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const { results, loading, ready } = useGlobalSearch(query);

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  return (
    <div className="fixed inset-0 z-[65] bg-white flex flex-col animate-fade-in">
      <div className="flex items-center gap-2 px-2 h-14 border-b border-line pt-[env(safe-area-inset-top)] box-content">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-navy hover:bg-mist border-0 bg-transparent"
        >
          <ArrowLeft size={20} />
        </button>
        <input
          autoFocus
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search contacts, jobs, invoices…"
          className="flex-1 h-10 px-2 border-0 bg-transparent text-navy placeholder:text-subtle focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="w-10 h-10 flex items-center justify-center rounded-lg text-muted hover:bg-mist border-0 bg-transparent"
          >
            <X size={18} />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <ResultsList query={query} results={results} loading={loading} ready={ready} go={go} />
      </div>
    </div>
  );
};
