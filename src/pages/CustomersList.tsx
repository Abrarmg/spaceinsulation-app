import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Badge, Button, EmptyState, Page, PageHeader } from '../components/ui';
import { Avatar, FilterSelect, ListLoading, ListPanel, MobileList, MobileRow, OverflowMenu, SearchInput, StatusTabs, T } from '../components/ui/list';
import { useOpenOnNewParam } from '../hooks/useOpenOnNewParam';
import { supabase } from '../supabaseClient';
import { CreateCustomerModal } from '../components/CreateCustomerModal';
import { ImportContactsModal } from '../components/ImportContactsModal';
import { DeleteContactModal } from '../components/DeleteContactModal';
import { Plus, Upload, ChevronLeft, ChevronRight, AlertCircle, Users, Check, Trash2, Eye, Pencil } from 'lucide-react';

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
  inquiry_date?: string | null;
  customer_needs?: string[] | null;
  square_footage?: number | null;
  asked_about_rebate?: boolean | null;
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
  const location = useLocation();
  const navigate = useNavigate();
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ContactWithCRM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSort, setSelectedSort] = useState('Newest');

  // Handle toast message from navigation (e.g. after deletion)
  useEffect(() => {
    if (location.state?.toastMessage) {
      setToastMessage(location.state.toastMessage);
      window.history.replaceState({}, document.title);
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  useOpenOnNewParam(() => { setContactToEdit(null); setIsModalOpen(true); });

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
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const SOURCE_LABELS: Record<string, { label: string; className: string }> = {
    facebook: { label: 'Facebook', className: 'bg-[#1877F2]/10 text-[#1877F2]' },
    csv_import: { label: 'CSV import', className: 'bg-purple-50 text-purple-700' },
    existing_customer: { label: 'Existing', className: 'bg-teal-50 text-teal-700' },
    manual: { label: 'Added by hand', className: 'bg-mist text-ink-soft' },
  };

  const renderSourceBadge = (source?: string) => {
    const s = SOURCE_LABELS[source || 'manual'] || SOURCE_LABELS.manual;
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold whitespace-nowrap ${s.className}`}>{s.label}</span>;
  };

  const renderTypeBadge = (type?: string, isArchived?: boolean) => {
    if (isArchived) return <Badge tone="neutral">Archived</Badge>;
    if (type === 'customer') return <Badge tone="green">Customer</Badge>;
    return <Badge tone="amber">Prospect</Badge>;
  };

  const rowActions = (contact: ContactWithCRM) => (
    <div onClick={e => e.stopPropagation()}>
      <OverflowMenu
        label="Contact actions"
        actions={[
          { label: 'View profile', icon: Eye, onClick: () => navigate(`/contacts/${contact.id}`) },
          { label: 'Edit contact', icon: Pencil, onClick: () => handleEditClick(contact) },
          { label: 'Delete or archive', icon: Trash2, onClick: () => setContactToDelete(contact), danger: true },
        ]}
      />
    </div>
  );

  const tabs: { value: FilterTab; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'prospect', label: 'Prospects', count: counts.prospects },
    { value: 'customer', label: 'Customers', count: counts.customers },
    { value: 'archived', label: 'Archived', count: counts.archived },
  ];

  return (
    <Page>
      <PageHeader
        title="Contacts"
        subtitle="Everyone you've quoted, worked for, or heard from."
        actions={
          <>
            <Button variant="secondary" icon={Upload} onClick={() => setIsImportModalOpen(true)}>
              <span className="hidden sm:inline">Import CSV</span>
              <span className="sm:hidden">Import</span>
            </Button>
            <Button icon={Plus} onClick={handleCreateClick}>
              New contact
            </Button>
          </>
        }
      />

      <ListPanel
        tabs={<StatusTabs<FilterTab> tabs={tabs} value={activeTab} onChange={setActiveTab} />}
        toolbar={
          <>
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search by name, email, phone or address" />
            <FilterSelect value={selectedSort} onChange={e => setSelectedSort(e.target.value)} aria-label="Sort contacts">
              <option value="Newest">Newest first</option>
              <option value="Name A–Z">Name (A–Z)</option>
              <option value="Most Jobs">Most jobs</option>
              <option value="Most Opportunities">Most open leads</option>
            </FilterSelect>
          </>
        }
        footer={
          !loading && !error && totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3 text-xs text-muted">
              <span>
                {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount} contacts
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                  className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-line bg-white text-navy hover:bg-mist disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-navy font-medium">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                  className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-line bg-white text-navy hover:bg-mist disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ) : undefined
        }
      >
        {loading && allContacts.length === 0 ? (
          <ListLoading label="Loading contacts…" />
        ) : error ? (
          <EmptyState
            icon={AlertCircle}
            title="Couldn't load contacts"
            description={error}
            action={<Button variant="secondary" onClick={fetchContacts}>Try again</Button>}
          />
        ) : filteredContacts.length === 0 ? (
          <EmptyState
            icon={Users}
            title={searchQuery ? 'No contacts match' : activeTab === 'archived' ? 'No archived contacts' : 'No contacts yet'}
            description={
              searchQuery
                ? `Nothing matches "${searchQuery}".`
                : activeTab === 'archived'
                  ? 'Contacts you archive will be kept here.'
                  : 'Add your first contact, import a CSV, or connect Facebook Lead Ads.'
            }
            action={!searchQuery && activeTab !== 'archived' ? <Button icon={Plus} onClick={handleCreateClick}>New contact</Button> : undefined}
          />
        ) : (
          <div className={loading ? 'opacity-60 transition-opacity' : ''}>
            <div className={T.wrap}>
              <table className={T.table}>
                <thead className={T.thead}>
                  <tr>
                    <th className={T.th}>Name</th>
                    <th className={T.th}>Contact</th>
                    <th className={T.th}>Type</th>
                    <th className={`${T.th} hidden lg:table-cell`}>Source</th>
                    <th className={`${T.th} text-center`}>Jobs</th>
                    <th className={`${T.th} hidden xl:table-cell`}>Added</th>
                    <th className={`${T.th} w-14`}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedContacts.map(contact => (
                    <tr
                      key={contact.id}
                      onClick={() => navigate(`/contacts/${contact.id}`)}
                      className={`${T.tr} ${contact.is_archived ? 'opacity-70' : ''}`}
                    >
                      <td className={T.td}>
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={contact.full_name} />
                          <div className="min-w-0">
                            <div className="font-semibold truncate max-w-[220px]">{contact.full_name || 'Unnamed contact'}</div>
                            {contact.service_address && <div className="text-xs text-muted truncate max-w-[220px]">{contact.service_address}</div>}
                          </div>
                        </div>
                      </td>
                      <td className={T.td} onClick={e => e.stopPropagation()}>
                        {contact.phone ? (
                          <a href={`tel:${contact.phone}`} className="block text-navy no-underline hover:underline whitespace-nowrap">
                            {contact.phone}
                          </a>
                        ) : null}
                        {contact.email ? (
                          <a href={`mailto:${contact.email}`} className="block text-xs text-muted no-underline hover:underline truncate max-w-[200px]">
                            {contact.email}
                          </a>
                        ) : null}
                        {!contact.phone && !contact.email && <span className="text-muted">—</span>}
                      </td>
                      <td className={T.td}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {renderTypeBadge(contact.contact_type, contact.is_archived)}
                          {contact.activeOpportunitiesCount > 0 && <Badge tone="blue">{contact.activeOpportunitiesCount} open lead{contact.activeOpportunitiesCount > 1 ? 's' : ''}</Badge>}
                        </div>
                      </td>
                      <td className={`${T.td} hidden lg:table-cell`}>{renderSourceBadge(contact.source)}</td>
                      <td className={`${T.td} text-center font-medium`}>{contact.jobsCount}</td>
                      <td className={`${T.td} hidden xl:table-cell text-xs text-muted whitespace-nowrap`}>{formatDate(contact.created_at)}</td>
                      <td className={`${T.td} text-right`}>{rowActions(contact)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <MobileList>
              {paginatedContacts.map(contact => (
                <MobileRow
                  key={contact.id}
                  to={`/contacts/${contact.id}`}
                  leading={<Avatar name={contact.full_name} />}
                  title={contact.full_name || 'Unnamed contact'}
                  subtitle={contact.phone || contact.email || contact.service_address || 'No contact details'}
                  right={renderTypeBadge(contact.contact_type, contact.is_archived)}
                  meta={
                    <>
                      <span>
                        {contact.jobsCount} {contact.jobsCount === 1 ? 'job' : 'jobs'}
                      </span>
                      {contact.activeOpportunitiesCount > 0 && <span className="text-blue-700">{contact.activeOpportunitiesCount} open lead{contact.activeOpportunitiesCount > 1 ? 's' : ''}</span>}
                      {renderSourceBadge(contact.source)}
                    </>
                  }
                />
              ))}
            </MobileList>
          </div>
        )}
      </ListPanel>

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

      {/* Delete Contact Modal */}
      {contactToDelete && (
        <DeleteContactModal
          isOpen={Boolean(contactToDelete)}
          onClose={() => setContactToDelete(null)}
          contactId={contactToDelete.id}
          contactName={contactToDelete.full_name || 'Contact'}
          onDeleted={() => {
            setToastMessage('Contact deleted successfully.');
            setTimeout(() => setToastMessage(null), 4000);
            fetchContacts();
          }}
          onArchived={(isArchived) => {
            setToastMessage(isArchived ? 'Contact archived successfully.' : 'Contact restored successfully.');
            setTimeout(() => setToastMessage(null), 4000);
            fetchContacts();
          }}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-navy text-white px-4 py-3 rounded-xl shadow-pop flex items-center gap-2 text-sm font-medium animate-slide-up">
          <Check size={16} className="text-brand stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </Page>
  );
};
