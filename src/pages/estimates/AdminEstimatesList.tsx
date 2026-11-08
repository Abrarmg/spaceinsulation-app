import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import {
  FOLLOWUP_URGENT_DAYS,
  daysWaiting,
  expiredSentBefore,
  followUpCutoff,
  getValidUntil,
  needsFollowUp,
  relativeTime,
} from '../../utils/estimates';
import { useConfirm, useToast } from '../../hooks/useFeedback';
import { Button, ButtonLink, EmptyState, Page, PageHeader, Sheet, StatusBadge } from '../../components/ui';
import { ListLoading, ListPanel, MobileRow, OverflowMenu, SearchInput, StatStrip, StatusTabs, T } from '../../components/ui/list';
import { 
  FileText, 
  Plus, 
  ArrowRight, 
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  BellRing,
  Check,
  Send
} from 'lucide-react';

interface Estimate {
  id: string;
  estimate_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  status: string;
  total_amount: number;
  created_at: string;
  sent_at?: string | null;
  first_viewed_at?: string | null;
  last_viewed_at?: string | null;
  view_count?: number | null;
  last_followup_at?: string | null;
  approved_at?: string | null;
  insulation_type?: string;
  insulation_rate?: number;
  home_size?: number;
  line_items?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
  }> | null;
  expert_name?: string | null;
  expert_role?: string | null;
  expert_email?: string | null;
  expert_phone?: string | null;
  expert_address?: string | null;
}

interface Stats {
  total: number;
  draft: number;
  sent: number;
  approved: number;
  followUp: number;
  pipelineValue: number;
}

const STATUS_OPTIONS = ['all', 'Draft', 'Sent', 'Follow up', 'Approved', 'Rejected', 'Expired'];
const ITEMS_PER_PAGE = 8;

