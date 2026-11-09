import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CalendarPlus,
  CheckCheck,
  ChevronRight,
  Clock,
  Inbox,
  Mail,
  MessageSquare,
  MoreVertical,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  X,
  XCircle,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { AddLeadModal } from '../components/AddLeadModal';
import { ScheduleAssessmentModal } from '../components/ScheduleAssessmentModal';
import { Button, ButtonLink, EmptyState, Page, PageHeader } from '../components/ui';
import { Avatar, ListLoading, ListPanel, MobileRow, SearchInput, StatusTabs, T } from '../components/ui/list';

interface Lead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string | null;
  pipeline_stage: string | null;
  received_at: string | null;
  created_at: string;
}

const PAGE_SIZE = 100;
const RESPONSE_TARGET_MS = 60 * 60 * 1000;

const STAGES: Record<string, { label: string; className: string }> = {
  new_request: { label: 'New request', className: 'bg-purple-50 text-purple-700' },
  assessment_unscheduled: { label: 'Assessment needed', className: 'bg-amber-50 text-amber-700' },
  assessment_scheduled: { label: 'Assessment booked', className: 'bg-blue-50 text-blue-700' },
  assessment_completed: { label: 'Assessment done', className: 'bg-blue-50 text-blue-700' },
  quote_draft: { label: 'Quote draft', className: 'bg-sky-50 text-sky-700' },
  awaiting_response: { label: 'Quote sent', className: 'bg-sky-50 text-sky-700' },
  changes_requested: { label: 'Changes requested', className: 'bg-orange-50 text-orange-700' },
  won: { label: 'Won', className: 'bg-brand-soft text-brand-ink' },
};

const LOST_STATUSES = ['lost', 'Lost'];
const NOT_LOST = 'status.is.null,status.not.in.(lost,Lost)';

type TabId = 'all' | 'new' | 'assessment' | 'quote' | 'won' | 'lost';

const TABS: { id: TabId; label: string; stages?: string[] }[] = [
  { id: 'all', label: 'Open' },
  { id: 'new', label: 'New', stages: ['new_request'] },
  { id: 'assessment', label: 'Assessment', stages: ['assessment_unscheduled', 'assessment_scheduled', 'assessment_completed'] },
  { id: 'quote', label: 'Quote', stages: ['quote_draft', 'awaiting_response', 'changes_requested'] },
  { id: 'won', label: 'Won', stages: ['won'] },
  { id: 'lost', label: 'Lost' },
];

const isTab = (v: string | null): v is TabId => TABS.some(t => t.id === v);

// Builds the filtered leads query for a tab + search, shared by list and count queries.
function scopedQuery(tab: TabId, search: string, select: string, head = false) {
  let q = supabase.from('leads').select(select, { count: 'exact', head });
  const def = TABS.find(t => t.id === tab)!;
  if (tab === 'lost') q = q.in('status', LOST_STATUSES);
  else {
    q = q.or(NOT_LOST);
    if (def.stages) q = q.in('pipeline_stage', def.stages);
  }
  const term = search.replace(/[,()%*\\]/g, ' ').trim();
  if (term) q = q.or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
  return q;
}

const isLost = (l: Lead) => LOST_STATUSES.includes(l.status || '');
const needsResponse = (l: Lead) =>
  !isLost(l) && (l.pipeline_stage || 'new_request') === 'new_request' && (!l.status || l.status.toLowerCase() === 'new');

const ago = (iso: string | null) => {
  if (!iso) return '—';
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
};

const fullDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '');

