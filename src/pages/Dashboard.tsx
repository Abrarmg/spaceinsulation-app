import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle,
  BarChart3,
  Calendar as CalendarIcon,
  CalendarPlus,
  CheckCircle2,
  Clock,
  DollarSign,
  FilePlus2,
  FileText,
  Filter,
  HardHat,
  Inbox,
  Plus,
  Receipt,
  RefreshCw,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDashboardData } from './dashboard/useDashboardData';
import type { Conversion, Finance } from './dashboard/useDashboardData';
import { Panel, SectionError, Skeleton, StatCard, StatusBadge, TrendChip } from './dashboard/ui';
import { TONES, money, timeAgo } from './dashboard/format';
import type { Tone } from './dashboard/format';

const QUICK_ACTIONS = [
  { to: '/estimates/new', label: 'New Estimate', icon: FilePlus2 },
  { to: '/scheduling', label: 'Schedule Job', icon: CalendarPlus },
  { to: '/invoices/new', label: 'New Invoice', icon: Receipt },
  { to: '/leads', label: 'View Leads', icon: Inbox },
];

const LiveDuration: React.FC<{ since: string }> = ({ since }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = Math.max(0, now - new Date(since).getTime());
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <>
      {pad(Math.floor(ms / 3600000))}:{pad(Math.floor((ms % 3600000) / 60000))}:{pad(Math.floor((ms % 60000) / 1000))}
    </>
  );
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { session, role, loading: authLoading } = useAuth();
  const isOffice = !authLoading && role === 'office_staff';

  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate('/login/admin');
    else if (role !== 'office_staff') navigate('/worker-dashboard');
  }, [authLoading, session, role, navigate]);

  const { summary, schedule, crew, activity, finance, conversion, lastUpdated, refreshing, refreshAll } =
    useDashboardData(isOffice);

  // Re-render the "updated x ago" label every 30s.
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const s = summary.data;
  const sLoading = summary.loading;

  const attentionItems: { label: string; count: number; to: string; tone: Tone }[] = s
    ? [
        { label: 'Overdue invoices', count: s.overdueInvoices, to: '/invoices?status=Overdue', tone: 'red' },
        { label: 'Estimates awaiting response', count: s.quotesPending, to: '/estimates?status=Sent', tone: 'orange' },
        { label: 'Jobs needing a crew', count: s.unassignedJobs, to: '/jobs?crew=unassigned', tone: 'amber' },
        { label: 'New leads to contact', count: s.uncontactedLeads, to: '/leads?tab=new', tone: 'purple' },
      ]
    : [];

  const pipelineStages: { label: string; value: number; detail: string; to: string; tone: Tone; icon: typeof Inbox }[] = s
    ? [
        { label: 'Leads', value: s.openLeads, detail: `${s.newLeadsThisWeek} new this week`, to: '/leads', tone: 'purple', icon: Inbox },
        { label: 'Quoted', value: s.quotesPending, detail: money(s.quotesPendingTotal), to: '/estimates?status=Sent', tone: 'blue', icon: FileText },
        { label: 'Scheduled', value: s.scheduledJobs, detail: 'Upcoming builds', to: '/jobs?status=Scheduled', tone: 'green', icon: CalendarIcon },
        { label: 'In Progress', value: s.inProgressJobs, detail: 'On site now', to: '/jobs?status=In%20Progress', tone: 'orange', icon: HardHat },
        { label: 'Completed', value: s.completedJobs, detail: 'All time', to: '/jobs?status=Completed', tone: 'slate', icon: CheckCircle2 },
      ]
    : [];

  if (authLoading || !isOffice) {
    return (
      <div className="flex-grow p-4 md:p-6 lg:p-8 space-y-4 bg-[#F8FAFC]">
        <Skeleton className="h-10 w-2/3" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const clockedIn = crew.data?.clockedIn ?? [];
  const offline = Math.max(0, (crew.data?.workersTotal ?? 0) - clockedIn.length);

  return (
    <div className="flex-grow p-4 md:p-6 lg:p-8 space-y-5 md:space-y-6 bg-[#F8FAFC] pb-24 font-sans">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-[#64748B] uppercase tracking-widest m-0">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h2 className="text-xl md:text-2xl font-black text-[#151A2D] tracking-tight mt-1 mb-0">
            Here's your business today
          </h2>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-semibold text-[#64748B]">
          <span>{lastUpdated ? `Updated ${timeAgo(lastUpdated).toLowerCase()}` : 'Loading…'}</span>
          <button
            type="button"
            onClick={refreshAll}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#151A2D] shadow-sm hover:bg-[#F1F5F9] disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
        {QUICK_ACTIONS.map(({ to, label, icon: Icon }, i) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center justify-center gap-2 min-h-[44px] px-3 rounded-xl text-xs md:text-sm font-bold transition-all shadow-sm ${
              i === 0
                ? 'bg-[#7CC242] hover:bg-[#6ab331] text-white'
                : 'bg-white border border-[#E2E8F0] text-[#151A2D] hover:bg-[#F1F5F9]'
            }`}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </div>

      {/* Key numbers */}
      {summary.error && <SectionError message={summary.error} />}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard to="/scheduling" label="Today's Jobs" icon={CalendarIcon} tone="blue" loading={sLoading}
          value={s?.todayJobs ?? 0} detail="Scheduled for today" />
        <StatCard to="/estimates?status=Sent" label="Quotes Pending" icon={FileText} tone="green" loading={sLoading}
          value={s?.quotesPending ?? 0} detail={<><span className="text-[#16A34A] font-bold">{money(s?.quotesPendingTotal ?? 0)}</span> awaiting approval</>} />
        <StatCard to="/jobs?status=In%20Progress" label="Active Builds" icon={TrendingUp} tone="purple" loading={sLoading}
          value={s?.inProgressJobs ?? 0} detail="Currently in progress" />
        <StatCard to="/employees" label="Crew On Site" icon={UserCheck} tone="orange" loading={crew.loading}
          value={clockedIn.length} detail={`of ${crew.data?.workersTotal ?? 0} field workers`} />
      </div>

      {/* Needs attention */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#151A2D] mb-3">
          <AlertTriangle size={16} className="text-[#F97316] stroke-[2.5]" />
          Needs Attention
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {sLoading
            ? [0, 1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)
            : attentionItems.map(item => {
                const active = item.count > 0;
                const t = TONES[active ? item.tone : 'slate'];
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border ${t.border} ${active ? t.soft : 'bg-white'} hover:shadow-sm transition-all`}
                  >
                    <span className={`text-lg font-black leading-none ${active ? t.text : 'text-[#94A3B8]'}`}>{item.count}</span>
                    <span className={`text-[11px] font-bold leading-tight ${active ? 'text-[#151A2D]' : 'text-[#64748B]'}`}>{item.label}</span>
                  </Link>
                );
              })}
        </div>
      </section>

      {/* Today + crew */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
        <Panel title="Today's Operations" icon={CalendarIcon} tone="green" link={{ to: '/scheduling', label: 'Calendar' }}>
          {schedule.loading ? (
            <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-14" />)}</div>
          ) : schedule.error ? (
            <SectionError message={schedule.error} />
          ) : schedule.data!.today.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-6">
              <div className="text-base font-black text-[#151A2D] mb-1">All clear for today</div>
              <div className="text-sm text-[#64748B] font-medium mb-4">No installation jobs are scheduled.</div>
              <Link to="/scheduling" className="inline-flex items-center gap-2 min-h-[44px] px-5 bg-[#7CC242] hover:bg-[#6ab331] text-white text-sm font-bold rounded-xl">
                <Plus size={18} /> Schedule a Job
              </Link>
            </div>
          ) : (
            <ul className="space-y-2 m-0 p-0 list-none">
              {schedule.data!.today.map(j => (
                <li key={j.id}>
                  <Link to={`/jobs/${j.id}`} className="flex items-center gap-3 p-3 border border-[#E2E8F0] rounded-xl hover:border-[#7CC242]/50 bg-[#F8FAFC] transition-colors">
                    <div className="w-11 h-11 rounded-lg bg-white border border-[#E2E8F0] flex flex-col items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold uppercase text-[#64748B] leading-none">Job</span>
                      <span className="text-xs font-black text-[#151A2D]">{j.job_number}</span>
                    </div>
                    <div className="min-w-0 flex-grow">
                      <div className="text-sm font-bold text-[#151A2D] truncate">{j.customer_name}</div>
                      <div className="text-xs text-[#64748B] truncate">{j.worker_name}</div>
                    </div>
                    <StatusBadge status={j.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Crew Status" icon={UserCheck} tone="green" link={{ to: '/employees', label: 'Team' }}>
          {crew.loading ? (
            <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-14" /></div>
          ) : crew.error ? (
            <SectionError message={crew.error} />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className={`${TONES.green.soft} border ${TONES.green.border} rounded-xl p-3`}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
                    <span className="text-lg font-black text-[#151A2D] leading-none">{clockedIn.length}</span>
                  </div>
                  <div className="text-[11px] font-bold text-[#151A2D] mt-1">Clocked in</div>
                </div>
                <div className={`${TONES.slate.soft} border ${TONES.slate.border} rounded-xl p-3`}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#94A3B8]" />
                    <span className="text-lg font-black text-[#151A2D] leading-none">{offline}</span>
                  </div>
                  <div className="text-[11px] font-bold text-[#151A2D] mt-1">Not clocked in</div>
                </div>
              </div>
              {clockedIn.length === 0 ? (
                <p className="text-sm font-semibold text-[#64748B] text-center py-4 m-0">No field technicians clocked in</p>
              ) : (
                <ul className="space-y-2 max-h-[220px] overflow-y-auto m-0 p-0 list-none">
                  {clockedIn.map(w => (
                    <li key={w.id} className="flex items-center justify-between gap-3 p-3 bg-white border border-[#E2E8F0] rounded-xl">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#F0FDF4] border border-[#DCFCE7] flex items-center justify-center text-[#16A34A] text-xs font-black shrink-0">
                          {initials(w.full_name)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-[#151A2D] truncate">{w.full_name}</div>
                          <div className="text-[10px] text-[#64748B]">
                            Since {new Date(w.clock_in).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-black font-mono text-[#16A34A] bg-[#F0FDF4] px-2 py-1 rounded-md border border-[#DCFCE7] shrink-0">
                        <LiveDuration since={w.clock_in} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Panel>
      </div>

      {/* Pipeline + upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
        <Panel title="Business Pipeline" icon={Filter} tone="purple" className="lg:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {sLoading
              ? [0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)
              : pipelineStages.map(({ label, value, detail, to, tone, icon: Icon }) => (
                  <Link key={label} to={to} className={`border ${TONES[tone].border} rounded-xl p-3 flex flex-col justify-between min-h-[92px] hover:shadow-sm transition-all bg-white last:col-span-2 sm:last:col-span-1`}>
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">{label}</span>
                      <span className={`${TONES[tone].text} ${TONES[tone].soft} p-1.5 rounded-lg`}><Icon size={14} /></span>
                    </div>
                    <div>
                      <div className="text-xl font-black text-[#151A2D] leading-none">{value}</div>
                      <div className="text-[10px] text-[#64748B] font-semibold mt-1.5 truncate">{detail}</div>
                    </div>
                  </Link>
                ))}
          </div>
        </Panel>

        <Panel title="Next 5 Days" icon={CalendarIcon} tone="blue" link={{ to: '/scheduling', label: 'Schedule' }}>
          {schedule.loading ? (
            <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : schedule.error ? (
            <SectionError message={schedule.error} />
          ) : schedule.data!.upcoming.length === 0 ? (
            <p className="text-sm font-semibold text-[#64748B] text-center py-6 m-0">No jobs in the next 5 days</p>
          ) : (
            <ul className="space-y-2 m-0 p-0 list-none">
              {schedule.data!.upcoming.slice(0, 5).map(j => (
                <li key={j.id}>
                  <Link to={`/jobs/${j.id}`} className="flex items-center gap-3 p-2.5 border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">
                    <div className="text-center w-10 shrink-0">
                      <div className="text-[9px] font-bold uppercase text-[#64748B] leading-none">
                        {j.scheduled_date && new Date(`${j.scheduled_date.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}
                      </div>
                      <div className="text-sm font-black text-[#151A2D]">
                        {j.scheduled_date && Number(j.scheduled_date.slice(8, 10))}
                      </div>
                    </div>
                    <div className="min-w-0 flex-grow">
                      <div className="text-xs font-bold text-[#151A2D] truncate">{j.customer_name}</div>
                      <div className="text-[10px] text-[#64748B]">JOB-{j.job_number}</div>
                    </div>
                    <StatusBadge status={j.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Financials */}
      <FinancialOverview finance={finance.data} loading={finance.loading} error={finance.error} />

      {/* Revenue chart + conversion */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
        <Panel title="Revenue · Last 6 Months" icon={BarChart3} tone="green" className="lg:col-span-2">
          {finance.loading ? (
            <Skeleton className="h-56" />
          ) : finance.error ? (
            <SectionError message={finance.error} />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={finance.data!.revenueSeries} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickFormatter={(v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)}
                  />
                  <Tooltip
                    cursor={{ fill: '#F8FAFC' }}
                    formatter={(v) => [money(Number(v)), 'Revenue']}
                    contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }}
                  />
                  <Bar dataKey="revenue" fill="#22C55E" radius={[6, 6, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <ConversionPanel data={conversion.data} loading={conversion.loading} error={conversion.error} />
      </div>

      {/* Activity */}
      <Panel title="Recent Activity" icon={Clock} tone="purple" bodyClassName="">
        {activity.loading ? (
          <div className="p-5 space-y-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-10" />)}</div>
        ) : activity.error ? (
          <SectionError message={activity.error} />
        ) : activity.data!.length === 0 ? (
          <p className="p-6 text-sm text-[#64748B] text-center m-0">No recent activity yet.</p>
        ) : (
          <ul className="divide-y divide-[#F1F5F9] m-0 p-0 list-none">
            {activity.data!.map(item => (
              <li key={item.id}>
                <Link to={item.link} className="flex items-center gap-3 px-5 py-3 hover:bg-[#F8FAFC] transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.kind === 'lead' ? `${TONES.purple.soft} ${TONES.purple.text}` : `${TONES.green.soft} ${TONES.green.text}`}`}>
                    {item.kind === 'lead' ? <Inbox size={15} /> : <HardHat size={15} />}
                  </div>
                  <div className="min-w-0 flex-grow">
                    <div className="text-xs font-black text-[#151A2D] truncate">{item.title}</div>
                    <div className="text-[11px] text-[#64748B] truncate">{item.subtitle}</div>
                  </div>
                  {item.status && <StatusBadge status={item.status} className="hidden sm:inline" />}
                  <span className="text-[11px] text-[#94A3B8] font-medium shrink-0 text-right">{timeAgo(item.time)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
};

const FinancialOverview: React.FC<{ finance: Finance | null; loading: boolean; error: string | null }> = ({ finance, loading, error }) => {
  const monthName = new Date().toLocaleDateString(undefined, { month: 'long' });
  return (
    <Panel title={`Financial Overview · ${monthName}`} icon={DollarSign} tone="green" link={{ to: '/net-profit-breakdown', label: 'Profit breakdown' }}>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-24" />)}</div>
      ) : error || !finance ? (
        <SectionError message={error || 'No data'} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <div className={`${TONES.green.soft} border ${TONES.green.border} p-4 rounded-xl`}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#151A2D] mb-1">Revenue</div>
            <div className="text-2xl md:text-3xl font-black text-[#151A2D] leading-none mb-1.5">{money(finance.revenue)}</div>
            <TrendChip current={finance.revenue} previous={finance.prevRevenue} versus={finance.prevMonthLabel} />
          </div>
          <div className={`${TONES.amber.soft} border ${TONES.amber.border} p-4 rounded-xl`}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#151A2D] mb-1">Net Profit</div>
            <div className="text-2xl md:text-3xl font-black text-[#151A2D] leading-none mb-1.5 flex items-center gap-2">
              {money(finance.netProfit)}
              {finance.netProfitHasIncomplete && (
                <span title="Some time entries are incomplete, so labor cost may be understated" className="text-[#EF4444]">
                  <AlertTriangle size={16} />
                </span>
              )}
            </div>
            <TrendChip current={finance.netProfit} previous={finance.prevNetProfit} versus={finance.prevMonthLabel} />
          </div>
          <Link to="/invoices?status=Sent" className={`${TONES.red.soft} border ${TONES.red.border} p-4 rounded-xl hover:shadow-sm transition-all`}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#151A2D] mb-1">Outstanding Invoices</div>
            <div className="text-2xl md:text-3xl font-black text-[#151A2D] leading-none mb-1.5">{money(finance.unpaidTotal)}</div>
            <span className="text-[10px] text-[#64748B] font-bold">{finance.unpaidCount} unpaid · collect payment →</span>
          </Link>
        </div>
      )}
    </Panel>
  );
};

const ConversionPanel: React.FC<{ data: Conversion | null; loading: boolean; error: string | null }> = ({ data, loading, error }) => {
  const steps = data
    ? [
        { label: 'Leads received', value: data.leads },
        { label: 'Quotes sent', value: data.quotesSent },
        { label: 'Quotes approved', value: data.quotesApproved },
        { label: 'Invoices paid', value: data.invoicesPaid },
      ]
    : [];
  const max = Math.max(1, ...steps.map(st => st.value));

  return (
    <Panel title="Conversion · 90 Days" icon={TrendingUp} tone="blue">
      {loading ? (
        <div className="space-y-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-8" />)}</div>
      ) : error || !data ? (
        <SectionError message={error || 'No data'} />
      ) : (
        <div className="space-y-3">
          {steps.map((step, i) => {
            const prev = i > 0 ? steps[i - 1].value : null;
            const rate = prev ? Math.round((step.value / prev) * 100) : null;
            return (
              <div key={step.label}>
                <div className="flex items-baseline justify-between text-[11px] font-bold text-[#151A2D] mb-1">
                  <span>{step.label}</span>
                  <span>
                    {step.value}
                    {rate !== null && <span className="text-[#64748B] font-semibold ml-1.5">({rate}%)</span>}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                  <div className="h-full rounded-full bg-[#0EA5E9]" style={{ width: `${(step.value / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-[#94A3B8] font-medium m-0 pt-1">
            Counts of each step that happened in the last 90 days. Percentages compare each step to the one before it.
          </p>
        </div>
      )}
    </Panel>
  );
};