export const AdminEstimatesList: React.FC = () => {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Stats summaries
  const [stats, setStats] = useState<Stats>({ total: 0, draft: 0, sent: 0, approved: 0, followUp: 0, pipelineValue: 0 });

  // Dropdown menu state
  const navigate = useNavigate();
  const { confirm, confirmDialog } = useConfirm();
  const { showToast, toastElement } = useToast();
  
  // Mobile bottom filter sheet state

  // Conversion Confirmation Dialog States
  const [conversionTarget, setConversionTarget] = useState<Estimate | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [convertedJobInfo, setConvertedJobInfo] = useState<{ id: string; jobNumber: number } | null>(null);


  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const dbClient = supabase;

  // Fetch summary statistics
  const fetchStats = useCallback(async () => {
    try {
      const { data, error: statsErr } = await dbClient
        .from('estimates')
        .select('*');

      if (statsErr) throw statsErr;

      const items = data || [];
      const computed: Stats = {
        total: items.length,
        draft: items.filter(e => e.status === 'Draft').length,
        sent: items.filter(e => e.status === 'Sent').length,
        approved: items.filter(e => e.status === 'Approved').length,
        followUp: items.filter(e => needsFollowUp(e as Estimate)).length,
        pipelineValue: items.reduce((sum, e) => sum + Number(e.total_amount || 0), 0)
      };
      setStats(computed);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, [dbClient]);

  // Fetch estimates list
  const fetchEstimates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fromRange = (currentPage - 1) * ITEMS_PER_PAGE;
      const toRange = fromRange + ITEMS_PER_PAGE - 1;

      let query = dbClient
        .from('estimates')
        .select('*', { count: 'exact' });

      // Apply status filter
      if (statusFilter === 'Follow up') {
        const cutoff = followUpCutoff();
        query = query
          .eq('status', 'Sent')
          .lt('sent_at', cutoff)
          .gte('sent_at', expiredSentBefore())
          .or(`last_followup_at.is.null,last_followup_at.lt.${cutoff}`);
      } else if (statusFilter === 'Expired') {
        query = query.eq('status', 'Sent').lt('sent_at', expiredSentBefore());
      } else if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Apply search query (ID, name, email, insulation type, or home size)
      if (debouncedQuery.trim()) {
        const queryTerm = debouncedQuery.trim();
        query = query.or(`estimate_number.ilike.%${queryTerm}%,customer_name.ilike.%${queryTerm}%,customer_email.ilike.%${queryTerm}%,insulation_type.ilike.%${queryTerm}%`);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(fromRange, toRange);

      const { data, count, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      setEstimates((data as any[]) || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error('Failed to fetch estimates:', err);
      setError('Could not load estimates. Please verify database connection.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, debouncedQuery, dbClient]);

  useEffect(() => {
    fetchEstimates();
    fetchStats();
  }, [fetchEstimates, fetchStats]);

  const getExpiryDetails = (est: Estimate) => {
    const validDate = getValidUntil(est);
    const dateText = validDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    // Only quotes waiting on the customer can expire.
    if (est.status !== 'Sent') {
      return { text: dateText, style: 'text-ink-soft' };
    }

    const now = new Date();
    const validZero = new Date(validDate.getFullYear(), validDate.getMonth(), validDate.getDate());
    const nowZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((validZero.getTime() - nowZero.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: 'Expired', style: 'text-red-700 font-medium' };
    } else if (diffDays <= 2) {
      return { text: diffDays === 0 ? 'Expires today' : `Expires in ${diffDays} day${diffDays !== 1 ? 's' : ''}`, style: 'text-amber-700 font-medium' };
    }
    return { text: dateText, style: 'text-ink-soft' };
  };

  // actions menu triggers
  const handleDuplicate = async (e: React.MouseEvent, targetEst: Estimate) => {
    e.stopPropagation();
    if (!(await confirm({ title: `Duplicate ${targetEst.estimate_number}?`, message: 'A new draft copy will be created.', confirmLabel: 'Duplicate' }))) return;

    try {
      // estimate_number is left to the database sequence so concurrent duplicates can't collide.
      const { data: dupData, error: dupErr } = await dbClient
        .from('estimates')
        .insert([{
          customer_id: targetEst.customer_id,
          customer_name: targetEst.customer_name,
          customer_email: targetEst.customer_email,
          home_size: targetEst.home_size || 0,
          insulation_type: targetEst.insulation_type || 'Line Items',
          insulation_rate: targetEst.insulation_rate || 0,
          expert_name: targetEst.expert_name,
          expert_role: targetEst.expert_role,
          expert_email: targetEst.expert_email,
          expert_phone: targetEst.expert_phone,
          expert_address: targetEst.expert_address,
          total_amount: targetEst.total_amount,
          line_items: targetEst.line_items,
          status: 'Draft'
        }])
        .select('estimate_number')
        .single();

      if (dupErr) throw dupErr;
      showToast(`Duplicate ${dupData.estimate_number} created`);
      fetchEstimates();
      fetchStats();
    } catch (err: any) {
      showToast('Failed to duplicate estimate: ' + err.message, 'error');
    }
  };

  // Sending attaches a PDF rendered on the detail page, so hand off to its send dialog.
  const handleSendToCustomer = (e: React.MouseEvent, targetEst: Estimate, followUp = false) => {
    e.stopPropagation();
    navigate(`/estimates/${targetEst.id}?send=1${followUp ? '&followup=1' : ''}`);
  };

  const handleDelete = async (e: React.MouseEvent, targetEstId: string) => {
    e.stopPropagation();
    if (isDeleting) return;
    const confirmed = await confirm({
      title: 'Delete this estimate?',
      message: 'It will be permanently removed. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    setIsDeleting(targetEstId);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      
      if (sessionError || !token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/delete-estimate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ estimateId: targetEstId, auth_token: token })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error();
      }

      showToast('Estimate deleted');
      fetchEstimates();
      fetchStats();
    } catch (err: any) {
      showToast('Unable to delete this estimate. Please try again.', 'error');
    } finally {
      setIsDeleting(null);
    }
  };

  // Convert Approved Estimate to Job Workflow
  const handleOpenConversion = (e: React.MouseEvent, est: Estimate) => {
    e.stopPropagation();
    setConversionTarget(est);
    setConvertedJobInfo(null);
  };

  const executeJobConversion = async () => {
    if (!conversionTarget) return;
    setIsConverting(true);
    try {
      // 1. Fetch maximum job number for incremental sequence
      const { data: maxJobData, error: maxJobError } = await dbClient
        .from('jobs')
        .select('job_number')
        .order('job_number', { ascending: false })
        .limit(1);

      if (maxJobError) throw maxJobError;

      const nextJobNum = maxJobData && maxJobData.length > 0 
        ? Number(maxJobData[0].job_number) + 1 
        : 1001;

      // 2. Generate scope details summary
      const lineItems = Array.isArray(conversionTarget.line_items) ? conversionTarget.line_items : [];
      const itemsList = lineItems.map((item) => 
        `- ${item.description} (Qty: ${item.quantity || 1} × $${Number(item.unit_price || 0).toFixed(2)} = $${(Number(item.quantity || 1) * Number(item.unit_price || 0)).toFixed(2)})`
      ).join('\n');

      const scopeOfWork = [
        `Converted from Estimate ${conversionTarget.estimate_number}`,
        `Insulation Type: ${conversionTarget.insulation_type || 'Attic Insulation'}`,
        itemsList ? `\nDetailed Scope Items:\n${itemsList}` : null
      ].filter(Boolean).join('\n');

      // 3. Insert Job record
      const { data: jobData, error: jobErr } = await dbClient
        .from('jobs')
        .insert([{
          customer_id: conversionTarget.customer_id,
          job_number: nextJobNum,
          status: 'Scheduled',
          scope_of_work: scopeOfWork,
          quoted_amount: conversionTarget.total_amount
        }])
        .select()
        .maybeSingle();

      if (jobErr) throw jobErr;

      // 4. Update estimate status to Approved
      const { error: estErr } = await dbClient
        .from('estimates')
        .update({ status: 'Approved', approved_at: conversionTarget.approved_at || new Date().toISOString() })
        .eq('id', conversionTarget.id);

      if (estErr) throw estErr;

      if (jobData) {
        setConvertedJobInfo({ id: jobData.id, jobNumber: nextJobNum });
      }
      fetchEstimates();
      fetchStats();
    } catch (err: any) {
      showToast('Job conversion failed: ' + err.message, 'error');
    } finally {
      setIsConverting(false);
    }
  };


  const trackingNote = (est: Estimate) => {
    if (est.status !== 'Sent') return null;
    const waiting = daysWaiting(est);
    const followUp = waiting !== null && needsFollowUp(est);
    return (
      <div className="flex flex-col gap-0.5 mt-1">
        {est.last_viewed_at ? (
          <span
            className="inline-flex items-center gap-1 text-2xs font-medium text-brand-ink whitespace-nowrap"
            title={`First opened ${new Date(est.first_viewed_at || est.last_viewed_at).toLocaleString()}`}
          >
            <Eye size={11} /> Viewed {relativeTime(est.last_viewed_at)}
            {(est.view_count || 0) > 1 && <span className="text-muted font-semibold">· {est.view_count}×</span>}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-2xs text-muted">
            <EyeOff size={11} /> <span className="whitespace-nowrap">Not opened yet</span>
          </span>
        )}
        {followUp && (
          <span
            className={`inline-flex items-center gap-1 text-2xs font-bold ${
              waiting! >= FOLLOWUP_URGENT_DAYS ? 'text-red-600' : 'text-amber-600'
            }`}
          >
            <BellRing size={11} /> No reply · {waiting}d
          </span>
        )}
      </div>
    );
  };

  /** Menu items don't pass a click event, but the handlers expect one. */
  const noEvent = { stopPropagation: () => {} } as unknown as React.MouseEvent;

  const money = (n: number) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  /** The one obvious next step for each estimate. */
  const primaryAction = (est: Estimate) => {
    const followUp = needsFollowUp(est);
    if (est.status === 'Approved') {
      return (
        <Button size="sm" onClick={e => handleOpenConversion(e, est)}>
          Convert to job
        </Button>
      );
    }
    if (est.status === 'Draft') {
      return (
        <Button size="sm" variant="dark" icon={Send} onClick={e => handleSendToCustomer(e, est)}>
          Send
        </Button>
      );
    }
    if (est.status === 'Sent') {
      return (
        <Button
          size="sm"
          variant="secondary"
          icon={BellRing}
          onClick={e => handleSendToCustomer(e, est, true)}
          className={followUp ? '!bg-amber-50 !border-amber-300 !text-amber-800' : ''}
        >
          Follow up
        </Button>
      );
    }
    return null;
  };

  const moreActions = (est: Estimate) => (
    <div onClick={e => e.stopPropagation()}>
      <OverflowMenu
        label="Estimate actions"
        actions={[
          { label: 'View estimate', icon: Eye, onClick: () => navigate(`/estimates/${est.id}`) },
          { label: 'Duplicate', icon: Copy, onClick: () => handleDuplicate(noEvent, est) },
          { label: isDeleting === est.id ? 'Deleting…' : 'Delete', icon: Trash2, onClick: () => handleDelete(noEvent, est.id), danger: true },
        ]}
      />
    </div>
  );

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const tabs = STATUS_OPTIONS.map(s => ({
    value: s,
    label: s === 'all' ? 'All' : s,
    count:
      s === 'all' ? stats.total : s === 'Draft' ? stats.draft : s === 'Sent' ? stats.sent : s === 'Approved' ? stats.approved : s === 'Follow up' ? stats.followUp : undefined,
  }));

  return (
    <Page>
      <PageHeader
        title="Estimates"
        subtitle="Price jobs, send them to customers and turn approvals into jobs."
        actions={
          <ButtonLink to="/estimates/new" icon={Plus}>
            New estimate
          </ButtonLink>
        }
      />

      <StatStrip
        items={[
          { label: 'Drafts', value: stats.draft, hint: 'Not sent yet', active: statusFilter === 'Draft', onClick: () => { setStatusFilter(statusFilter === 'Draft' ? 'all' : 'Draft'); setCurrentPage(1); } },
          { label: 'Waiting for reply', value: stats.sent, hint: stats.followUp > 0 ? `${stats.followUp} need a follow-up` : 'Sent to customers', tone: stats.followUp > 0 ? 'amber' : 'default', active: statusFilter === 'Sent', onClick: () => { setStatusFilter(statusFilter === 'Sent' ? 'all' : 'Sent'); setCurrentPage(1); } },
          { label: 'Approved', value: stats.approved, hint: 'Ready to become jobs', tone: 'green', active: statusFilter === 'Approved', onClick: () => { setStatusFilter(statusFilter === 'Approved' ? 'all' : 'Approved'); setCurrentPage(1); } },
          { label: 'Pipeline value', value: `$${Number(stats.pipelineValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, hint: 'Open estimates' },
        ]}
      />

      <ListPanel
        tabs={
          <StatusTabs
            tabs={tabs}
            value={statusFilter}
            onChange={v => {
              setStatusFilter(v);
              setCurrentPage(1);
            }}
          />
        }
        toolbar={<SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search by customer, email or estimate #" />}
        footer={
          !loading && !error && totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3 text-xs text-muted">
              <span>
                Page {currentPage} of {totalPages} · {totalCount} estimates
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="secondary" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>
                  Next
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        {loading ? (
          <ListLoading label="Loading estimates…" />
        ) : error ? (
          <EmptyState icon={AlertCircle} title="Couldn't load estimates" description={error} />
        ) : estimates.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={debouncedQuery.trim() ? 'No estimates found' : 'No estimates yet'}
            description={
              debouncedQuery.trim() ? 'Try another name, email address or estimate number.' : 'Create your first estimate to start building your sales pipeline.'
            }
            action={!debouncedQuery.trim() ? <ButtonLink to="/estimates/new" icon={Plus}>New estimate</ButtonLink> : undefined}
          />
        ) : (
          <>
            <div className={T.wrap}>
              <table className={T.table}>
                <thead className={T.thead}>
                  <tr>
                    <th className={T.th}>Customer</th>
                    <th className={`${T.th} hidden lg:table-cell`}>Service</th>
                    <th className={T.th}>Status</th>
                    <th className={`${T.th} text-right`}>Total</th>
                    <th className={`${T.th} hidden xl:table-cell`}>Valid until</th>
                    <th className={`${T.th} text-right`}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {estimates.map(est => {
                    const expiry = getExpiryDetails(est);
                    return (
                      <tr key={est.id} className={T.tr} onClick={() => navigate(`/estimates/${est.id}`)}>
                        <td className={T.td}>
                          <div className="font-semibold truncate max-w-[240px]">{est.customer_name}</div>
                          <div className="text-xs text-muted">
                            #{est.estimate_number} · {shortDate(est.created_at)}
                          </div>
                        </td>
                        <td className={`${T.td} hidden lg:table-cell`}>{est.insulation_type || 'Attic insulation'}</td>
                        <td className={T.td}>
                          <StatusBadge status={est.status} />
                          {trackingNote(est)}
                        </td>
                        <td className={`${T.td} text-right font-semibold whitespace-nowrap`}>{money(est.total_amount)}</td>
                        <td className={`${T.td} hidden xl:table-cell text-xs whitespace-nowrap`}>
                          <span className={expiry.style}>{expiry.text}</span>
                        </td>
                        <td className={T.td}>
                          <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                            {primaryAction(est)}
                            {moreActions(est)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-line">
              {estimates.map(est => {
                const expiry = getExpiryDetails(est);
                const action = primaryAction(est);
                return (
                  <div key={`mob-est-${est.id}`}>
                    <MobileRow
                      to={`/estimates/${est.id}`}
                      title={est.customer_name}
                      subtitle={`#${est.estimate_number} · ${est.insulation_type || 'Attic insulation'}`}
                      right={<StatusBadge status={est.status} />}
                      meta={
                        <>
                          <span className="font-semibold text-navy">{money(est.total_amount)}</span>
                          <span className={expiry.style}>Valid until {expiry.text}</span>
                          {trackingNote(est)}
                        </>
                      }
                    />
                    <div className="flex items-center justify-end gap-2 px-4 pb-3 -mt-1">
                      {action}
                      {moreActions(est)}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </ListPanel>

      {/* Approved estimate → job */}
      <Sheet
        open={!!conversionTarget}
        onClose={() => {
          if (!isConverting) setConversionTarget(null);
        }}
        size="sm"
        title={convertedJobInfo ? 'Job created' : `Create a job from #${conversionTarget?.estimate_number ?? ''}?`}
        footer={
          convertedJobInfo ? (
            <Button variant="secondary" onClick={() => setConversionTarget(null)}>
              Close
            </Button>
          ) : (
            <>
              <Button variant="secondary" disabled={isConverting} onClick={() => setConversionTarget(null)}>
                Cancel
              </Button>
              <Button loading={isConverting} onClick={executeJobConversion}>
                Create job
              </Button>
            </>
          )
        }
      >
        {conversionTarget &&
          (convertedJobInfo ? (
            <div className="text-center py-2 space-y-3">
              <div className="w-12 h-12 rounded-full bg-brand-soft text-brand-ink flex items-center justify-center mx-auto">
                <Check size={22} strokeWidth={3} />
              </div>
              <p className="m-0 text-sm text-navy">Job #{convertedJobInfo.jobNumber} is ready to schedule.</p>
              <ButtonLink to={`/jobs/${convertedJobInfo.id}`} variant="secondary" icon={ArrowRight}>
                Open job
              </ButtonLink>
            </div>
          ) : (
            <dl className="m-0 space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Customer</dt>
                <dd className="m-0 font-semibold text-navy text-right">{conversionTarget.customer_name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Service</dt>
                <dd className="m-0 font-semibold text-navy text-right">{conversionTarget.insulation_type || 'Attic insulation'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Estimate total</dt>
                <dd className="m-0 font-semibold text-navy text-right">{money(conversionTarget.total_amount)}</dd>
              </div>
            </dl>
          ))}
      </Sheet>

      {confirmDialog}
      {toastElement}
    </Page>
  );
};
