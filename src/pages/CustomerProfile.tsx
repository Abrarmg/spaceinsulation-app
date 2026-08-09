import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { CreateCustomerModal } from '../components/CreateCustomerModal';
import { 
  ArrowLeft, 
  Loader2, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  AlertCircle,
  Edit2,
  Archive,
  ExternalLink
} from 'lucide-react';

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  service_address: string;
  billing_address: string | null;
  preferred_contact_method: string | null;
  notes: string | null;
  created_at: string;
}

interface Job {
  id: string;
  job_number: number;
  status: string;
  scheduled_date: string | null;
  scope_of_work: string | null;
  quoted_amount: number | null;
  created_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
  created_at: string;
}

interface Estimate {
  id: string;
  estimate_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  insulation_type?: string;
}

interface TimelineEvent {
  id: string;
  date: Date;
  title: string;
  description: string;
  icon: string;
}

export const CustomerProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch all related customer CRM tables
  const fetchCustomerData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    
    try {
      // 1. Fetch customer details
      const { data: customerData, error: customerErr } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (customerErr) throw customerErr;
      
      if (!customerData) {
        setError('Customer record not found.');
        setLoading(false);
        return;
      }

      setCustomer(customerData);

      // 2. Fetch jobs
      const { data: jobsData, error: jobsErr } = await supabase
        .from('jobs')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });

      if (jobsErr) throw jobsErr;
      setJobs(jobsData || []);

      // 3. Fetch invoices
      const { data: invoicesData, error: invoicesErr } = await supabase
        .from('invoices')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });

      if (invoicesErr) throw invoicesErr;
      setInvoices(invoicesData || []);

      // 4. Fetch estimates
      const { data: estimatesData, error: estimatesErr } = await supabase
        .from('estimates')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });

      if (estimatesErr) throw estimatesErr;
      setEstimates(estimatesData || []);

    } catch (err: any) {
      console.error('Error fetching customer profile:', err);
      setError(err.message || 'Failed to load customer profile.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchCustomerData();
    }
  }, [id, fetchCustomerData]);

  // Safer archive handler (renamed delete to archive as requested)
  const handleArchiveCustomer = async () => {
    if (!customer) return;

    const confirmArchive = window.confirm(
      `Archive "${customer.full_name}"?\n\nThis will mark this customer as inactive but preserve their full job history and financial records.`
    );
    
    if (!confirmArchive) return;

    try {
      setLoading(true);
      const updatedNotes = `[ARCHIVED] ${customer.notes || ''}`.trim();
      const { error: archiveErr } = await supabase
        .from('customers')
        .update({ notes: updatedNotes })
        .eq('id', customer.id);

      if (archiveErr) throw archiveErr;

      navigate('/customers');
    } catch (err: any) {
      console.error('Error archiving customer from profile:', err);
      alert(err.message || 'Failed to archive customer.');
      setLoading(false);
    }
  };

  const getCleanNotes = () => {
    if (!customer?.notes) return '';
    return customer.notes.replace('[ARCHIVED]', '').trim();
  };

  const getCustomerStatus = () => {
    if (!customer) return 'Prospect';
    const isArchived = customer.notes?.includes('[ARCHIVED]');
    if (isArchived) return 'Inactive';
    
    if (jobs.length === 0) return 'Prospect';
    
    const hasOpen = jobs.some(j => 
      ['pending', 'in progress', 'in_progress', 'scheduled'].includes(j.status.toLowerCase())
    );
    
    return hasOpen ? 'Active' : 'Completed';
  };

  const getStatusPillClass = (status: string) => {
    switch (status) {
      case 'Active':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'Completed':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'Inactive':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-amber-700 bg-amber-50 border-amber-200';
    }
  };

  // Financial calculations
  const invoicesCount = invoices.length;
  const paidTotal = invoices
    .filter(inv => inv.status.toLowerCase() === 'paid')
    .reduce((sum, inv) => sum + Number(inv.total), 0);
  const outstandingTotal = invoices
    .filter(inv => ['sent', 'unpaid'].includes(inv.status.toLowerCase()))
    .reduce((sum, inv) => sum + Number(inv.total), 0);
  const totalRevenue = paidTotal; // Realized cash income

  // Compile timeline events dynamically
  const getTimelineEvents = (): TimelineEvent[] => {
    const events: TimelineEvent[] = [];
    if (!customer) return [];

    // Customer creation
    events.push({
      id: `created-${customer.id}`,
      date: new Date(customer.created_at),
      title: 'Customer Profile Created',
      description: `Client added to database via preferred contact: ${customer.preferred_contact_method || 'email'}.`,
      icon: '👤'
    });

    // Estimates
    estimates.forEach(est => {
      events.push({
        id: `est-${est.id}`,
        date: new Date(est.created_at),
        title: `Estimate ${est.estimate_number || 'draft'} Created`,
        description: `Estimate generated with status: ${est.status}. Total: $${Number(est.total_amount).toLocaleString()}`,
        icon: '📄'
      });
    });

    // Jobs
    jobs.forEach(job => {
      events.push({
        id: `job-${job.id}`,
        date: new Date(job.created_at),
        title: `Job JOB-${job.job_number} Created`,
        description: `Job assigned with status: ${job.status}. Quoted: $${(job.quoted_amount || 0).toLocaleString()}`,
        icon: '🛠️'
      });
      if (job.scheduled_date) {
        events.push({
          id: `job-sched-${job.id}`,
          date: new Date(job.scheduled_date + 'T00:00:00'),
          title: `Job JOB-${job.job_number} Scheduled`,
          description: `Work scheduled for ${new Date(job.scheduled_date + 'T00:00:00').toLocaleDateString()}`,
          icon: '📅'
        });
      }
    });

    // Invoices
    invoices.forEach(inv => {
      events.push({
        id: `inv-${inv.id}`,
        date: new Date(inv.created_at),
        title: `Invoice ${inv.invoice_number || 'draft'} Generated`,
        description: `Billing total: $${Number(inv.total).toLocaleString()} (Status: ${inv.status})`,
        icon: '💵'
      });
    });

    // Sort by date desc
    return events.sort((a, b) => b.date.getTime() - a.date.getTime());
  };

  if (loading) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center min-h-screen gap-3 text-[#737A86] bg-[#F6F7F9]">
        <Loader2 className="w-9 h-9 animate-spin text-[#76C442]" />
        <span className="text-xs font-bold uppercase tracking-wider">Loading Customer Workspace...</span>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="flex-grow p-6 flex flex-col items-center justify-center min-h-screen text-center bg-[#F6F7F9]">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-base font-extrabold text-[#171A1F] uppercase tracking-wider">Failed to Load Profile</h2>
        <p className="text-xs text-[#737A86] max-w-md mt-1 leading-relaxed">
          {error || 'The requested customer profile could not be loaded.'}
        </p>
        <button
          onClick={() => navigate('/customers')}
          className="mt-6 inline-flex items-center gap-2 bg-[#151A2D] hover:bg-[#20273f] text-white px-5 py-2.5 rounded-lg font-bold transition-all cursor-pointer text-xs min-h-[40px]"
        >
          <ArrowLeft size={14} className="stroke-[2.5]" />
          <span>Back to Customers List</span>
        </button>
      </div>
    );
  }

  const timeline = getTimelineEvents();
  const calculatedStatus = getCustomerStatus();

  return (
    <div className="flex-grow p-4 md:p-6 space-y-4 overflow-y-auto max-h-screen bg-[#F6F7F9] font-sans pb-16">
      
      {/* 1. Navigation Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E7E9ED] pb-3">
        <button
          onClick={() => navigate('/customers')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#151A2D] hover:text-[#76C442] transition-colors cursor-pointer border-none bg-transparent"
        >
          <ArrowLeft size={14} className="stroke-[2.5]" />
          <span>Back to Customers</span>
        </button>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-4.5 py-2 border border-[#E7E9ED] hover:border-[#737A86] text-[#171A1F] text-xs font-bold bg-white rounded-lg transition-colors cursor-pointer min-h-[38px]"
          >
            <Edit2 size={13} />
            <span>Edit Profile</span>
          </button>
          <button
            onClick={handleArchiveCustomer}
            className="flex items-center gap-1.5 px-4.5 py-2 border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold bg-white rounded-lg transition-colors cursor-pointer min-h-[38px]"
          >
            <Archive size={13} />
            <span>Archive Customer</span>
          </button>
        </div>
      </div>

      {/* 2. Customer 360 Overview Header Card */}
      {customer && (
        <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E7E9ED] p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-[#E7E9ED]/60 pb-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-[#171A1F] m-0 tracking-tight leading-none">
                  {customer.full_name}
                </h1>
                <span className={`px-2.5 py-0.5 border rounded-lg text-[9px] font-black uppercase tracking-wider ${getStatusPillClass(calculatedStatus)}`}>
                  {calculatedStatus} Customer
                </span>
              </div>
              <div className="text-xs text-[#737A86] font-medium leading-none select-none">
                Customer since {new Date(customer.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
              </div>
            </div>

            {/* Quick Actions Scroll Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 md:pb-0 scrollbar-none font-bold text-xs select-none">
              {customer.phone && (
                <a 
                  href={`tel:${customer.phone}`}
                  className="px-3.5 py-2 bg-[#F6F7F9] hover:bg-[#E7E9ED] border border-[#E7E9ED] rounded-lg text-[#171A1F] flex items-center gap-1 shrink-0"
                >
                  <Phone size={12} />
                  <span>Call</span>
                </a>
              )}
              {customer.email && (
                <a 
                  href={`mailto:${customer.email}`}
                  className="px-3.5 py-2 bg-[#F6F7F9] hover:bg-[#E7E9ED] border border-[#E7E9ED] rounded-lg text-[#171A1F] flex items-center gap-1 shrink-0"
                >
                  <Mail size={12} />
                  <span>Email</span>
                </a>
              )}
              <Link 
                to={`/estimates/new?customer=${customer.id}`}
                className="px-3.5 py-2 bg-[#F6F7F9] hover:bg-[#76C442]/10 border border-[#E7E9ED] rounded-lg text-[#151A2D] flex items-center gap-1 shrink-0"
              >
                <span>+ Estimate</span>
              </Link>
              <Link 
                to={`/scheduling?customer=${customer.id}`}
                className="px-3.5 py-2 bg-[#76C442] hover:bg-[#689F38] rounded-lg text-[#151A2D] flex items-center gap-1 shrink-0"
              >
                <span>+ Job</span>
              </Link>
            </div>
          </div>

          {/* CRM details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1 select-none">
            <div className="bg-[#F6F7F9] p-3 rounded-lg border border-[#E7E9ED] space-y-1">
              <div className="text-[9px] font-bold text-[#737A86] uppercase tracking-wider">Phone</div>
              <div className="text-xs font-bold text-[#171A1F] truncate">
                {customer.phone || <span className="text-[#737A86]/40 italic font-normal">Not Provided</span>}
              </div>
            </div>
            <div className="bg-[#F6F7F9] p-3 rounded-lg border border-[#E7E9ED] space-y-1">
              <div className="text-[9px] font-bold text-[#737A86] uppercase tracking-wider">Email</div>
              <div className="text-xs font-bold text-[#171A1F] truncate">
                {customer.email || <span className="text-[#737A86]/40 italic font-normal">Not Provided</span>}
              </div>
            </div>
            <div className="bg-[#F6F7F9] p-3 rounded-lg border border-[#E7E9ED] space-y-1">
              <div className="text-[9px] font-bold text-[#737A86] uppercase tracking-wider">Total Jobs</div>
              <div className="text-xs font-bold text-[#171A1F]">{jobs.length}</div>
            </div>
            <div className="bg-[#F6F7F9] p-3 rounded-lg border border-[#E7E9ED] space-y-1">
              <div className="text-[9px] font-bold text-[#737A86] uppercase tracking-wider">Realized Revenue</div>
              <div className="text-xs font-bold text-emerald-600">${totalRevenue.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Financial Summary Strip */}
      <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E7E9ED] p-5 space-y-3.5 select-none">
        <h3 className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider border-b border-[#E7E9ED]/60 pb-1.5">
          Customer Commercial History
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-[9px] font-semibold text-[#737A86] uppercase tracking-wider">Total Revenue</div>
            <div className="text-lg font-black text-[#171A1F] mt-1">${totalRevenue.toLocaleString()}</div>
          </div>
          <div className="border-l border-[#E7E9ED] pl-4">
            <div className="text-[9px] font-semibold text-red-600 uppercase tracking-wider">Outstanding Billing</div>
            <div className="text-lg font-black text-red-600 mt-1">${outstandingTotal.toLocaleString()}</div>
          </div>
          <div className="border-l border-[#E7E9ED] pl-4">
            <div className="text-[9px] font-semibold text-emerald-600 uppercase tracking-wider">Paid Amount</div>
            <div className="text-lg font-black text-emerald-600 mt-1">${paidTotal.toLocaleString()}</div>
          </div>
          <div className="border-l border-[#E7E9ED] pl-4">
            <div className="text-[9px] font-semibold text-[#737A86] uppercase tracking-wider">Invoices Count</div>
            <div className="text-lg font-black text-[#171A1F] mt-1">{invoicesCount}</div>
          </div>
        </div>
      </div>

      {/* 4. Service Location and Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Service Address Panel */}
        <div className="bg-white rounded-xl border border-[#E7E9ED] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-4">
          <h3 className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider border-b border-[#E7E9ED]/60 pb-1.5">
            Service Location Property
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-1 text-[9px] font-bold text-[#737A86] uppercase tracking-wider mb-1">
                <MapPin size={12} className="text-[#76C442]" />
                <span>Service Site Address</span>
              </div>
              <div className="text-xs font-bold text-[#171A1F] leading-relaxed">
                {customer?.service_address}
              </div>
            </div>
            {customer?.billing_address && (
              <div className="border-t border-[#E7E9ED]/50 pt-2.5">
                <div className="text-[9px] font-semibold text-[#737A86] uppercase tracking-wider mb-1">
                  Billing Address
                </div>
                <div className="text-xs font-semibold text-[#171A1F]">
                  {customer.billing_address}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Customer Notes Panel */}
        <div className="bg-white rounded-xl border border-[#E7E9ED] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-4">
          <h3 className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider border-b border-[#E7E9ED]/60 pb-1.5">
            Customer Internal Notes
          </h3>
          {getCleanNotes() ? (
            <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-3.5 text-xs text-amber-900 font-semibold leading-relaxed">
              {getCleanNotes()}
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center justify-center text-center text-[#737A86]">
              <div className="text-xs font-bold italic">No special instructions saved</div>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="mt-2 text-xs font-extrabold text-[#76C442] hover:underline bg-transparent border-none cursor-pointer"
              >
                + Add notes
              </button>
            </div>
          )}
        </div>

      </div>

      {/* 5. Insulation Jobs Summary List */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider select-none">
          Insulation Jobs History
        </h3>

        <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E7E9ED] overflow-hidden">
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Calendar className="w-10 h-10 text-[#737A86]/40 mb-2 stroke-[1.5]" />
              <h4 className="text-xs font-bold text-[#171A1F] m-0">No Jobs Booked Yet</h4>
              <p className="text-[10px] text-[#737A86] max-w-xs mt-1">
                There are currently no insulation service requests recorded for this client.
              </p>
              <Link
                to={`/scheduling?customer=${customer?.id}`}
                className="mt-3.5 bg-[#151A2D] text-white hover:bg-[#20273f] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 min-h-[38px] flex items-center justify-center"
              >
                Schedule First Job
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs font-semibold text-[#171A1F]">
                <thead>
                  <tr className="bg-[#151A2D] text-white border-b border-[#111624] select-none text-[9.5px] font-bold uppercase tracking-wider">
                    <th className="px-5 py-3">Job Number</th>
                    <th className="px-5 py-3">Service Scope</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Scheduled Date</th>
                    <th className="px-5 py-3 text-right">Quoted Amount</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E9ED]">
                  {jobs.map((job) => {
                    const displayService = job.scope_of_work || 'Attic Insulation';
                    
                    return (
                      <tr key={job.id} className="hover:bg-[#F6F7F9]/40 transition-colors">
                        <td className="px-5 py-3">
                          <Link to={`/jobs/${job.id}`} className="font-extrabold text-[#76C442] hover:underline">
                            JOB-{job.job_number}
                          </Link>
                        </td>
                        <td className="px-5 py-3 font-bold text-[#171A1F]">{displayService}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.2 border rounded text-[7.5px] font-extrabold uppercase tracking-wider ${
                            job.status.toLowerCase() === 'completed' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                            ['pending', 'quoted'].includes(job.status.toLowerCase()) ? 'text-amber-700 bg-amber-50 border-amber-200' :
                            'text-blue-700 bg-blue-50 border-blue-200'
                          }`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[#737A86]">
                          {job.scheduled_date ? new Date(job.scheduled_date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unscheduled'}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-bold">
                          ${(job.quoted_amount || 0).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link 
                            to={`/jobs/${job.id}`} 
                            className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#151A2D] hover:text-[#76C442] transition-colors"
                          >
                            <span>View</span>
                            <ExternalLink size={11} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 6. Dynamic CRM Timeline Activity */}
      <div className="bg-white rounded-xl border border-[#E7E9ED] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-4">
        <h3 className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider border-b border-[#E7E9ED]/60 pb-1.5 select-none">
          CRM Client Timeline & Activity Feed
        </h3>

        <div className="space-y-3.5 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E7E9ED]">
          {timeline.slice(0, 8).map(evt => (
            <div key={evt.id} className="flex gap-2 items-start relative pl-5.5 text-xs text-[#171A1F]">
              <div className="absolute left-[6px] top-1 w-1.5 h-1.5 rounded-full bg-[#76C442] ring-2 ring-white" />
              <div className="flex-grow flex items-start justify-between gap-4">
                <div className="space-y-0.5 leading-snug">
                  <div className="font-extrabold text-[#171A1F] flex items-center gap-1">
                    <span>{evt.icon}</span>
                    <span>{evt.title}</span>
                  </div>
                  <div className="text-[10px] text-[#737A86] font-medium">{evt.description}</div>
                </div>
                <div className="text-[9.5px] text-[#737A86] font-bold select-none shrink-0">
                  {evt.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Customer Modal */}
      {customer && (
        <CreateCustomerModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            fetchCustomerData();
          }}
          onSuccess={fetchCustomerData}
          customerToEdit={customer}
        />
      )}
    </div>
  );
};