const StageBadge: React.FC<{ lead: Lead }> = ({ lead }) => {
  if (isLost(lead)) {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-2xs font-semibold bg-red-50 text-red-700">Lost</span>;
  }
  const stage = STAGES[lead.pipeline_stage || 'new_request'] || { label: lead.pipeline_stage, className: 'bg-mist text-ink-soft' };
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-semibold whitespace-nowrap ${stage.className}`}>{stage.label}</span>;
};

const ResponseTimer: React.FC<{ lead: Lead }> = ({ lead }) => {
  const received = lead.received_at || lead.created_at;
  if (!needsResponse(lead)) {
    return <span className="text-ink-soft" title={fullDate(received)}>{ago(received)}</span>;
  }
  const overdue = Date.now() - new Date(received).getTime() > RESPONSE_TARGET_MS;
  return (
    <span
      title={`Received ${fullDate(received)} — not contacted yet`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold whitespace-nowrap ${
        overdue ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      <Clock size={11} />
      {overdue ? `No reply · ${ago(received).replace(' ago', '')}` : `Reply now · ${ago(received)}`}
    </span>
  );
};

const SourceLabel: React.FC<{ source: string | null }> = ({ source }) =>
  source?.toLowerCase() === 'facebook' ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-[#1877F2]/10 text-[#1877F2]">Facebook</span>
  ) : (
    <span className="text-xs text-ink-soft capitalize">{source || '—'}</span>
  );

const iconBtn =
  'inline-flex items-center justify-center w-9 h-9 rounded-lg border border-line bg-white text-muted hover:text-navy hover:bg-mist transition-colors';

export const Leads: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: TabId = isTab(searchParams.get('tab')) ? (searchParams.get('tab') as TabId) : 'all';

  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [tabCounts, setTabCounts] = useState<Partial<Record<TabId, number>>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuId, setMenuId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [scheduleLead, setScheduleLead] = useState<Lead | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Keeps the "x min ago" response timers current.
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const close = () => setMenuId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [listRes, ...countRes] = await Promise.all([
      scopedQuery(tab, search, '*').order('received_at', { ascending: false, nullsFirst: false }).range(0, PAGE_SIZE - 1),
      ...TABS.map(t => scopedQuery(t.id, search, '*', true)),
    ]);
    if (listRes.error) {
      setError(listRes.error.message);
    } else {
      setLeads((listRes.data as unknown as Lead[]) || []);
      setTotal(listRes.count ?? 0);
      setTabCounts(Object.fromEntries(TABS.map((t, i) => [t.id, countRes[i].count ?? 0])));
    }
    setSelected(new Set());
    setLoading(false);
  }, [tab, search]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const loadMore = async () => {
    setLoadingMore(true);
    const { data, error: err } = await scopedQuery(tab, search, '*')
      .order('received_at', { ascending: false, nullsFirst: false })
      .range(leads.length, leads.length + PAGE_SIZE - 1);
    if (err) setError(err.message);
    else setLeads(prev => [...prev, ...((data as unknown as Lead[]) || [])]);
    setLoadingMore(false);
  };

  const updateLeads = async (ids: string[], patch: Partial<Lead>, message: string) => {
    if (!ids.length) return;
    setBusy(true);
    const { error: err } = await supabase
      .from('leads')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .in('id', ids);
    setBusy(false);
    if (err) {
      setToast(`Update failed: ${err.message}`);
      return;
    }
    setToast(message);
    fetchLeads();
  };

  const markLost = (ids: string[]) => {
    if (!confirm(ids.length === 1 ? 'Mark this lead as lost?' : `Mark ${ids.length} leads as lost?`)) return;
    updateLeads(ids, { status: 'lost' }, ids.length === 1 ? 'Lead marked as lost' : `${ids.length} leads marked as lost`);
  };
  const markContacted = (ids: string[]) =>
    updateLeads(ids, { status: 'contacted' }, ids.length === 1 ? 'Marked as contacted' : `${ids.length} leads marked as contacted`);
  const reopen = (ids: string[]) =>
    updateLeads(ids, { status: 'contacted' }, ids.length === 1 ? 'Lead reopened' : `${ids.length} leads reopened`);
  const moveToStage = (ids: string[], stage: string) =>
    updateLeads(ids, { pipeline_stage: stage }, `Moved ${ids.length} ${ids.length === 1 ? 'lead' : 'leads'} to ${STAGES[stage].label}`);

  const setTab = (id: TabId) => {
    const next = new URLSearchParams(searchParams);
    if (id === 'all') next.delete('tab');
    else next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = leads.length > 0 && leads.every(l => selected.has(l.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(leads.map(l => l.id)));
  const selectedIds = [...selected];
  const overdueCount = leads.filter(
    l => needsResponse(l) && Date.now() - new Date(l.received_at || l.created_at).getTime() > RESPONSE_TARGET_MS
  ).length;

  const quickContact = (lead: Lead) => (
    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
      {lead.phone ? (
        <>
          <a href={`tel:${lead.phone}`} className={iconBtn} title={`Call ${lead.phone}`}><Phone size={14} /></a>
          <a href={`sms:${lead.phone}`} className={iconBtn} title={`Text ${lead.phone}`}><MessageSquare size={14} /></a>
        </>
      ) : null}
      {lead.email ? (
        <a href={`mailto:${lead.email}`} className={iconBtn} title={`Email ${lead.email}`}><Mail size={14} /></a>
      ) : null}
    </div>
  );

  const rowMenu = (lead: Lead) => {
    const item = 'w-full text-left px-3 h-9 rounded-lg text-sm text-navy hover:bg-mist flex items-center gap-2.5 cursor-pointer border-0 bg-transparent';
    return (
      <div className="relative" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={() => setMenuId(menuId === lead.id ? null : lead.id)} className={iconBtn} title="More actions">
          <MoreVertical size={14} />
        </button>
        {menuId === lead.id && (
          <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-pop border border-line p-1 z-30">
            <button type="button" className={item} onClick={() => { setMenuId(null); navigate(`/leads/${lead.id}`); }}>
              <ChevronRight size={14} className="text-muted" /> View lead
            </button>
            {!isLost(lead) && (
              <button type="button" className={item} onClick={() => { setMenuId(null); setScheduleLead(lead); }}>
                <CalendarPlus size={14} className="text-indigo-600" /> Schedule assessment
              </button>
            )}
            {needsResponse(lead) && (
              <button type="button" className={item} onClick={() => { setMenuId(null); markContacted([lead.id]); }}>
                <CheckCheck size={14} className="text-[#16A34A]" /> Mark contacted
              </button>
            )}
            {isLost(lead) ? (
              <button type="button" className={item} onClick={() => { setMenuId(null); reopen([lead.id]); }}>
                <RotateCcw size={14} className="text-muted" /> Reopen lead
              </button>
            ) : (
              <button type="button" className={`${item} text-red-600`} onClick={() => { setMenuId(null); markLost([lead.id]); }}>
                <XCircle size={14} /> Mark as lost
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Page>
      <PageHeader
        title="Leads"
        subtitle={
          overdueCount > 0 ? (
            <span className="text-red-700 font-medium">{overdueCount} waiting over an hour for a reply</span>
          ) : (
            'New enquiries from Facebook, your website and calls.'
          )
        }
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={fetchLeads} disabled={loading} aria-label="Refresh">
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button icon={Plus} onClick={() => setAddOpen(true)}>
              Add lead
            </Button>
          </>
        }
      />

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-16 z-20 bg-navy text-white rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-2 shadow-pop">
          <span className="text-sm font-semibold mr-auto">{selectedIds.length} selected</span>
          <select
            disabled={busy}
            value=""
            onChange={e => e.target.value && moveToStage(selectedIds, e.target.value)}
            className="h-9 bg-white/10 border border-white/20 rounded-lg text-sm px-2.5 cursor-pointer text-white"
          >
            <option value="" className="text-navy">Move to stage…</option>
            {Object.entries(STAGES).map(([id, st]) => (
              <option key={id} value={id} className="text-navy">{st.label}</option>
            ))}
          </select>
          {tab === 'lost' ? (
            <button type="button" disabled={busy} onClick={() => reopen(selectedIds)} className="h-9 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium border-0 text-white">
              Reopen
            </button>
          ) : (
            <>
              <button type="button" disabled={busy} onClick={() => markContacted(selectedIds)} className="h-9 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium border-0 text-white">
                Mark contacted
              </button>
              <button type="button" disabled={busy} onClick={() => markLost(selectedIds)} className="h-9 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-sm font-medium border-0 text-white">
                Mark lost
              </button>
            </>
          )}
          <button type="button" onClick={() => setSelected(new Set())} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 border-0 bg-transparent text-white" title="Clear selection">
            <X size={16} />
          </button>
        </div>
      )}

      <ListPanel
        tabs={<StatusTabs tabs={TABS.map(t => ({ value: t.id, label: t.label, count: tabCounts[t.id] ?? '…' }))} value={tab} onChange={setTab} />}
        toolbar={<SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search leads by name, phone or email" />}
        footer={
          leads.length > 0 && leads.length < total ? (
            <div className="flex justify-center">
              <Button variant="secondary" size="sm" onClick={loadMore} loading={loadingMore}>
                Load more ({leads.length} of {total})
              </Button>
            </div>
          ) : undefined
        }
      >
        {loading && leads.length === 0 ? (
          <ListLoading label="Loading leads…" />
        ) : error ? (
          <EmptyState
            icon={AlertCircle}
            title="Couldn't load leads"
            description={error}
            action={<Button variant="secondary" onClick={fetchLeads}>Try again</Button>}
          />
        ) : leads.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={search ? 'No leads found' : 'No leads here yet'}
            description={
              search
                ? `Nothing matches "${search}".`
                : 'A lead is someone asking for a quote. Facebook and website enquiries arrive here on their own — add one by hand when someone calls.'
            }
            action={
              !search && (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button icon={Plus} onClick={() => setAddOpen(true)}>
                    Add lead
                  </Button>
                  <ButtonLink to="/settings" variant="secondary">
                    Connect Facebook
                  </ButtonLink>
                </div>
              )
            }
          />
        ) : (
          <>
            <div className={T.wrap}>
              <table className={T.table}>
                <thead className={T.thead}>
                  <tr>
                    <th className={`${T.th} w-10 pr-0`}>
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-[#76C442] cursor-pointer" aria-label="Select all" />
                    </th>
                    <th className={T.th}>Lead</th>
                    <th className={T.th}>Stage</th>
                    <th className={`${T.th} hidden lg:table-cell`}>Source</th>
                    <th className={T.th}>Received</th>
                    <th className={`${T.th} text-right`}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map(lead => (
                    <tr
                      key={lead.id}
                      onClick={() => navigate(`/leads/${lead.id}`)}
                      className={`${T.tr} ${selected.has(lead.id) ? 'bg-brand-soft/60' : ''}`}
                    >
                      <td className={`${T.td} pr-0`} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggle(lead.id)} className="w-4 h-4 accent-[#76C442] cursor-pointer" aria-label={`Select ${lead.name || 'lead'}`} />
                      </td>
                      <td className={T.td}>
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={lead.name} />
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{lead.name?.trim() || 'Unknown lead'}</div>
                            <div className="text-xs text-muted truncate max-w-[260px]">
                              {[lead.phone, lead.email].filter(Boolean).join(' · ') || 'No contact details'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={T.td}><StageBadge lead={lead} /></td>
                      <td className={`${T.td} hidden lg:table-cell`}><SourceLabel source={lead.source} /></td>
                      <td className={`${T.td} whitespace-nowrap text-xs`}><ResponseTimer lead={lead} /></td>
                      <td className={T.td}>
                        <div className="flex items-center justify-end gap-1.5">
                          {quickContact(lead)}
                          {rowMenu(lead)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone */}
            <div className="md:hidden divide-y divide-line">
              <label className="flex items-center gap-2.5 px-4 py-2.5 bg-canvas text-xs font-medium text-muted">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-[#76C442]" />
                Select all
              </label>
              {leads.map(lead => (
                <div key={lead.id} className={selected.has(lead.id) ? 'bg-brand-soft/60' : 'bg-white'}>
                  <MobileRow
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    selected={selected.has(lead.id)}
                    leading={
                      <input
                        type="checkbox"
                        checked={selected.has(lead.id)}
                        onChange={() => toggle(lead.id)}
                        onClick={e => e.stopPropagation()}
                        className="w-4 h-4 mt-1 accent-[#76C442] shrink-0"
                        aria-label={`Select ${lead.name || 'lead'}`}
                      />
                    }
                    title={lead.name?.trim() || 'Unknown lead'}
                    subtitle={[lead.phone, lead.email].filter(Boolean).join(' · ') || 'No contact details'}
                    right={<StageBadge lead={lead} />}
                    meta={
                      <>
                        <SourceLabel source={lead.source} />
                        <ResponseTimer lead={lead} />
                      </>
                    }
                  />
                  <div className="flex items-center gap-2 px-4 pb-3 pl-11 -mt-1">
                    {quickContact(lead)}
                    <div className="ml-auto">{rowMenu(lead)}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </ListPanel>

      {toast && (
        <div className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-navy text-white text-xs font-bold px-4 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      <AddLeadModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={id => {
          setAddOpen(false);
          navigate(`/leads/${id}`);
        }}
      />

      {scheduleLead && (
        <ScheduleAssessmentModal
          isOpen
          onClose={() => setScheduleLead(null)}
          lead={{ id: scheduleLead.id, name: scheduleLead.name, phone: scheduleLead.phone }}
          onSuccess={() => {
            setScheduleLead(null);
            setToast('Assessment scheduled');
            fetchLeads();
          }}
        />
      )}
    </Page>
  );
};
