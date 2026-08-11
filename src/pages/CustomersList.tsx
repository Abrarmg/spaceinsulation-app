import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { CreateCustomerModal } from '../components/CreateCustomerModal';
import { 
  Search, 
  Plus, 
  Loader2, 
  MapPin, 
  ChevronLeft, 
  ChevronRight,
  AlertCircle,
  Users,
  Filter
} from 'lucide-react';

interface Job {
  id: string;
  status: string;
  scheduled_date: string | null;
  scope_of_work: string | null;
  quoted_amount: number | null;
  created_at: string;
}

interface Invoice {
  id: string;
  total: number;
  status: string;
  created_at: string;
}

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
  jobs?: Job[];
  invoices?: Invoice[];
}

interface CustomerWithCRM extends Customer {
  calculatedStatus: string;
  lastActivityDate: Date;
}

const ITEMS_PER_PAGE = 10;

export const CustomersList: React.FC = () => {
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerWithCRM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search & Sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedSort, setSelectedSort] = useState('Newest');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);

  // Calculated Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    openJobs: 0,
    inactive: 0
  });

  // Calculate stats & apply search, filter, and sorting
  const processCustomers = useCallback(() => {
    // Compute status and last activity date for each customer
    const processed: CustomerWithCRM[] = allCustomers.map(c => {
      const isArchived = c.notes?.includes('[ARCHIVED]');
      const jobsList = c.jobs || [];
      
      // Calculate last activity date
      const dates = [
        new Date(c.created_at).getTime()
      ];
      jobsList.forEach(j => {
        if (j.created_at) dates.push(new Date(j.created_at).getTime());
        if (j.scheduled_date) dates.push(new Date(j.scheduled_date + 'T00:00:00').getTime());
      });
      c.invoices?.forEach(inv => {
        if (inv.created_at) dates.push(new Date(inv.created_at).getTime());
      });
      const lastActivityDate = new Date(Math.max(...dates));

      // Calculate status
      let calculatedStatus = 'Prospect';
      if (isArchived) {
        calculatedStatus = 'Inactive';
      } else if (jobsList.length > 0) {
        const hasOpen = jobsList.some(j => 
          ['pending', 'in progress', 'in_progress', 'scheduled', 'pending approval'].includes(j.status.toLowerCase())
        );
        if (hasOpen) {
          calculatedStatus = 'Active';
        } else {
          calculatedStatus = 'Completed';
        }
      }

      return {
        ...c,
        calculatedStatus,
        lastActivityDate
      };
    });

    // Calculate Summary Stats
    const total = processed.length;
    const active = processed.filter(c => c.calculatedStatus === 'Active' || c.calculatedStatus === 'Completed').length;
    const openJobs = processed.filter(c => 
      c.jobs?.some(j => ['pending', 'in progress', 'in_progress', 'scheduled'].includes(j.status.toLowerCase()))
    ).length;
    const inactive = processed.filter(c => c.calculatedStatus === 'Inactive').length;
    
    setStats({ total, active, openJobs, inactive });

    let result: CustomerWithCRM[] = [];

    // Apply Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = processed.filter(c => 
        c.full_name.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        c.service_address.toLowerCase().includes(q)
      );
    } else {
      result = processed;
    }

    // Apply Filters
    if (selectedFilter === 'Active') {
      result = result.filter(c => c.calculatedStatus === 'Active' || c.calculatedStatus === 'Completed');
    } else if (selectedFilter === 'Inactive') {
      result = result.filter(c => c.calculatedStatus === 'Inactive');
    } else if (selectedFilter === 'Has Open Jobs') {
      result = result.filter(c => c.jobs?.some(j => ['pending', 'in progress', 'in_progress', 'scheduled'].includes(j.status.toLowerCase())));
    } else if (selectedFilter === 'No Open Jobs') {
      result = result.filter(c => !c.jobs?.some(j => ['pending', 'in progress', 'in_progress', 'scheduled'].includes(j.status.toLowerCase())));
    } else if (selectedFilter === 'Preferred Email') {
      result = result.filter(c => c.preferred_contact_method?.toLowerCase() === 'email');
    } else if (selectedFilter === 'Preferred Phone') {
      result = result.filter(c => c.preferred_contact_method?.toLowerCase() === 'phone');
    } else if (selectedFilter === 'Preferred Text') {
      result = result.filter(c => c.preferred_contact_method?.toLowerCase() === 'text');
    }

    // Apply Sorting
    if (selectedSort === 'Newest') {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (selectedSort === 'Name A–Z') {
      result.sort((a, b) => a.full_name.localeCompare(b.full_name));
    } else if (selectedSort === 'Most Jobs') {
      result.sort((a, b) => (b.jobs?.length || 0) - (a.jobs?.length || 0));
    } else if (selectedSort === 'Recent Activity') {
      result.sort((a, b) => (b as any).lastActivityDate.getTime() - (a as any).lastActivityDate.getTime());
    }

    setFilteredCustomers(result);
    setCurrentPage(1);
  }, [allCustomers, searchQuery, selectedFilter, selectedSort]);

  // Fetch customers from Supabase
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('customers')
        .select('*, jobs(id, status, scheduled_date, scope_of_work, quoted_amount, created_at), invoices(id, total, status, created_at)')
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setAllCustomers(data || []);
    } catch (err: any) {
      console.error('Error fetching customers:', err);
      setError('Failed to fetch customers. Please try reloading the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    processCustomers();
  }, [processCustomers]);

  // Archive Customer Handler instead of permanent delete
  const handleArchiveCustomer = async (customer: Customer) => {
    const confirmArchive = window.confirm(
      `Archive "${customer.full_name}"?\nThis will mark this customer as inactive but preserve all history.`
    );
    if (!confirmArchive) return;

    try {
      setLoading(true);
      const updatedNotes = `[ARCHIVED] ${customer.notes || ''}`.trim();
      const { error: updateErr } = await supabase
        .from('customers')
        .update({ notes: updatedNotes })
        .eq('id', customer.id);

      if (updateErr) throw updateErr;
      await fetchCustomers();
    } catch (err: any) {
      console.error('Error archiving customer:', err);
      alert(err.message || 'Failed to archive customer.');
      setLoading(false);
    }
  };

  const handleDeleteCustomer = async (customer: Customer) => {
    const confirmDelete = window.confirm(
      `WARNING: Permanently delete "${customer.full_name}"?\\nThis action cannot be undone. We recommend Archiving instead.`
    );
    if (!confirmDelete) return;
    
    // extra confirm just in case
    const confirmTwice = window.confirm(`Are you absolutely sure you want to permanently delete this customer?`);
    if (!confirmTwice) return;

    try {
      setLoading(true);
      const { error: deleteErr } = await supabase
        .from('customers')
        .delete()
        .eq('id', customer.id);

      if (deleteErr) throw deleteErr;
      await fetchCustomers();
    } catch (err: any) {
      console.error('Error deleting customer:', err);
      alert(err.message || 'Failed to delete customer. They might have active jobs or invoices preventing deletion.');
      setLoading(false);
    }
  };

  const handleEditClick = (customer: Customer) => {
    setCustomerToEdit(customer);
    setIsModalOpen(true);
  };

  const handleCreateClick = () => {
    setCustomerToEdit(null);
    setIsModalOpen(true);
  };

  // Pagination calculations
  const totalCount = filteredCustomers.length;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const formatLastActivity = (d: Date) => {
    const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
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

  return (
    <div className="flex-1 p-4 md:p-6 space-y-4 overflow-y-auto max-h-screen bg-[#F6F7F9] font-sans pb-16">
      
      {/* 1. Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E7E9ED] pb-3">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-[#171A1F] tracking-tight m-0 select-none">
            Customers
          </h2>
          <p className="text-xs md:text-sm text-[#737A86] mt-0.5 font-medium select-none">
            Manage field clients, property history, and active jobs.
          </p>
        </div>
        <button
          onClick={handleCreateClick}
          className="flex items-center justify-center gap-2 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] px-5 py-2.5 rounded-xl font-bold transition-all duration-150 cursor-pointer text-xs shrink-0 min-h-[44px]"
        >
          <Plus size={16} className="stroke-[2.5]" />
          <span>New Customer</span>
        </button>
      </div>

      {/* 2. Compact Statistics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white border border-[#E7E9ED] rounded-xl p-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] select-none">
        <div className="space-y-0.5">
          <div className="text-[9px] font-bold text-[#737A86] uppercase tracking-wider">Total Customers</div>
          <div className="text-xl font-black text-[#151A2D]">{stats.total}</div>
        </div>
        <div className="space-y-0.5 border-l border-[#E7E9ED] pl-4">
          <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Active Clients</div>
          <div className="text-xl font-black text-[#151A2D]">{stats.active}</div>
        </div>
        <div className="space-y-0.5 border-l border-[#E7E9ED] pl-4">
          <div className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">With Open Jobs</div>
          <div className="text-xl font-black text-[#151A2D]">{stats.openJobs}</div>
        </div>
        <div className="space-y-0.5 border-l border-[#E7E9ED] pl-4">
          <div className="text-[9px] font-bold text-red-500 uppercase tracking-wider">Inactive / Archived</div>
          <div className="text-xl font-black text-[#151A2D]">{stats.inactive}</div>
        </div>
      </div>

      {/* 3. Search and Dynamic Filtering Toolbar */}
      <div className="bg-white p-3.5 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E7E9ED] flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737A86] w-4.5 h-4.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone number, or address..."
            className="w-full pl-9 pr-4 py-2 border border-[#E6E8EC] hover:border-[#737A86]/60 focus:border-[#76C442] focus:ring-2 focus:ring-[#76C442]/10 rounded-lg text-xs bg-[#F7F8FA] transition-all focus:outline-none placeholder-[#737A86]/50 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 border border-[#E7E9ED] rounded-lg text-xs font-bold text-[#171A1F] hover:bg-[#F6F7F9] cursor-pointer min-h-[38px] bg-transparent"
          >
            <Filter size={13} />
            <span>Filter & Sort</span>
          </button>

          {isFilterMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setIsFilterMenuOpen(false)} />
              <div className="absolute right-0 top-11 w-64 bg-white border border-[#E7E9ED] rounded-xl shadow-xl p-3.5 z-40 space-y-3 font-sans text-left">
                <div>
                  <label className="text-[9px] font-bold text-[#737A86] uppercase tracking-wider">Status Filters</label>
                  <select 
                    value={selectedFilter}
                    onChange={(e) => setSelectedFilter(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1.5 border border-[#E6E8EC] rounded-lg text-xs bg-white text-[#171A1F] font-bold focus:outline-none focus:border-[#76C442]"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Active">Active Customers</option>
                    <option value="Inactive">Inactive / Archived</option>
                    <option value="Has Open Jobs">Has Open Jobs</option>
                    <option value="No Open Jobs">No Open Jobs</option>
                    <option value="Preferred Email">✉ Preferred: Email</option>
                    <option value="Preferred Phone">☎ Preferred: Phone</option>
                    <option value="Preferred Text">💬 Preferred: Text</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-[#737A86] uppercase tracking-wider">Sorting options</label>
                  <select
                    value={selectedSort}
                    onChange={(e) => setSelectedSort(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1.5 border border-[#E6E8EC] rounded-lg text-xs bg-white text-[#171A1F] font-bold focus:outline-none focus:border-[#76C442]"
                  >
                    <option value="Newest">Newest Added</option>
                    <option value="Name A–Z">Name (A–Z)</option>
                    <option value="Most Jobs">Most Jobs</option>
                    <option value="Recent Activity">Recent Activity</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 4. Main CRM Content Area */}
      <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E7E9ED] overflow-hidden">
        {loading && allCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#737A86]">
            <Loader2 className="w-9 h-9 animate-spin text-[#76C442]" />
            <span className="text-xs font-bold uppercase tracking-wider">Loading Customers Workspace...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-red-500">
            <AlertCircle className="w-9 h-9" />
            <span className="text-xs font-bold uppercase tracking-wider">{error}</span>
            <button
              onClick={fetchCustomers}
              className="mt-2 text-xs bg-[#151A2D] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#1f263e] transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <Users className="w-12 h-12 text-[#737A86]/40 mb-3 stroke-[1.5]" />
            <h3 className="text-sm font-bold text-[#171A1F] m-0">No Customers Found</h3>
            <p className="text-xs text-[#737A86] max-w-sm mt-1 leading-relaxed">
              {searchQuery 
                ? `No customers match your search filters for "${searchQuery}".`
                : "Get started by adding your first insulation client."}
            </p>
            {!searchQuery && (
              <button
                onClick={handleCreateClick}
                className="mt-5 bg-[#151A2D] hover:bg-[#1f263e] text-white px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer min-h-[40px]"
              >
                Create First Customer
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            {/* Overlay loader when reloading */}
            {loading && (
              <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
                <Loader2 className="w-8 h-8 animate-spin text-[#76C442]" />
              </div>
            )}
            
            {/* Desktop and Tablet View Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-[#151A2D] text-white border-b border-[#111624] select-none text-[10px] font-bold uppercase tracking-wider">
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Contact</th>
                    <th className="px-5 py-3">Property</th>
                    <th className="px-5 py-3 text-center">Jobs</th>
                    <th className="px-5 py-3">Last Activity</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E9ED] text-xs font-semibold text-[#171A1F]">
                  {paginatedCustomers.map((customer) => {
                    const initials = customer.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2);
                    const jobsCount = customer.jobs?.length || 0;
                    const lastActivity = formatLastActivity((customer as any).lastActivityDate);
                    const calculatedStatus = (customer as any).calculatedStatus;
                    
                    return (
                      <tr 
                        key={customer.id} 
                        className="hover:bg-[#F6F7F9]/40 transition-colors"
                      >
                        {/* Name & Email Block */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#151A2D] text-white flex items-center justify-center text-[10px] font-black select-none shrink-0 font-mono">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <Link to={`/customers/${customer.id}`} className="font-extrabold text-[#171A1F] hover:text-[#76C442] hover:underline truncate block max-w-[150px]">
                                {customer.full_name}
                              </Link>
                              <div className="text-[10px] text-[#737A86] truncate max-w-[150px] font-medium leading-none mt-0.5">
                                {customer.email || 'No email provided'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Contact details */}
                        <td className="px-5 py-3 text-[#171A1F] font-bold">
                          {customer.phone ? (
                            <a href={`tel:${customer.phone}`} className="hover:text-[#76C442] transition-colors">
                              {customer.phone}
                            </a>
                          ) : (
                            <span className="text-[#737A86]/50 font-normal italic">--</span>
                          )}
                        </td>

                        {/* Service Address */}
                        <td className="px-5 py-3">
                          <div className="truncate max-w-[180px] font-semibold text-[#171A1F] flex items-center gap-1">
                            <MapPin size={12} className="text-[#737A86] shrink-0" />
                            <span title={customer.service_address}>{customer.service_address}</span>
                          </div>
                        </td>

                        {/* Jobs count link */}
                        <td className="px-5 py-3 text-center">
                          <Link 
                            to={`/jobs?customer=${customer.id}`}
                            className="inline-block bg-[#F6F7F9] border border-[#E7E9ED] px-2 py-0.5 rounded-lg text-[#151A2D] hover:border-[#76C442] hover:bg-[#76C442]/5 transition-all text-[10px] font-bold"
                          >
                            {jobsCount} {jobsCount === 1 ? 'Job' : 'Jobs'}
                          </Link>
                        </td>

                        {/* Last activity */}
                        <td className="px-5 py-3 text-[#737A86]">
                          {lastActivity}
                        </td>

                        {/* Status badge pill */}
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 border rounded-lg text-[9px] font-black uppercase tracking-wider ${getStatusPillClass(calculatedStatus)}`}>
                            {calculatedStatus}
                          </span>
                        </td>

                        {/* Row Actions Menu */}
                        <td className="px-5 py-3 text-right">
                          <div className="relative inline-block text-left">
                            <button
                              onClick={() => setActiveActionId(activeActionId === customer.id ? null : customer.id)}
                              className="p-1 rounded-lg hover:bg-[#F6F7F9] text-[#737A86] hover:text-[#171A1F] transition-all cursor-pointer font-extrabold text-sm"
                            >
                              ⋯
                            </button>
                            {activeActionId === customer.id && (
                              <>
                                <div className="fixed inset-0 z-30" onClick={() => setActiveActionId(null)} />
                                <div className="absolute right-0 mt-1 w-40 bg-white border border-[#E7E9ED] rounded-xl shadow-xl py-1 z-40 text-left font-bold text-xs text-[#171A1F]">
                                  <Link to={`/customers/${customer.id}`} onClick={() => setActiveActionId(null)} className="block px-4 py-2 hover:bg-[#F6F7F9] hover:text-[#76C442]">View Profile</Link>
                                  <button onClick={() => { handleEditClick(customer); setActiveActionId(null); }} className="w-full text-left px-4 py-2 hover:bg-[#F6F7F9] hover:text-[#76C442] border-none bg-transparent cursor-pointer font-bold text-xs">Edit Customer</button>
                                  <button onClick={() => { handleArchiveCustomer(customer); setActiveActionId(null); }} className="w-full text-left px-4 py-2 hover:bg-[#F6F7F9] hover:text-[#76C442] border-none bg-transparent cursor-pointer font-bold text-xs">Archive Customer</button>
                                  <button onClick={() => { handleDeleteCustomer(customer); setActiveActionId(null); }} className="w-full text-left px-4 py-2 hover:bg-[#FEF2F2] text-red-600 hover:text-red-700 border-none bg-transparent cursor-pointer font-bold text-xs">Delete Customer</button>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View Cards (Touch-Friendly cards layout) */}
            <div className="block lg:hidden space-y-3 p-3">
              {paginatedCustomers.map((customer) => {
                const initials = customer.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2);
                const jobsCount = customer.jobs?.length || 0;
                const lastActivity = formatLastActivity((customer as any).lastActivityDate);
                const calculatedStatus = (customer as any).calculatedStatus;
                
                return (
                  <div key={customer.id} className="bg-white border border-[#E7E9ED] rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-3 relative">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-[#151A2D] text-white flex items-center justify-center text-xs font-black select-none shrink-0 font-mono">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <Link to={`/customers/${customer.id}`} className="text-sm font-extrabold text-[#171A1F] hover:text-[#76C442] hover:underline block truncate">
                            {customer.full_name}
                          </Link>
                          <div className="text-[10px] text-[#737A86] font-medium leading-none mt-0.5 truncate">{customer.email || 'No email provided'}</div>
                        </div>
                      </div>
                      
                      {/* Action trigger menu */}
                      <div className="relative shrink-0">
                        <button 
                          onClick={() => setActiveActionId(activeActionId === customer.id ? null : customer.id)}
                          className="p-1 rounded-lg hover:bg-[#F6F7F9] text-[#737A86] hover:text-[#171A1F] min-w-[38px] min-h-[38px] flex items-center justify-center border-none bg-transparent"
                        >
                          <span className="font-extrabold text-sm">⋯</span>
                        </button>
                        {activeActionId === customer.id && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setActiveActionId(null)} />
                            <div className="absolute right-0 mt-1.5 w-40 bg-white border border-[#E7E9ED] rounded-xl shadow-lg py-1.5 z-40 text-left font-bold text-xs text-[#171A1F]">
                              <Link to={`/customers/${customer.id}`} onClick={() => setActiveActionId(null)} className="block px-4 py-2 hover:bg-[#F6F7F9] hover:text-[#76C442]">View Profile</Link>
                              <button onClick={() => { handleEditClick(customer); setActiveActionId(null); }} className="w-full text-left px-4 py-2 hover:bg-[#F6F7F9] hover:text-[#76C442] border-none bg-transparent cursor-pointer font-bold text-xs">Edit Customer</button>
                              <button onClick={() => { handleArchiveCustomer(customer); setActiveActionId(null); }} className="w-full text-left px-4 py-2 hover:bg-[#F6F7F9] hover:text-[#76C442] border-none bg-transparent cursor-pointer font-bold text-xs">Archive Customer</button>
                              <button onClick={() => { handleDeleteCustomer(customer); setActiveActionId(null); }} className="w-full text-left px-4 py-2 hover:bg-[#FEF2F2] text-red-600 hover:text-red-700 border-none bg-transparent cursor-pointer font-bold text-xs">Delete Customer</button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-[#E7E9ED]/50 text-xs text-[#171A1F] font-semibold">
                      {customer.phone && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#737A86]">📞</span>
                          <a href={`tel:${customer.phone}`} className="hover:underline">{customer.phone}</a>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#737A86]">📍</span>
                        <span className="truncate max-w-[260px]" title={customer.service_address}>{customer.service_address}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-[#E7E9ED]/50 text-[10px] font-bold">
                      <div className="flex items-center gap-2">
                        <span className="bg-[#F6F7F9] px-2 py-0.5 border border-[#E7E9ED] rounded-lg text-[#171A1F]">
                          {jobsCount} {jobsCount === 1 ? 'Job' : 'Jobs'}
                        </span>
                        <span className={`px-2 py-0.5 border rounded-lg uppercase tracking-wider ${getStatusPillClass(calculatedStatus)}`}>
                          {calculatedStatus}
                        </span>
                      </div>
                      <div className="text-[#737A86] font-semibold">
                        Last active: <span className="text-[#171A1F]">{lastActivity}</span>
                      </div>
                    </div>

                    <Link 
                      to={`/customers/${customer.id}`}
                      className="mt-2 block w-full text-center bg-[#F6F7F9] hover:bg-[#76C442]/10 text-xs font-bold py-2 border border-[#E7E9ED] rounded-lg text-[#151A2D] transition-colors min-h-[38px] flex items-center justify-center"
                    >
                      View Customer →
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && !error && filteredCustomers.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#E7E9ED] px-5 py-4 bg-[#F6F7F9] select-none text-xs font-bold">
            <span className="text-[#737A86]">
              Showing <span className="text-[#171A1F] font-black">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
              <span className="text-[#171A1F] font-black">
                {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)}
              </span>{' '}
              of <span className="text-[#171A1F] font-black">{totalCount}</span> clients
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 border border-[#E7E9ED] rounded-lg hover:bg-white transition-colors disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer min-h-[38px] min-w-[38px]"
                title="Previous Page"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[#171A1F] font-bold px-1">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 border border-[#E7E9ED] rounded-lg hover:bg-white transition-colors disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer min-h-[38px] min-w-[38px]"
                title="Next Page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Customer Modal (Create & Edit) */}
      <CreateCustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchCustomers}
        customerToEdit={customerToEdit}
      />
    </div>
  );
};
