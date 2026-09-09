import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { 
  AlertTriangle, 
  ShieldAlert, 
  Archive, 
  Trash2, 
  X, 
  Loader2, 
  FileText, 
  Briefcase, 
  Receipt, 
  TrendingUp, 
  ClipboardCheck 
} from 'lucide-react';

interface DeleteContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactId: string;
  contactName: string;
  onDeleted: () => void;
  onArchived: (isArchived: boolean) => void;
}

interface DependencyCounts {
  jobs: number;
  invoices: number;
  leads: number;
  assessments: number;
  quotes: number;
}

export const DeleteContactModal: React.FC<DeleteContactModalProps> = ({
  isOpen,
  onClose,
  contactId,
  contactName,
  onDeleted,
  onArchived
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<DependencyCounts>({
    jobs: 0,
    invoices: 0,
    leads: 0,
    assessments: 0,
    quotes: 0
  });
  const [canDelete, setCanDelete] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch dependency counts when modal opens
  const fetchDependencyCheck = useCallback(async () => {
    if (!contactId || !isOpen) return;

    setLoading(true);
    setError(null);
    setConfirmInput('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token;

      let serverData: any = null;
      try {
        const res = await fetch('/api/contacts/delete-check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify({ contactId, auth_token: authToken })
        });

        if (res.ok) {
          serverData = await res.json();
        } else if (res.status !== 404) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Server returned ${res.status}`);
        }
      } catch (fetchErr: any) {
        if (!fetchErr.message?.includes('404')) {
          console.warn('[delete-check] Serverless call error, falling back to direct query:', fetchErr.message);
        }
      }

      if (serverData?.success && serverData?.counts) {
        setCounts(serverData.counts);
        setCanDelete(Boolean(serverData.canDelete));
      } else {
        // Direct query fallback via Supabase client
        const [jobsRes, invoicesRes, leadsRes, assessmentsRes, estimatesRes] = await Promise.all([
          supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('customer_id', contactId),
          supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('customer_id', contactId),
          supabase.from('leads').select('id', { count: 'exact', head: true }).eq('customer_id', contactId),
          supabase.from('assessments').select('id', { count: 'exact', head: true }).eq('customer_id', contactId),
          supabase.from('estimates').select('id', { count: 'exact', head: true }).eq('customer_id', contactId),
        ]);

        const jCount = jobsRes.count || 0;
        const iCount = invoicesRes.count || 0;
        const lCount = leadsRes.count || 0;
        const aCount = assessmentsRes.count || 0;
        const eCount = estimatesRes.count || 0;

        setCounts({
          jobs: jCount,
          invoices: iCount,
          leads: lCount,
          assessments: aCount,
          quotes: eCount
        });
        setCanDelete(jCount === 0 && iCount === 0);
      }
    } catch (err: any) {
      console.error('[delete-check] Error performing dependency check:', err);
      setError(err.message || 'Failed to check contact dependencies.');
    } finally {
      setLoading(false);
    }
  }, [contactId, isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchDependencyCheck();
    }
  }, [isOpen, fetchDependencyCheck]);

  if (!isOpen) return null;

  // Handle Archive Contact
  const handleArchive = async () => {
    setActionLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token;

      let success = false;
      try {
        const res = await fetch('/api/contacts/archive', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify({ contactId, is_archived: true, auth_token: authToken })
        });

        if (res.ok) {
          success = true;
        } else if (res.status !== 404) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'Server failed to archive contact.');
        }
      } catch (fetchErr: any) {
        if (!fetchErr.message?.includes('404')) {
          throw fetchErr;
        }
      }

      if (!success) {
        // Fallback update
        const { error: updateErr } = await supabase
          .from('customers')
          .update({ is_archived: true, updated_at: new Date().toISOString() })
          .eq('id', contactId);

        if (updateErr) throw updateErr;
      }

      onArchived(true);
      onClose();
    } catch (err: any) {
      console.error('[delete-modal] Error archiving contact:', err);
      setError(err.message || 'Failed to archive contact.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Hard Delete Contact
  const handlePermanentDelete = async () => {
    if (confirmInput.trim() !== 'DELETE' || !canDelete) return;

    setActionLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token;

      let success = false;
      try {
        const res = await fetch('/api/contacts/delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify({ contactId, auth_token: authToken })
        });

        if (res.ok) {
          success = true;
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'Server rejected contact deletion.');
        }
      } catch (fetchErr: any) {
        if (!fetchErr.message?.includes('404')) {
          throw fetchErr;
        }
      }

      if (!success) {
        // Direct deletion fallback with safety check
        const [jCheck, iCheck] = await Promise.all([
          supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('customer_id', contactId),
          supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('customer_id', contactId),
        ]);

        if ((jCheck.count || 0) > 0 || (iCheck.count || 0) > 0) {
          throw new Error('Deletion blocked: Contact has historical jobs or invoices.');
        }

        const { error: delErr } = await supabase
          .from('customers')
          .delete()
          .eq('id', contactId);

        if (delErr) throw delErr;
      }

      onDeleted();
      onClose();
    } catch (err: any) {
      console.error('[delete-modal] Error deleting contact:', err);
      setError(err.message || 'Failed to delete contact.');
    } finally {
      setActionLoading(false);
    }
  };

  const hasHistoricalRecords = counts.jobs > 0 || counts.invoices > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div 
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-[#E7E9ED] overflow-hidden animate-in fade-in zoom-in duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className={`p-5 flex items-center justify-between border-b ${hasHistoricalRecords ? 'bg-amber-50/70 border-amber-200' : 'bg-red-50/70 border-red-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${hasHistoricalRecords ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
              {hasHistoricalRecords ? <ShieldAlert size={22} className="stroke-[2.5]" /> : <AlertTriangle size={22} className="stroke-[2.5]" />}
            </div>
            <div>
              <h2 className="text-base font-black text-[#151A2D] m-0">
                {hasHistoricalRecords ? 'Cannot Delete Contact' : 'Delete Contact?'}
              </h2>
              <p className="text-xs text-[#737A86] font-medium m-0 mt-0.5">
                {contactName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={actionLoading}
            className="p-1 rounded-lg hover:bg-black/5 text-[#737A86] hover:text-[#171A1F] transition-colors cursor-pointer border-none bg-transparent"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-[#737A86]">
              <Loader2 className="w-8 h-8 animate-spin text-[#76C442]" />
              <span className="text-xs font-bold uppercase tracking-wider">Checking record dependencies...</span>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-start gap-2">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* STATE A: JOBS OR INVOICES EXIST (BLOCKED) */}
              {hasHistoricalRecords ? (
                <div className="space-y-4">
                  <div className="text-xs text-[#171A1F] leading-relaxed font-medium">
                    This contact has historical business records that cannot be permanently deleted:
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-[#F6F7F9] border border-[#E7E9ED] flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                        <Briefcase size={16} />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-[#737A86]">Jobs</div>
                        <div className="text-lg font-black text-[#171A1F]">{counts.jobs}</div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#F6F7F9] border border-[#E7E9ED] flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        <Receipt size={16} />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-[#737A86]">Invoices</div>
                        <div className="text-lg font-black text-[#171A1F]">{counts.invoices}</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed font-medium">
                    <strong>Protection Rule:</strong> Deleting this contact could break financial or operational history. Instead of deleting, you can <strong>Archive</strong> this contact to remove them from active views while preserving all operational records.
                  </div>
                </div>
              ) : (
                /* STATE B: NO JOBS OR INVOICES (SAFE HARD DELETION) */
                <div className="space-y-4">
                  <div className="text-xs text-[#171A1F] leading-relaxed">
                    This action will permanently delete <strong className="text-[#151A2D] font-black">{contactName}</strong> from Contacts.
                  </div>

                  {/* Pre-sales dependency overview */}
                  <div className="p-3.5 bg-[#F6F7F9] border border-[#E7E9ED] rounded-xl space-y-2.5">
                    <div className="text-[11px] font-bold text-[#737A86] uppercase tracking-wider">
                      Related Pre-Sales Records (Will NOT be deleted)
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white p-2.5 rounded-lg border border-[#E7E9ED]">
                        <div className="text-xs font-bold text-[#737A86] flex items-center justify-center gap-1">
                          <TrendingUp size={12} className="text-blue-500" />
                          <span>Opportunities</span>
                        </div>
                        <div className="text-base font-black text-[#171A1F] mt-1">{counts.leads}</div>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-[#E7E9ED]">
                        <div className="text-xs font-bold text-[#737A86] flex items-center justify-center gap-1">
                          <ClipboardCheck size={12} className="text-purple-500" />
                          <span>Assessments</span>
                        </div>
                        <div className="text-base font-black text-[#171A1F] mt-1">{counts.assessments}</div>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-[#E7E9ED]">
                        <div className="text-xs font-bold text-[#737A86] flex items-center justify-center gap-1">
                          <FileText size={12} className="text-amber-500" />
                          <span>Quotes</span>
                        </div>
                        <div className="text-base font-black text-[#171A1F] mt-1">{counts.quotes}</div>
                      </div>
                    </div>

                    <div className="text-[11px] text-[#737A86] leading-relaxed font-medium pt-1">
                      Their Contact link will be safely unlinked (<code className="bg-white px-1 py-0.5 rounded text-[#151A2D] font-bold">customer_id = NULL</code>), but the opportunities, assessments, and quotes will remain in the system.
                    </div>
                  </div>

                  {/* Require typing DELETE */}
                  <div className="space-y-2 pt-1">
                    <label className="block text-xs font-bold text-[#171A1F]">
                      To confirm permanent deletion, type <span className="text-red-600 font-mono font-black">DELETE</span> below:
                    </label>
                    <input
                      type="text"
                      value={confirmInput}
                      onChange={(e) => setConfirmInput(e.target.value)}
                      placeholder="DELETE"
                      className="w-full px-3.5 py-2.5 border border-[#E7E9ED] focus:border-red-500 focus:ring-2 focus:ring-red-500/10 rounded-xl text-xs font-mono font-bold tracking-wider uppercase text-[#171A1F] placeholder-gray-300 transition-all outline-none"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-[#F6F7F9] border-t border-[#E7E9ED] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={actionLoading}
            className="px-4 py-2 text-xs font-bold text-[#737A86] hover:text-[#171A1F] hover:bg-gray-200/50 rounded-lg transition-colors cursor-pointer border-none bg-transparent"
          >
            Cancel
          </button>

          {hasHistoricalRecords ? (
            /* Historical records present: Offer Archive Contact */
            <button
              type="button"
              onClick={handleArchive}
              disabled={actionLoading || loading}
              className="inline-flex items-center gap-2 px-5 py-2 bg-[#151A2D] hover:bg-[#20273f] text-white text-xs font-bold rounded-lg transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              {actionLoading ? (
                <Loader2 size={13} className="animate-spin text-[#76C442]" />
              ) : (
                <Archive size={13} />
              )}
              <span>Archive Contact</span>
            </button>
          ) : (
            /* Pre-sales only: Hard Delete Button */
            <button
              type="button"
              onClick={handlePermanentDelete}
              disabled={confirmInput.trim() !== 'DELETE' || actionLoading || loading || !canDelete}
              className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-lg transition-all cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {actionLoading ? (
                <Loader2 size={13} className="animate-spin text-white" />
              ) : (
                <Trash2 size={13} />
              )}
              <span>Permanently Delete Contact</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
