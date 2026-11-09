import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  HardHat,
  Inbox,
  RefreshCw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GettingStarted } from '../components/onboarding/GettingStarted';
import { useDashboardData } from './dashboard/useDashboardData';
import type { Conversion, Finance, JobSummary, Summary } from './dashboard/useDashboardData';
import { SectionError, Skeleton, TrendChip } from './dashboard/ui';
import { money, timeAgo } from './dashboard/format';
import { ButtonLink, Card, EmptyState, Page, StatusBadge } from '../components/ui';
import { nowInAppTz } from '../utils/dates';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const LiveDuration: React.FC<{ since: string }> = ({ since }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = Math.max(0, now - new Date(since).getTime());
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return <>{h > 0 ? `${h}h ${m}m` : `${m}m`}</>;
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

const greeting = () => {
  const h = nowInAppTz().hour;
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const dayParts = (iso: string | null) => {
  if (!iso) return { weekday: '', day: '' };
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return { weekday: d.toLocaleDateString(undefined, { weekday: 'short' }), day: String(d.getDate()) };
};

/* -------------------------------------------------------------------------- */
/* Workflow overview — the four stages of the business, like Jobber's Home     */
/* -------------------------------------------------------------------------- */

interface StageLine {
  label: string;
  value: React.ReactNode;
  to: string;
  warn?: boolean;
}

interface StageProps {
  title: string;
  icon: LucideIcon;
  accent: string;
  to: string;
  headline: React.ReactNode;
  caption: string;
  lines: StageLine[];
  loading: boolean;
}

const Stage: React.FC<StageProps> = ({ title, icon: Icon, accent, to, headline, caption, lines, loading }) => (
  <div className="bg-white border border-line rounded-xl shadow-card flex flex-col min-w-0">
    <Link to={to} className="group flex items-center justify-between gap-2 px-3 sm:px-4 pt-3 sm:pt-4 no-underline">
      <span className="flex items-center gap-2 min-w-0">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
          <Icon size={17} />
        </span>
        <span className="text-sm font-semibold text-navy truncate">{title}</span>
      </span>
      <ChevronRight size={16} className="text-subtle group-hover:text-navy transition-colors shrink-0" />
    </Link>

    <div className="px-3 sm:px-4 pt-3 pb-3">
      {loading ? (
        <>
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-28 mt-2" />
        </>
      ) : (
        <>
          <div className="text-2xl sm:text-[1.75rem] font-bold text-navy leading-none tracking-tight">{headline}</div>
          <div className="text-xs text-muted mt-1.5">{caption}</div>
        </>
      )}
    </div>

    <div className="hidden sm:block mt-auto border-t border-line">
      {lines.map(line => (
        <Link
          key={line.label}
          to={line.to}
          className="flex items-center justify-between gap-2 px-4 py-2 text-xs no-underline hover:bg-canvas last:rounded-b-xl"
        >
          <span className={line.warn ? 'text-red-700 font-medium' : 'text-ink-soft'}>{line.label}</span>
          <span className={`font-semibold ${line.warn ? 'text-red-700' : 'text-navy'}`}>{loading ? '–' : line.value}</span>
        </Link>
      ))}
    </div>
  </div>
);

const WorkflowOverview: React.FC<{ s: Summary | null; sLoading: boolean; finance: Finance | null; fLoading: boolean }> = ({
  s,
  sLoading,
  finance,
  fLoading,
}) => (
  <section aria-labelledby="workflow-title">
    <h2 id="workflow-title" className="m-0 mb-3 text-base font-semibold text-navy">
      Workflow
    </h2>
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
      <Stage
        title="Leads"
        icon={Inbox}
        accent="bg-purple-50 text-purple-700"
        to="/leads"
        loading={sLoading}
        headline={s?.openLeads ?? 0}
        caption="Open leads"
        lines={[
          { label: 'New this week', value: s?.newLeadsThisWeek ?? 0, to: '/leads?tab=new' },
          { label: 'Waiting to be contacted', value: s?.uncontactedLeads ?? 0, to: '/leads?tab=new', warn: (s?.uncontactedLeads ?? 0) > 0 },
        ]}
      />
      <Stage
        title="Estimates"
        icon={FileText}
        accent="bg-blue-50 text-blue-700"
        to="/estimates"
        loading={sLoading}
        headline={s?.quotesPending ?? 0}
        caption="Awaiting customer approval"
        lines={[{ label: 'Value awaiting approval', value: money(s?.quotesPendingTotal ?? 0), to: '/estimates?status=Sent' }]}
      />
      <Stage
        title="Jobs"
        icon={ClipboardList}
        accent="bg-brand-soft text-brand-ink"
        to="/jobs"
        loading={sLoading}
        headline={s?.todayJobs ?? 0}
        caption="Scheduled for today"
        lines={[
          { label: 'In progress', value: s?.inProgressJobs ?? 0, to: '/jobs?status=In%20Progress' },
          { label: 'Upcoming', value: s?.scheduledJobs ?? 0, to: '/jobs?status=Scheduled' },
          { label: 'Need a crew', value: s?.unassignedJobs ?? 0, to: '/jobs?crew=unassigned', warn: (s?.unassignedJobs ?? 0) > 0 },
        ]}
      />
      <Stage
        title="Invoices"
        icon={FileSpreadsheet}
        accent="bg-amber-50 text-amber-700"
        to="/invoices"
        loading={fLoading || sLoading}
        headline={money(finance?.unpaidTotal ?? 0)}
        caption={`${finance?.unpaidCount ?? 0} unpaid ${finance?.unpaidCount === 1 ? 'invoice' : 'invoices'}`}
        lines={[
          { label: 'Overdue', value: s?.overdueInvoices ?? 0, to: '/invoices?status=Overdue', warn: (s?.overdueInvoices ?? 0) > 0 },
          { label: 'Waiting for payment', value: finance?.unpaidCount ?? 0, to: '/invoices?status=Sent' },
        ]}
      />
    </div>
  </section>
);

/* -------------------------------------------------------------------------- */
/* To-do list                                                                  */
/* -------------------------------------------------------------------------- */

const TodoCard: React.FC<{ s: Summary | null; loading: boolean }> = ({ s, loading }) => {
  const items = s
    ? [
        { label: 'Overdue invoices to chase', count: s.overdueInvoices, to: '/invoices?status=Overdue', icon: FileSpreadsheet },
        { label: 'New leads to contact', count: s.uncontactedLeads, to: '/leads?tab=new', icon: Inbox },
        { label: 'Jobs that need a crew', count: s.unassignedJobs, to: '/jobs?crew=unassigned', icon: HardHat },
        { label: 'Estimates awaiting a reply', count: s.quotesPending, to: '/estimates?status=Sent', icon: FileText },
      ].filter(i => i.count > 0)
    : [];

  return (
    <Card title="To do" padded={false}>
      {loading ? (
        <div className="p-4 space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-10" />)}</div>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-5">
          <span className="w-9 h-9 rounded-full bg-brand-soft text-brand-ink flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} />
          </span>
          <div>
            <div className="text-sm font-semibold text-navy">You're all caught up</div>
            <div className="text-xs text-muted">Nothing needs your attention right now.</div>
          </div>
        </div>
      ) : (
        <ul className="m-0 p-0 list-none divide-y divide-line">
          {items.map(({ label, count, to, icon: Icon }) => (
            <li key={label}>
              <Link to={to} className="flex items-center gap-3 px-4 py-3 no-underline hover:bg-canvas">
                <Icon size={17} className="text-muted shrink-0" />
                <span className="flex-1 text-sm text-navy">{label}</span>
                <span className="min-w-[1.75rem] h-6 px-2 rounded-full bg-red-50 text-red-700 text-xs font-semibold flex items-center justify-center">
                  {count}
                </span>
                <ChevronRight size={16} className="text-subtle" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

/* -------------------------------------------------------------------------- */
/* Schedule                                                                    */
/* -------------------------------------------------------------------------- */

const JobRow: React.FC<{ job: JobSummary; showDate?: boolean }> = ({ job, showDate }) => {
  const { weekday, day } = dayParts(job.scheduled_date);
  return (
    <Link to={`/jobs/${job.id}`} className="flex items-center gap-3 px-4 py-3 no-underline hover:bg-canvas">
      {showDate ? (
        <div className="w-11 shrink-0 text-center rounded-lg border border-line py-1">
          <div className="text-2xs text-muted leading-none">{weekday}</div>
          <div className="text-sm font-bold text-navy leading-tight">{day}</div>
        </div>
      ) : (
        <div className="w-1 self-stretch rounded-full bg-brand shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-navy truncate">{job.customer_name}</div>
        <div className="text-xs text-muted truncate">
          Job #{job.job_number} · {job.worker_name}
        </div>
      </div>
      <StatusBadge status={job.status} />
      <ChevronRight size={16} className="text-subtle shrink-0" />
    </Link>
  );
};

const ScheduleCard: React.FC<{
  data: { today: JobSummary[]; upcoming: JobSummary[] } | null;
  loading: boolean;
  error: string | null;
}> = ({ data, loading, error }) => (
  <Card
    title="Today's schedule"
    description={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
    actions={<ButtonLink to="/scheduling" variant="secondary" size="sm" icon={CalendarDays}>Calendar</ButtonLink>}
    padded={false}
  >
    {loading ? (
      <div className="p-4 space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12" />)}</div>
    ) : error || !data ? (
      <SectionError message={error || 'No data'} />
    ) : (
      <>
        {data.today.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nothing scheduled today"
            description="Book a job and it will show up here."
            action={<ButtonLink to="/scheduling?new=1" icon={CalendarPlus}>Schedule a job</ButtonLink>}
            className="py-8"
          />
        ) : (
          <div className="divide-y divide-line">
            {data.today.map(j => <JobRow key={j.id} job={j} />)}
          </div>
        )}

        {data.upcoming.length > 0 && (
          <>
            <div className="px-4 pt-4 pb-2 border-t border-line text-2xs font-semibold text-muted uppercase tracking-wider">
              Coming up · next 5 days
            </div>
            <div className="divide-y divide-line">
              {data.upcoming.slice(0, 5).map(j => <JobRow key={j.id} job={j} showDate />)}
            </div>
          </>
        )}
      </>
    )}
  </Card>
);

/* -------------------------------------------------------------------------- */
/* Crew                                                                        */
/* -------------------------------------------------------------------------- */

const CrewCard: React.FC<{
  clockedIn: { id: string; full_name: string; clock_in: string }[];
  total: number;
  loading: boolean;
  error: string | null;
}> = ({ clockedIn, total, loading, error }) => (
  <Card
    title="Crew on site"
    description={loading ? 'Loading…' : `${clockedIn.length} of ${total} field workers clocked in`}
    actions={<Link to="/employees" className="text-xs font-semibold text-brand-ink no-underline hover:underline">Team</Link>}
    padded={false}
  >
    {loading ? (
      <div className="p-4 space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
    ) : error ? (
      <SectionError message={error} />
    ) : clockedIn.length === 0 ? (
      <p className="m-0 px-4 py-5 text-sm text-muted">No one is clocked in right now.</p>
    ) : (
      <ul className="m-0 p-0 list-none divide-y divide-line max-h-[260px] overflow-y-auto">
        {clockedIn.map(w => (
          <li key={w.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-mist text-ink-soft flex items-center justify-center text-2xs font-semibold">
                {initials(w.full_name)}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-brand border-2 border-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-navy truncate">{w.full_name}</div>
              <div className="text-xs text-muted">
                Since {new Date(w.clock_in).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </div>
            </div>
            <span className="text-xs font-semibold text-brand-ink tabular-nums">
              <LiveDuration since={w.clock_in} />
            </span>
          </li>
        ))}
      </ul>
    )}
  </Card>
);

/* -------------------------------------------------------------------------- */
/* Business performance                                                        */
/* -------------------------------------------------------------------------- */

const Metric: React.FC<{ label: string; value: React.ReactNode; foot: React.ReactNode; to?: string }> = ({ label, value, foot, to }) => {
  const body = (
    <>
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="text-2xl font-bold text-navy leading-tight mt-1 tracking-tight flex items-center gap-2">{value}</div>
      <div className="mt-1">{foot}</div>
    </>
  );
  return to ? (
    <Link to={to} className="block p-4 rounded-lg no-underline hover:bg-canvas">
      {body}
    </Link>
  ) : (
    <div className="p-4">{body}</div>
  );
};

const PerformanceCard: React.FC<{ finance: Finance | null; loading: boolean; error: string | null }> = ({ finance, loading, error }) => {
  const monthName = new Date().toLocaleDateString(undefined, { month: 'long' });
  return (
    <Card
      title="Business performance"
      description={`${monthName} so far`}
      actions={
        <Link to="/net-profit-breakdown" className="text-xs font-semibold text-brand-ink no-underline hover:underline">
          Profit breakdown
        </Link>
      }
      padded={false}
    >
      {loading ? (
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-20" />)}</div>
      ) : error || !finance ? (
        <SectionError message={error || 'No data'} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-line">
            <Metric
              label="Revenue"
              value={money(finance.revenue)}
              foot={<TrendChip current={finance.revenue} previous={finance.prevRevenue} versus={finance.prevMonthLabel} />}
            />
            <Metric
              label="Net profit"
              value={
                <>
                  {money(finance.netProfit)}
                  {finance.netProfitHasIncomplete && (
                    <span title="Some time entries are incomplete, so labour cost may be understated" className="text-amber-600">
                      <AlertTriangle size={16} />
                    </span>
                  )}
                </>
              }
              foot={<TrendChip current={finance.netProfit} previous={finance.prevNetProfit} versus={finance.prevMonthLabel} />}
            />
            <Metric
              label="Waiting for payment"
              value={money(finance.unpaidTotal)}
              to="/invoices?status=Sent"
              foot={<span className="text-2xs text-muted">{finance.unpaidCount} unpaid · collect payment →</span>}
            />
          </div>
          <div className="border-t border-line px-2 pt-4 pb-2">
            <div className="px-2 pb-2 text-xs font-medium text-muted">Revenue · last 6 months</div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={finance.revenueSeries} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={52}
                    tick={{ fontSize: 12, fill: '#64748B' }}
                    tickFormatter={(v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)}
                  />
                  <Tooltip
                    cursor={{ fill: '#F7F8FA' }}
                    formatter={v => [money(Number(v)), 'Revenue']}
                    contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13 }}
                  />
                  <Bar dataKey="revenue" fill="#76C442" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};

const ConversionCard: React.FC<{ data: Conversion | null; loading: boolean; error: string | null }> = ({ data, loading, error }) => {
  const steps = data
    ? [
        { label: 'Leads received', value: data.leads },
        { label: 'Estimates sent', value: data.quotesSent },
        { label: 'Estimates approved', value: data.quotesApproved },
        { label: 'Invoices paid', value: data.invoicesPaid },
      ]
    : [];
  const max = Math.max(1, ...steps.map(st => st.value));

  return (
    <Card title="Conversion" description="Last 90 days">
      {loading ? (
        <div className="space-y-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-8" />)}</div>
      ) : error || !data ? (
        <SectionError message={error || 'No data'} />
      ) : (
        <div className="space-y-4">
          {steps.map((step, i) => {
            const prev = i > 0 ? steps[i - 1].value : null;
            const rate = prev ? Math.round((step.value / prev) * 100) : null;
            return (
              <div key={step.label}>
                <div className="flex items-baseline justify-between text-xs mb-1.5">
                  <span className="text-ink-soft">{step.label}</span>
                  <span className="font-semibold text-navy">
                    {step.value}
                    {rate !== null && <span className="text-muted font-normal ml-1.5">{rate}%</span>}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-mist overflow-hidden">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${(step.value / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
          <p className="m-0 text-2xs text-muted">Each percentage compares a step with the one before it.</p>
        </div>
      )}
    </Card>
  );
};

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

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

  if (authLoading || !isOffice) {
    return (
      <Page>
        <Skeleton className="h-10 w-2/3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
      </Page>
    );
  }

  const firstName = (session?.user?.user_metadata?.full_name as string | undefined)?.split(' ')[0];
  const clockedIn = crew.data?.clockedIn ?? [];

  return (
    <Page>
      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl md:text-[1.75rem] font-bold text-navy tracking-tight leading-tight">
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="m-0 mt-1 text-sm text-muted">Here's what's happening with your business today.</p>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          disabled={refreshing}
          className="self-start sm:self-auto inline-flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-medium text-muted hover:text-navy hover:bg-mist border-0 bg-transparent disabled:opacity-60"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {lastUpdated ? `Updated ${timeAgo(lastUpdated).toLowerCase()}` : 'Loading…'}
        </button>
      </div>

      <GettingStarted />

      {summary.error && <SectionError message={summary.error} />}

      <WorkflowOverview s={summary.data} sLoading={summary.loading} finance={finance.data} fLoading={finance.loading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 items-start">
        <div className="lg:col-span-2">
          <ScheduleCard data={schedule.data} loading={schedule.loading} error={schedule.error} />
        </div>
        <div className="space-y-4 md:space-y-5">
          <TodoCard s={summary.data} loading={summary.loading} />
          <CrewCard clockedIn={clockedIn} total={crew.data?.workersTotal ?? 0} loading={crew.loading} error={crew.error} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 items-start">
        <div className="lg:col-span-2">
          <PerformanceCard finance={finance.data} loading={finance.loading} error={finance.error} />
        </div>
        <ConversionCard data={conversion.data} loading={conversion.loading} error={conversion.error} />
      </div>

      <Card title="Recent activity" padded={false}>
        {activity.loading ? (
          <div className="p-4 space-y-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-10" />)}</div>
        ) : activity.error ? (
          <SectionError message={activity.error} />
        ) : activity.data!.length === 0 ? (
          <p className="m-0 p-6 text-sm text-muted text-center">No recent activity yet.</p>
        ) : (
          <ul className="m-0 p-0 list-none divide-y divide-line">
            {activity.data!.map(item => (
              <li key={item.id}>
                <Link to={item.link} className="flex items-center gap-3 px-4 py-3 no-underline hover:bg-canvas">
                  <span
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      item.kind === 'lead' ? 'bg-purple-50 text-purple-700' : 'bg-brand-soft text-brand-ink'
                    }`}
                  >
                    {item.kind === 'lead' ? <Inbox size={15} /> : <HardHat size={15} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-navy truncate">{item.title}</div>
                    <div className="text-xs text-muted truncate">{item.subtitle}</div>
                  </div>
                  {item.status && (
                    <span className="hidden sm:block">
                      <StatusBadge status={item.status} />
                    </span>
                  )}
                  <span className="text-xs text-muted shrink-0 text-right">{timeAgo(item.time)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Page>
  );
};
