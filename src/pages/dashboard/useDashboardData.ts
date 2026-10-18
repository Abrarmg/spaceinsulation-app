import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { calculateMonthlyFinancials } from '../../utils/financials';

export const toLocalDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const addDays = (d: Date, days: number) => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
};

// Jobs are saved with a plain date, which Postgres stores in the timestamptz column as midnight UTC.
// So a calendar day D is the range [D 00:00Z, D+1 00:00Z), where D is the user's local date.
export const jobDayStart = (d: Date) => `${toLocalDateStr(d)}T00:00:00Z`;

const yearMonth = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined);

export interface JobSummary {
  id: string;
  job_number: number;
  status: string;
  scheduled_date: string | null;
  customer_name: string;
  worker_name: string;
}

export interface ClockedInWorker {
  id: string;
  clock_in: string;
  full_name: string;
}

export interface ActivityItem {
  id: string;
  kind: 'job' | 'lead';
  title: string;
  subtitle: string;
  status: string | null;
  link: string;
  time: Date;
}

export interface Summary {
  todayJobs: number;
  inProgressJobs: number;
  quotesPending: number;
  quotesPendingTotal: number;
  overdueInvoices: number;
  unassignedJobs: number;
  uncontactedLeads: number;
  openLeads: number;
  newLeadsThisWeek: number;
  scheduledJobs: number;
  completedJobs: number;
}

export interface MonthPoint {
  label: string;
  revenue: number;
}

export interface Finance {
  revenue: number;
  netProfit: number;
  netProfitHasIncomplete: boolean;
  prevRevenue: number;
  prevNetProfit: number;
  prevMonthLabel: string;
  unpaidTotal: number;
  unpaidCount: number;
  revenueSeries: MonthPoint[];
}

export interface Conversion {
  leads: number;
  quotesSent: number;
  quotesApproved: number;
  invoicesPaid: number;
}

export interface Section<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

type SectionKey = 'summary' | 'schedule' | 'crew' | 'activity' | 'finance' | 'conversion';

const emptySection = <T,>(): Section<T> => ({ data: null, loading: true, error: null });

async function loadSummary(): Promise<Summary> {
  const now = new Date();
  const today = toLocalDateStr(now);
  const weekAgo = addDays(now, -7).toISOString();
  const head = { count: 'exact' as const, head: true };

  const [
    todayRes,
    progressRes,
    sentEstimatesRes,
    overdueRes,
    unassignedRes,
    uncontactedRes,
    openLeadsRes,
    newLeadsRes,
    scheduledRes,
    completedRes,
  ] = await Promise.all([
    supabase.from('jobs').select('*', head).gte('scheduled_date', jobDayStart(now)).lt('scheduled_date', jobDayStart(addDays(now, 1))),
    supabase.from('jobs').select('*', head).eq('status', 'In Progress'),
    supabase.from('estimates').select('total_amount').eq('status', 'Sent'),
    supabase.from('invoices').select('*', head).eq('status', 'Sent').lt('due_date', today),
    // A job can be staffed via assigned_worker_id or job_crew; it's unassigned only if both are empty.
    supabase
      .from('jobs')
      .select('id, job_crew(worker_id)')
      .is('assigned_worker_id', null)
      .in('status', ['Scheduled', 'In Progress']),
    supabase.from('leads').select('*', head).eq('pipeline_stage', 'new_request').or('status.is.null,status.in.(new,New)'),
    supabase.from('leads').select('*', head).or('status.is.null,status.not.in.(approved,lost,Approved,Lost)'),
    supabase.from('leads').select('*', head).gte('received_at', weekAgo),
    supabase.from('jobs').select('*', head).eq('status', 'Scheduled'),
    supabase.from('jobs').select('*', head).eq('status', 'Completed'),
  ]);

  const firstError = [
    todayRes, progressRes, sentEstimatesRes, overdueRes, unassignedRes, uncontactedRes,
    openLeadsRes, newLeadsRes, scheduledRes, completedRes,
  ].find(r => r.error)?.error;
  if (firstError) throw firstError;

  const sentEstimates = sentEstimatesRes.data || [];
  return {
    todayJobs: todayRes.count || 0,
    inProgressJobs: progressRes.count || 0,
    quotesPending: sentEstimates.length,
    quotesPendingTotal: sentEstimates.reduce((sum, e) => sum + Number(e.total_amount || 0), 0),
    overdueInvoices: overdueRes.count || 0,
    unassignedJobs: (unassignedRes.data || []).filter((j: any) => !j.job_crew || j.job_crew.length === 0).length,
    uncontactedLeads: uncontactedRes.count || 0,
    openLeads: openLeadsRes.count || 0,
    newLeadsThisWeek: newLeadsRes.count || 0,
    scheduledJobs: scheduledRes.count || 0,
    completedJobs: completedRes.count || 0,
  };
}

