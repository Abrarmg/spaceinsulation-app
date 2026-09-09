import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { CreateCustomerModal } from '../components/CreateCustomerModal';
import { ImportContactsModal } from '../components/ImportContactsModal';
import { 
  Search, 
  Plus, 
  Upload,
  Loader2, 
  ChevronLeft, 
  ChevronRight,
  AlertCircle,
  Users,
  Briefcase,
  TrendingUp,
  Archive,
  Phone,
  Mail
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

interface Lead {
  id: string;
  name: string | null;
  status: string | null;
  pipeline_stage: string | null;
  source: string | null;
  received_at: string | null;
  created_at: string;
}

interface Contact {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  service_address: string | null;
  billing_address: string | null;
  preferred_contact_method: string | null;
  notes: string | null;
  source: string;
  contact_type: string;
  created_from: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  jobs?: Job[];
  invoices?: Invoice[];
  leads?: Lead[];
}

interface ContactWithCRM extends Contact {
  activeOpportunitiesCount: number;
  jobsCount: number;
}

const ITEMS_PER_PAGE = 12;

type FilterTab = 'all' | 'prospect' | 'customer' | 'archived';

export const CustomersList: React.FC = () => {
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ContactWithCRM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSort, setSelectedSort] = useState('Newest');
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);

  // Top Counters Stats
  const [counts, setCounts] = useState({
    all: 0,
    prospects: 0,
    customers: 0,
    archived: 0
  });

  // Calculate active opportunities (leads not in won or closed/lost state)
  const getActiveOpportunitiesCount = (leads?: Lead[]) => {
    if (!leads || leads.length === 0) return 0;
    return leads.filter(l => {
      const stage = (l.pipeline_stage || '').toLowerCase();
      const status = (l.status || '').toLowerCase();
      return stage !== 'won' && status !== 'lost' && status !== 'closed';
    }).length;
  };

  // Fetch contacts from Supabase
  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('customers')
        .select(`
          *,
          jobs(id, status, scheduled_date, scope_of_work, quoted_amount, created_at),
          invoices(id, total, status, created_at),
          leads(id, name, status, pipeline_stage, source, received_at, created_at)
        `)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setAllContacts((data as Contact[]) || []);
    } catch (err: any) {
      console.error('Error fetching contacts:', err);
      setError('Failed to fetch contacts. Please try reloading the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Process and filter contacts
  const processContacts = useCallback(() => {
    // 1. Compute counts
    const activeRecords = allContacts.filter(c => !c.is_archived);
    const allCount = activeRecords.length;
    const prospectsCount = activeRecords.filter(c => c.contact_type === 'prospect').length;
    const customersCount = activeRecords.filter(c => c.contact_type === 'customer').length;
    const archivedCount = allContacts.filter(c => c.is_archived).length;

    setCounts({
      all: allCount,
      prospects: prospectsCount,
      customers: customersCount,
      archived: archivedCount
    });

    // 2. Enhance with counts
    const enhanced: ContactWithCRM[] = allContacts.map(c => ({
      ...c,
      activeOpportunitiesCount: getActiveOpportunitiesCount(c.leads),
      jobsCount: c.jobs?.length || 0
    }));

    // 3. Filter by Active Tab
    let tabFiltered: ContactWithCRM[] = [];
    if (activeTab === 'all') {
      tabFiltered = enhanced.filter(c => !c.is_archived);
    } else if (activeTab === 'prospect') {
      tabFiltered = enhanced.filter(c => c.contact_type === 'prospect' && !c.is_archived);
    } else if (activeTab === 'customer') {
      tabFiltered = enhanced.filter(c => c.contact_type === 'customer' && !c.is_archived);
    } else if (activeTab === 'archived') {
      tabFiltered = enhanced.filter(c => c.is_archived);
    }

    // 4. Filter by Search Query
    let searched = tabFiltered;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      searched = tabFiltered.filter(c => 
        (c.full_name && c.full_name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.service_address && c.service_address.toLowerCase().includes(q)) ||
        (c.source && c.source.toLowerCase().includes(q))
      );
    }

    // 5. Apply Sorting
    const sorted = [...searched];
    if (selectedSort === 'Newest') {
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (selectedSort === 'Name A–Z') {
      sorted.sort((a, b) => a.full_name.localeCompare(b.full_name));
    } else if (selectedSort === 'Most Jobs') {
      sorted.sort((a, b) => b.jobsCount - a.jobsCount);
    } else if (selectedSort === 'Most Opportunities') {
      sorted.sort((a, b) => b.activeOpportunitiesCount - a.activeOpportunitiesCount);
    }

    setFilteredContacts(sorted);
    setCurrentPage(1);
  }, [allContacts, activeTab, searchQuery, selectedSort]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    processContacts();
  }, [processContacts]);

  const handleEditClick = (contact: Contact) => {
    setContactToEdit(contact);
    setIsModalOpen(true);
  };

  const handleCreateClick = () => {
    setContactToEdit(null);
    setIsModalOpen(true);
  };

  // Pagination calculations
  const totalCount = filteredContacts.length;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const paginatedContacts = filteredContacts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const formatDate = (isoString?: string) => {
    if (!isoString) return '--';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderSourceBadge = (source?: string) => {
    switch (source) {
      case 'facebook':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1877F2]" />
            Facebook
          </span>
        );
      case 'csv_import':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            CSV Import
          </span>
        );
      case 'existing_customer':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-50 text-teal-700 border border-teal-200">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
            Existing
          </span>
        );
      case 'manual':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Manual
          </span>
        );
    }
  };

  const renderTypeBadge = (type?: string, isArchived?: boolean) => {
    if (isArchived) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-gray-100 text-gray-600 border border-gray-200 uppercase tracking-wider">
          Archived
        </span>
      );
    }

    if (type === 'customer') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Customer
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
        Prospect
      </span>
    );
  };

  return (
    <div className="flex-1 p-4 md:p-6 space-y-4 overflow-y-auto max-h-screen bg-[#F6F7F9] font-sans pb-16">
      
      {/* 1. Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E7E9ED] pb-3">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-[#171A1F] tracking-tight m-0 select-none">
            Contacts
          </h2>
          <p className="text-xs md:text-sm text-[#737A86] mt-0.5 font-medium select-none">
            Manage prospects, customers, and imported contacts.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-white hover:bg-[#F6F7F9] text-[#151A2D] border border-[#E7E9ED] px-4 py-2.5 rounded-xl font-bold transition-all duration-150 cursor-pointer text-xs min-h-[44px]"
          >
            <Upload size={14} className="text-[#76C442]" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={handleCreateClick}
            className="flex items-center justify-center gap-2 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] px-5 py-2.5 rounded-xl font-bold transition-all duration-150 cursor-pointer text-xs min-h-[44px]"
          >
            <Plus size={16} className="stroke-[2.5]" />
            <span>Create Contact</span>
          </button>
        </div>
      </div>

      {/* 2. Top Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div 
          onClick={() => setActiveTab('all')}
          className={`bg-white border rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] select-none cursor-pointer transition-all ${
            activeTab === 'all' ? 'border-[#76C442] ring-2 ring-[#76C442]/20' : 'border-[#E7E9ED] hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider">All Contacts</span>
            <Users size={16} className="text-[#76C442]" />
          </div>
          <div className="text-2xl font-black text-[#151A2D] mt-1">{counts.all}</div>
          <div className="text-[11px] text-[#737A86] mt-0.5">Active prospects & customers</div>
        </div>

        <div 
          onClick={() => setActiveTab('prospect')}
          className={`bg-white border rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] select-none cursor-pointer transition-all ${
            activeTab === 'prospect' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-[#E7E9ED] hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Prospects</span>
            <TrendingUp size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black text-[#151A2D] mt-1">{counts.prospects}</div>
          <div className="text-[11px] text-[#737A86] mt-0.5">Leads without approved jobs</div>
        </div>

        <div 
          onClick={() => setActiveTab('customer')}
          className={`bg-white border rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] select-none cursor-pointer transition-all ${
            activeTab === 'customer' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-[#E7E9ED] hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Customers</span>
            <Briefcase size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-[#151A2D] mt-1">{counts.customers}</div>
          <div className="text-[11px] text-[#737A86] mt-0.5">With historical jobs or invoices</div>
        </div>
      </div>

      {/* 3. Filter Tabs & Search Bar */}
      <div className="bg-white p-3.5 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E7E9ED] space-y-3">
        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E7E9ED] pb-3">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-[#151A2D] text-white'
                : 'text-[#737A86] hover:bg-[#F6F7F9] hover:text-[#171A1F]'
            }`}
          >
            <span>All</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-[#737A86]'
            }`}>{counts.all}</span>
          </button>

          <button
            onClick={() => setActiveTab('prospect')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'prospect'
                ? 'bg-amber-600 text-white'
                : 'text-[#737A86] hover:bg-[#F6F7F9] hover:text-[#171A1F]'
            }`}
          >
            <span>Prospects</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'prospect' ? 'bg-white/20 text-white' : 'bg-gray-100 text-[#737A86]'
            }`}>{counts.prospects}</span>
          </button>

          <button
            onClick={() => setActiveTab('customer')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'customer'
                ? 'bg-emerald-600 text-white'
                : 'text-[#737A86] hover:bg-[#F6F7F9] hover:text-[#171A1F]'
            }`}
          >
            <span>Customers</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'customer' ? 'bg-white/20 text-white' : 'bg-gray-100 text-[#737A86]'
            }`}>{counts.customers}</span>
          </button>

          <button
            onClick={() => setActiveTab('archived')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'archived'
                ? 'bg-gray-700 text-white'
                : 'text-[#737A86] hover:bg-[#F6F7F9] hover:text-[#171A1F]'
            }`}
          >
            <Archive size={12} />
            <span>Archived</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'archived' ? 'bg-white/20 text-white' : 'bg-gray-100 text-[#737A86]'
            }`}>{counts.archived}</span>
          </button>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737A86] w-4.5 h-4.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts by name, email, phone, address, or source..."
              className="w-full pl-9 pr-4 py-2 border border-[#E6E8EC] hover:border-[#737A86]/60 focus:border-[#76C442] focus:ring-2 focus:ring-[#76C442]/10 rounded-lg text-xs bg-[#F7F8FA] transition-all focus:outline-none placeholder-[#737A86]/50 font-medium"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider shrink-0">Sort:</span>
            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value)}
              className="px-2.5 py-2 border border-[#E6E8EC] rounded-lg text-xs bg-white text-[#171A1F] font-bold focus:outline-none focus:border-[#76C442] cursor-pointer"
            >
              <option value="Newest">Newest First</option>
              <option value="Name A–Z">Name (A–Z)</option>
              <option value="Most Jobs">Most Jobs</option>
              <option value="Most Opportunities">Most Opportunities</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Contacts Table / List Container */}
      <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E7E9ED] overflow-hidden">
        {loading && allContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#737A86]">
            <Loader2 className="w-9 h-9 animate-spin text-[#76C442]" />
            <span className="text-xs font-bold uppercase tracking-wider">Loading Contacts...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-red-500">
            <AlertCircle className="w-9 h-9" />
            <span className="text-xs font-bold uppercase tracking-wider">{error}</span>
            <button
              onClick={fetchContacts}
              className="mt-2 text-xs bg-[#151A2D] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#1f263e] transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <Users className="w-12 h-12 text-[#737A86]/40 mb-3 stroke-[1.5]" />
            <h3 className="text-sm font-bold text-[#171A1F] m-0">No Contacts Found</h3>
            <p className="text-xs text-[#737A86] max-w-sm mt-1 leading-relaxed">
              {searchQuery 
                ? `No contacts match your search query for "${searchQuery}".`
                : activeTab === 'archived'
                  ? 'No contacts have been archived.'
                  : 'Get started by creating your first contact or connecting Meta Lead Ads.'}
            </p>
            {!searchQuery && activeTab !== 'archived' && (
              <button
                onClick={handleCreateClick}
                className="mt-5 bg-[#151A2D] hover:bg-[#1f263e] text-white px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer min-h-[40px]"
              >
                Create First Contact
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            {loading && (
              <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
                <Loader2 className="w-8 h-8 animate-spin text-[#76C442]" />
              </div>
            )}
            
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-[#151A2D] text-white border-b border-[#111624] select-none text-[10px] font-bold uppercase tracking-wider">
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Phone</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Source</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3 text-center">Active Opportunities</th>
                    <th className="px-5 py-3 text-center">Jobs</th>
                    <th className="px-5 py-3">Created</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E9ED] text-xs font-semibold text-[#171A1F]">
                  {paginatedContacts.map((contact) => {
                    const initials = (contact.full_name || 'Contact')
                      .split(' ')
                      .filter(Boolean)
                      .map((n: string) => n[0])
                      .join('')
                      .toUpperCase()
                      .substring(0, 2) || 'C';

                    return (
                      <tr 
                        key={contact.id} 
                        className={`hover:bg-[#F6F7F9]/60 transition-colors ${contact.is_archived ? 'opacity-70 bg-gray-50/50' : ''}`}
                      >
                        {/* Name */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#151A2D] text-white flex items-center justify-center text-[10px] font-black select-none shrink-0 font-mono">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <Link 
                                to={`/contacts/${contact.id}`} 
                                className="font-extrabold text-[#171A1F] hover:text-[#76C442] hover:underline truncate block max-w-[180px]"
                              >
                                {contact.full_name || 'Unnamed Contact'}
                              </Link>
                              {contact.service_address && (
                                <div className="text-[10px] text-[#737A86] truncate max-w-[180px] font-normal mt-0.5">
                                  {contact.service_address}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="px-5 py-3 font-bold">
                          {contact.phone ? (
                            <a href={`tel:${contact.phone}`} className="hover:text-[#76C442] transition-colors whitespace-nowrap">
                              {contact.phone}
                            </a>
                          ) : (
                            <span className="text-[#737A86]/50 font-normal italic">--</span>
                          )}
                        </td>

                        {/* Email */}
                        <td className="px-5 py-3">
                          {contact.email ? (
                            <a href={`mailto:${contact.email}`} className="text-[#737A86] hover:text-[#171A1F] hover:underline truncate block max-w-[170px]">
                              {contact.email}
                            </a>
                          ) : (
                            <span className="text-[#737A86]/50 font-normal italic">--</span>
                          )}
                        </td>

                        {/* Source */}
                        <td className="px-5 py-3 whitespace-nowrap">
                          {renderSourceBadge(contact.source)}
                        </td>

                        {/* Type */}
                        <td className="px-5 py-3 whitespace-nowrap">
                          {renderTypeBadge(contact.contact_type, contact.is_archived)}
                        </td>

                        {/* Active Opportunities */}
                        <td className="px-5 py-3 text-center whitespace-nowrap">
                          {contact.activeOpportunitiesCount > 0 ? (
                            <Link 
                              to="/leads" 
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                            >
                              {contact.activeOpportunitiesCount} Active
                            </Link>
                          ) : (
                            <span className="text-[#737A86]/50 text-[11px] font-medium">0</span>
                          )}
                        </td>

                        {/* Jobs */}
                        <td className="px-5 py-3 text-center whitespace-nowrap">
                          <Link 
                            to={`/contacts/${contact.id}`}
                            className="inline-block bg-[#F6F7F9] border border-[#E7E9ED] px-2 py-0.5 rounded-lg text-[#151A2D] hover:border-[#76C442] hover:bg-[#76C442]/5 transition-all text-[10px] font-bold"
                          >
                            {contact.jobsCount} {contact.jobsCount === 1 ? 'Job' : 'Jobs'}
                          </Link>
                        </td>

                        {/* Created */}
                        <td className="px-5 py-3 text-[#737A86] text-[11px] whitespace-nowrap">
                          {formatDate(contact.created_at)}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3 text-right">
                          <div className="relative inline-block text-left">
                            <button
                              onClick={() => setActiveActionId(activeActionId === contact.id ? null : contact.id)}
                              className="p-1.5 rounded-lg hover:bg-[#F6F7F9] text-[#737A86] hover:text-[#171A1F] transition-all cursor-pointer font-extrabold text-sm"
                            >
                              ⋯
                            </button>
                            {activeActionId === contact.id && (
                              <>
                                <div className="fixed inset-0 z-30" onClick={() => setActiveActionId(null)} />
                                <div className="absolute right-0 mt-1 w-36 bg-white border border-[#E7E9ED] rounded-xl shadow-xl py-1 z-40 text-left font-bold text-xs text-[#171A1F]">
                                  <Link 
                                    to={`/contacts/${contact.id}`} 
                                    onClick={() => setActiveActionId(null)} 
                                    className="block px-4 py-2 hover:bg-[#F6F7F9] hover:text-[#76C442]"
                                  >
                                    View Profile
                                  </Link>
                                  <button 
                                    onClick={() => { handleEditClick(contact); setActiveActionId(null); }} 
                                    className="w-full text-left px-4 py-2 hover:bg-[#F6F7F9] hover:text-[#76C442] border-none bg-transparent cursor-pointer font-bold text-xs"
                                  >
                                    Edit Contact
                                  </button>
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

            {/* Mobile Cards Layout */}
            <div className="block lg:hidden space-y-3 p-3">
              {paginatedContacts.map((contact) => {
                const initials = (contact.full_name || 'Contact')
                  .split(' ')
                  .filter(Boolean)
                  .map((n: string) => n[0])
                  .join('')
                  .toUpperCase()
                  .substring(0, 2) || 'C';

                return (
                  <div key={contact.id} className="bg-white border border-[#E7E9ED] rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-3 relative">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-[#151A2D] text-white flex items-center justify-center text-xs font-black select-none shrink-0 font-mono">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <Link to={`/contacts/${contact.id}`} className="text-sm font-extrabold text-[#171A1F] hover:text-[#76C442] hover:underline block truncate">
                            {contact.full_name || 'Unnamed Contact'}
                          </Link>
                          <div className="flex items-center gap-1.5 mt-1">
                            {renderSourceBadge(contact.source)}
                            {renderTypeBadge(contact.contact_type, contact.is_archived)}
                          </div>
                        </div>
                      </div>

                      <div className="relative shrink-0">
                        <button 
                          onClick={() => setActiveActionId(activeActionId === contact.id ? null : contact.id)}
                          className="p-1 rounded-lg hover:bg-[#F6F7F9] text-[#737A86] hover:text-[#171A1F] min-w-[36px] min-h-[36px] flex items-center justify-center border-none bg-transparent"
                        >
                          <span className="font-extrabold text-sm">⋯</span>
                        </button>
                        {activeActionId === contact.id && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setActiveActionId(null)} />
                            <div className="absolute right-0 mt-1 w-36 bg-white border border-[#E7E9ED] rounded-xl shadow-lg py-1.5 z-40 text-left font-bold text-xs text-[#171A1F]">
                              <Link to={`/contacts/${contact.id}`} onClick={() => setActiveActionId(null)} className="block px-4 py-2 hover:bg-[#F6F7F9] hover:text-[#76C442]">View Profile</Link>
                              <button onClick={() => { handleEditClick(contact); setActiveActionId(null); }} className="w-full text-left px-4 py-2 hover:bg-[#F6F7F9] hover:text-[#76C442] border-none bg-transparent cursor-pointer font-bold text-xs">Edit Contact</button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-[#E7E9ED]/50 text-xs text-[#171A1F] font-semibold">
                      {contact.phone && (
                        <div className="flex items-center gap-2">
                          <Phone size={12} className="text-[#737A86]" />
                          <a href={`tel:${contact.phone}`} className="hover:underline">{contact.phone}</a>
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex items-center gap-2">
                          <Mail size={12} className="text-[#737A86]" />
                          <a href={`mailto:${contact.email}`} className="text-[#737A86] truncate hover:underline">{contact.email}</a>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-[#E7E9ED]/50 text-[10px] font-bold">
                      <div className="flex items-center gap-2">
                        <span className="bg-[#F6F7F9] px-2 py-0.5 border border-[#E7E9ED] rounded-lg text-[#171A1F]">
                          {contact.jobsCount} {contact.jobsCount === 1 ? 'Job' : 'Jobs'}
                        </span>
                        {contact.activeOpportunitiesCount > 0 && (
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg">
                            {contact.activeOpportunitiesCount} Opp
                          </span>
                        )}
                      </div>
                      <div className="text-[#737A86]">
                        {formatDate(contact.created_at)}
                      </div>
                    </div>

                    <Link 
                      to={`/contacts/${contact.id}`}
                      className="mt-2 block w-full text-center bg-[#F6F7F9] hover:bg-[#76C442]/10 text-xs font-bold py-2 border border-[#E7E9ED] rounded-lg text-[#151A2D] transition-colors min-h-[38px] flex items-center justify-center"
                    >
                      View Contact Profile →
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && !error && filteredContacts.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#E7E9ED] px-5 py-4 bg-[#F6F7F9] select-none text-xs font-bold">
            <span className="text-[#737A86]">
              Showing <span className="text-[#171A1F] font-black">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
              <span className="text-[#171A1F] font-black">
                {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)}
              </span>{' '}
              of <span className="text-[#171A1F] font-black">{totalCount}</span> contacts
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

      {/* Contact Modal (Create & Edit) */}
      <CreateCustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchContacts}
        customerToEdit={contactToEdit}
      />

      {/* Import Contacts CSV Modal */}
      <ImportContactsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={fetchContacts}
      />
    </div>
  );
};
