import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CalendarPlus,
  CheckCheck,
  ChevronRight,
  Clock,
  Inbox,
  Loader2,
  Mail,
  MessageSquare,
  MoreVertical,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { AddLeadModal } from '../components/AddLeadModal';
import { ScheduleAssessmentModal } from '../components/ScheduleAssessmentModal';

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
  new_request: { label: 'New request', className: 'bg-[#22C55E]/10 text-[#16A34A] border-[#22C55E]/30' },
  assessment_unscheduled: { label: 'Assessment needed', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  assessment_scheduled: { label: 'Assessment booked', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  assessment_completed: { label: 'Assessment done', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  quote_draft: { label: 'Quote draft', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  awaiting_response: { label: 'Quote sent', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  changes_requested: { label: 'Changes requested', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  won: { label: 'Won', className: 'bg-emerald-600 text-white border-emerald-600' },
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

const initials = (name: string | null) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const StageBadge: React.FC<{ lead: Lead }> = ({ lead }) => {
  if (isLost(lead)) {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border bg-red-50 text-red-700 border-red-200">Lost</span>;
  }
  const stage = STAGES[lead.pipeline_stage || 'new_request'] || { label: lead.pipeline_stage, className: 'bg-gray-100 text-gray-700 border-gray-200' };
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${stage.className}`}>{stage.label}</span>;
};

const ResponseTimer: React.FC<{ lead: Lead }> = ({ lead }) => {
  const received = lead.received_at || lead.created_at;
  if (!needsResponse(lead)) {
    return <span className="text-slate-600 font-medium" title={fullDate(received)}>{ago(received)}</span>;
  }
  const overdue = Date.now() - new Date(received).getTime() > RESPONSE_TARGET_MS;
  return (
    <span
      title={`Received ${fullDate(received)} — not contacted yet`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border whitespace-nowrap ${
        overdue ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'
      }`}
    >
      <Clock size={11} />
      {overdue ? `No reply · ${ago(received).replace(' ago', '')}` : `Reply now · ${ago(received)}`}
    </span>
  );
};

const SourceLabel: React.FC<{ source: string | null }> = ({ source }) =>
  source?.toLowerCase() === 'facebook' ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20">Facebook</span>
  ) : (
    <span className="text-xs font-semibold text-slate-600 capitalize">{source || '—'}</span>
  );

const iconBtn =
  'inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#E7E9ED] bg-white text-[#737A86] hover:text-[#151A2D] hover:bg-[#F6F7F9] transition-colors';

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
    const item = 'w-full text-left px-3.5 py-2 text-xs font-bold text-[#151A2D] hover:bg-[#F6F7F9] flex items-center gap-2 cursor-pointer';
    return (
      <div className="relative" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={() => setMenuId(menuId === lead.id ? null : lead.id)} className={iconBtn} title="More actions">
          <MoreVertical size={14} />
        </button>
        {menuId === lead.id && (
          <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-[#E7E9ED] py-1.5 z-30">
            <button type="button" className={item} onClick={() => { setMenuId(null); navigate(`/leads/${lead.id}`); }}>
              <ChevronRight size={14} className="text-[#737A86]" /> View lead
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
                <RotateCcw size={14} className="text-[#737A86]" /> Reopen lead
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
    <div className="flex flex-col min-h-[calc(100vh-64px)] bg-[#F5F5F5] pb-24">
      {/* Header */}
      <div className="bg-white border-b border-[#E7E9ED] px-4 md:px-8 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#151A2D] flex items-center justify-center shrink-0">
              <Inbox size={20} className="text-[#76C442]" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-[#151A2D] tracking-tight uppercase m-0">Leads</h1>
              <p className="text-xs text-[#737A86] mt-0.5 font-medium">
                {overdueCount > 0 ? (
                  <span className="text-red-600 font-bold">{overdueCount} waiting over an hour for a reply</span>
                ) : (
                  'Manage and follow up with incoming leads.'
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchLeads}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-[#E7E9ED] hover:bg-[#F6F7F9] text-xs font-bold text-[#151A2D] cursor-pointer disabled:opacity-60"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#7CC242] hover:bg-[#6ab331] text-white text-xs font-bold cursor-pointer shadow-sm"
            >
              <Plus size={15} /> Add Lead
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full px-4 md:px-8 pt-6 space-y-4">
        {/* Tabs + search */}
        <div className="bg-white p-3.5 rounded-xl border border-[#E7E9ED] space-y-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {TABS.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  tab === t.id ? 'bg-[#151A2D] text-white' : 'text-[#737A86] hover:bg-[#F6F7F9]'
                }`}
              >
                {t.label}
                <span className={`px-1.5 rounded-full text-[10px] ${tab === t.id ? 'bg-white/20' : 'bg-gray-100'}`}>
                  {tabCounts[t.id] ?? '…'}
                </span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737A86]" size={16} />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search all leads by name, phone, or email…"
              className="w-full pl-9 pr-9 py-2.5 border border-[#E6E8EC] focus:border-[#76C442] focus:ring-2 focus:ring-[#76C442]/10 rounded-lg text-xs bg-[#F7F8FA] focus:outline-none font-medium"
            />
            {searchInput && (
              <button type="button" onClick={() => setSearchInput('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#737A86] cursor-pointer">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.length > 0 && (
          <div className="sticky top-2 z-20 bg-[#151A2D] text-white rounded-xl px-4 py-3 flex flex-wrap items-center gap-2 shadow-lg">
            <span className="text-xs font-black mr-auto">{selectedIds.length} selected</span>
            <select
              disabled={busy}
              value=""
              onChange={e => e.target.value && moveToStage(selectedIds, e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg text-xs font-bold px-2.5 py-2 cursor-pointer"
            >
              <option value="" className="text-[#151A2D]">Move to stage…</option>
              {Object.entries(STAGES).map(([id, s]) => (
                <option key={id} value={id} className="text-[#151A2D]">{s.label}</option>
              ))}
            </select>
            {tab === 'lost' ? (
              <button type="button" disabled={busy} onClick={() => reopen(selectedIds)} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold cursor-pointer">
                Reopen
              </button>
            ) : (
              <>
                <button type="button" disabled={busy} onClick={() => markContacted(selectedIds)} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold cursor-pointer">
                  Mark contacted
                </button>
                <button type="button" disabled={busy} onClick={() => markLost(selectedIds)} className="px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-xs font-bold cursor-pointer">
                  Mark lost
                </button>
              </>
            )}
            <button type="button" onClick={() => setSelected(new Set())} className="p-2 rounded-lg hover:bg-white/10 cursor-pointer" title="Clear selection">
              <X size={14} />
            </button>
          </div>
        )}

        {/* List */}
        <div className="bg-white rounded-xl border border-[#E7E9ED] overflow-hidden">
          {loading && leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#737A86]">
              <Loader2 className="w-8 h-8 animate-spin text-[#76C442]" />
              <span className="text-xs font-bold uppercase tracking-wider">Loading leads…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-red-500">
              <AlertCircle className="w-9 h-9" />
              <span className="text-xs font-bold">{error}</span>
              <button type="button" onClick={fetchLeads} className="text-xs bg-[#151A2D] text-white px-4 py-2 rounded-lg font-bold cursor-pointer">
                Retry
              </button>
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <Inbox className="w-12 h-12 text-[#737A86]/40 mb-3" />
              <h3 className="text-sm font-bold text-[#171A1F] m-0">No leads found</h3>
              <p className="text-xs text-[#737A86] mt-1">
                {search ? `Nothing matches "${search}".` : 'Leads from Facebook, your website, or added by hand will appear here.'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E7E9ED] bg-[#F9FAFB] text-[10px] font-black uppercase tracking-wider text-[#737A86]">
                      <th className="py-3 pl-4 w-8">
                        <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-[#151A2D] cursor-pointer" aria-label="Select all" />
                      </th>
                      <th className="py-3 px-4">Lead</th>
                      <th className="py-3 px-4">Stage</th>
                      <th className="py-3 px-4">Source</th>
                      <th className="py-3 px-4">Received</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E9ED] text-xs">
                    {leads.map(lead => (
                      <tr
                        key={lead.id}
                        onClick={() => navigate(`/leads/${lead.id}`)}
                        className={`cursor-pointer transition-colors ${selected.has(lead.id) ? 'bg-[#F0FDF4]' : 'hover:bg-[#F9FAFB]'}`}
                      >
                        <td className="py-3 pl-4" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggle(lead.id)} className="w-4 h-4 accent-[#151A2D] cursor-pointer" aria-label={`Select ${lead.name || 'lead'}`} />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-[#151A2D] text-white flex items-center justify-center text-[11px] font-black shrink-0">
                              {initials(lead.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-[#151A2D] truncate">{lead.name?.trim() || 'Unknown lead'}</div>
                              <div className="text-[11px] text-[#737A86] truncate max-w-[260px]">
                                {[lead.phone, lead.email].filter(Boolean).join(' · ') || 'No contact details'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4"><StageBadge lead={lead} /></td>
                        <td className="py-3 px-4"><SourceLabel source={lead.source} /></td>
                        <td className="py-3 px-4 whitespace-nowrap"><ResponseTimer lead={lead} /></td>
                        <td className="py-3 px-4">
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

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-[#E7E9ED]">
                <label className="flex items-center gap-2 px-4 py-2.5 bg-[#F9FAFB] text-[11px] font-bold text-[#737A86]">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-[#151A2D]" />
                  Select all
                </label>
                {leads.map(lead => (
                  <div
                    key={lead.id}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    className={`p-4 space-y-3 cursor-pointer ${selected.has(lead.id) ? 'bg-[#F0FDF4]' : 'active:bg-[#F0F2F5]'}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected.has(lead.id)}
                        onChange={() => toggle(lead.id)}
                        onClick={e => e.stopPropagation()}
                        className="w-4 h-4 mt-1 accent-[#151A2D] shrink-0"
                        aria-label={`Select ${lead.name || 'lead'}`}
                      />
                      <div className="min-w-0 flex-grow">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm text-[#151A2D] truncate">{lead.name?.trim() || 'Unknown lead'}</span>
                          <StageBadge lead={lead} />
                        </div>
                        <div className="text-[11px] text-[#737A86] truncate mt-0.5">
                          {[lead.phone, lead.email].filter(Boolean).join(' · ') || 'No contact details'}
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-[11px]">
                          <SourceLabel source={lead.source} />
                          <ResponseTimer lead={lead} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pl-7">
                      {quickContact(lead)}
                      {rowMenu(lead)}
                    </div>
                  </div>
                ))}
              </div>

              {leads.length < total && (
                <div className="p-4 flex justify-center border-t border-[#E7E9ED]">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#151A2D] text-white disabled:opacity-60 cursor-pointer"
                  >
                    {loadingMore && <Loader2 size={14} className="animate-spin" />}
                    Load more ({leads.length} of {total})
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#151A2D] text-white text-xs font-bold px-4 py-3 rounded-xl shadow-lg">
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
    </div>
  );
};