const mapJob = (j: any): JobSummary => ({
  id: j.id,
  job_number: j.job_number,
  status: j.status,
  scheduled_date: j.scheduled_date,
  customer_name: one(j.customers)?.full_name || 'Unknown Client',
  worker_name: one(j.profiles)?.full_name || 'Unassigned',
});

async function loadSchedule(): Promise<{ today: JobSummary[]; upcoming: JobSummary[] }> {
  const now = new Date();
  const select = 'id, job_number, status, scheduled_date, customers(full_name), profiles:assigned_worker_id(full_name)';

  const [todayRes, upcomingRes] = await Promise.all([
    supabase
      .from('jobs')
      .select(select)
      .gte('scheduled_date', jobDayStart(now))
      .lt('scheduled_date', jobDayStart(addDays(now, 1)))
      .order('scheduled_date'),
    supabase
      .from('jobs')
      .select(select)
      .gte('scheduled_date', jobDayStart(addDays(now, 1)))
      .lt('scheduled_date', jobDayStart(addDays(now, 6)))
      .order('scheduled_date'),
  ]);
  if (todayRes.error) throw todayRes.error;
  if (upcomingRes.error) throw upcomingRes.error;

  return { today: (todayRes.data || []).map(mapJob), upcoming: (upcomingRes.data || []).map(mapJob) };
}

async function loadCrew(): Promise<{ clockedIn: ClockedInWorker[]; workersTotal: number }> {
  const [clockedRes, workersRes] = await Promise.all([
    supabase.from('time_entries').select('id, clock_in, profiles:worker_id(full_name)').is('clock_out', null),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'field_worker'),
  ]);
  if (clockedRes.error) throw clockedRes.error;

  return {
    clockedIn: (clockedRes.data || []).map((c: any) => ({
      id: c.id,
      clock_in: c.clock_in,
      full_name: one(c.profiles)?.full_name || 'Worker',
    })),
    workersTotal: workersRes.count || 0,
  };
}

async function loadActivity(): Promise<ActivityItem[]> {
  const [jobsRes, leadsRes] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, job_number, status, created_at, customers(full_name)')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('leads')
      .select('id, name, source, status, received_at, created_at')
      .order('received_at', { ascending: false })
      .limit(8),
  ]);
  if (jobsRes.error) throw jobsRes.error;

  const items: ActivityItem[] = [
    ...(jobsRes.data || []).map((j: any) => ({
      id: `job-${j.id}`,
      kind: 'job' as const,
      title: `JOB-${j.job_number} created`,
      subtitle: one<any>(j.customers)?.full_name || 'Client',
      status: j.status,
      link: `/jobs/${j.id}`,
      time: new Date(j.created_at),
    })),
    ...(leadsRes.data || []).map((l: any) => ({
      id: `lead-${l.id}`,
      kind: 'lead' as const,
      title: 'New lead received',
      subtitle: `${l.name || 'Unknown'}${l.source ? ` · ${l.source}` : ''}`,
      status: l.status || 'New',
      link: `/leads/${l.id}`,
      time: new Date(l.received_at || l.created_at),
    })),
  ];
  return items.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 8);
}

async function loadFinance(): Promise<Finance> {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const seriesStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [current, previous, paidRes, unpaidRes] = await Promise.all([
    calculateMonthlyFinancials(yearMonth(now)),
    calculateMonthlyFinancials(yearMonth(prev)),
    supabase.from('invoices').select('total, paid_at').eq('status', 'Paid').gte('paid_at', seriesStart.toISOString()),
    supabase.from('invoices').select('total').eq('status', 'Sent'),
  ]);
  if (paidRes.error) throw paidRes.error;

  const buckets = new Map<string, MonthPoint>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.set(yearMonth(d), { label: d.toLocaleDateString(undefined, { month: 'short' }), revenue: 0 });
  }
  for (const inv of paidRes.data || []) {
    const bucket = buckets.get(yearMonth(new Date(inv.paid_at)));
    if (bucket) bucket.revenue += Number(inv.total || 0);
  }

  const unpaid = unpaidRes.data || [];
  return {
    revenue: current.revenue,
    netProfit: current.netProfit,
    netProfitHasIncomplete: current.hasIncompleteEntries,
    prevRevenue: previous.revenue,
    prevNetProfit: previous.netProfit,
    prevMonthLabel: prev.toLocaleDateString(undefined, { month: 'long' }),
    unpaidTotal: unpaid.reduce((sum, i) => sum + Number(i.total || 0), 0),
    unpaidCount: unpaid.length,
    revenueSeries: [...buckets.values()],
  };
}

async function loadConversion(): Promise<Conversion> {
  const since = addDays(new Date(), -90).toISOString();
  const head = { count: 'exact' as const, head: true };
  const [leads, sent, approved, paid] = await Promise.all([
    supabase.from('leads').select('*', head).gte('received_at', since),
    supabase.from('estimates').select('*', head).gte('sent_at', since),
    supabase.from('estimates').select('*', head).gte('approved_at', since),
    supabase.from('invoices').select('*', head).eq('status', 'Paid').gte('paid_at', since),
  ]);
  return {
    leads: leads.count || 0,
    quotesSent: sent.count || 0,
    quotesApproved: approved.count || 0,
    invoicesPaid: paid.count || 0,
  };
}

const LOADERS: Record<SectionKey, () => Promise<unknown>> = {
  summary: loadSummary,
  schedule: loadSchedule,
  crew: loadCrew,
  activity: loadActivity,
  finance: loadFinance,
  conversion: loadConversion,
};

const TABLE_SECTIONS: Record<string, SectionKey[]> = {
  jobs: ['summary', 'schedule', 'activity'],
  job_crew: ['summary'],
  leads: ['summary', 'activity', 'conversion'],
  estimates: ['summary', 'conversion'],
  invoices: ['summary', 'finance', 'conversion'],
  time_entries: ['crew', 'finance'],
  expenses: ['finance'],
};

const ALL_SECTIONS = Object.keys(LOADERS) as SectionKey[];
const FALLBACK_REFRESH_MS = 5 * 60 * 1000;

export function useDashboardData(enabled: boolean) {
  const [sections, setSections] = useState<Record<SectionKey, Section<any>>>(() =>
    Object.fromEntries(ALL_SECTIONS.map(k => [k, emptySection()])) as Record<SectionKey, Section<any>>
  );
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async (keys: SectionKey[]) => {
    await Promise.all(
      keys.map(async key => {
        try {
          const data = await LOADERS[key]();
          if (mounted.current) setSections(s => ({ ...s, [key]: { data, loading: false, error: null } }));
        } catch (err: any) {
          console.error(`Dashboard section "${key}" failed:`, err);
          if (mounted.current) {
            setSections(s => ({ ...s, [key]: { ...s[key], loading: false, error: err?.message || 'Failed to load' } }));
          }
        }
      })
    );
    if (mounted.current) setLastUpdated(new Date());
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await load(ALL_SECTIONS);
    if (mounted.current) setRefreshing(false);
  }, [load]);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) return;
    load(ALL_SECTIONS);

    // Coalesce bursts of DB changes into one reload per affected section.
    const pending = new Set<SectionKey>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const queue = (keys: SectionKey[]) => {
      keys.forEach(k => pending.add(k));
      clearTimeout(timer);
      timer = setTimeout(() => {
        const batch = [...pending];
        pending.clear();
        load(batch);
      }, 800);
    };

    let channel = supabase.channel('dashboard-live');
    for (const table of Object.keys(TABLE_SECTIONS)) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () =>
        queue(TABLE_SECTIONS[table])
      );
    }
    channel.subscribe();

    // Realtime only fires for tables in the supabase_realtime publication, so also refresh periodically and on focus.
    const interval = setInterval(() => queue(ALL_SECTIONS), FALLBACK_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') queue(ALL_SECTIONS);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      mounted.current = false;
      clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [enabled, load]);

  return {
    summary: sections.summary as Section<Summary>,
    schedule: sections.schedule as Section<{ today: JobSummary[]; upcoming: JobSummary[] }>,
    crew: sections.crew as Section<{ clockedIn: ClockedInWorker[]; workersTotal: number }>,
    activity: sections.activity as Section<ActivityItem[]>,
    finance: sections.finance as Section<Finance>,
    conversion: sections.conversion as Section<Conversion>,
    lastUpdated,
    refreshing,
    refreshAll,
  };
}
