import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { 
  Inbox, 
  Loader2, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  Phone, 
  Mail, 
  Calendar, 
  MoreVertical, 
  User, 
  ExternalLink,
  ChevronRight
} from "lucide-react";

interface Lead {
  id: string;
  facebook_lead_id: string | null;
  facebook_page_id: string | null;
  facebook_form_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string | null;
  pipeline_stage: string | null;
  customer_id?: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
}

type FilterTab = 'all' | 'new';

export const Leads: React.FC = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const fetchLeads = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const { data, error: fetchErr } = await supabase
        .from("leads")
        .select("*")
        .order("received_at", { ascending: false });

      if (fetchErr) {
        throw fetchErr;
      }

      setLeads((data as Lead[]) || []);
    } catch (err: any) {
      console.error("Error fetching leads:", err);
      setError(err?.message || "Failed to load leads. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Close active dropdown menu when clicking elsewhere
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuId(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "—";
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(date);
    } catch {
      return "—";
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name || !name.trim()) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const formatStatus = (status: string | null | undefined) => {
    if (!status) return "New";
    const lower = status.toLowerCase();
    if (lower === "new") return "New";
    if (lower === "approved") return "Approved";
    if (lower === "contacted") return "Contacted";
    if (lower === "qualified") return "Qualified";
    if (lower === "lost") return "Lost";
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Filter & Search Logic
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // 1. Tab filter
      if (activeTab === "new") {
        const isNew = (lead.status || "new").toLowerCase() === "new";
        if (!isNew) return false;
      }

      // 2. Search query filter (name, phone, email)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (lead.name || "").toLowerCase().includes(q);
        const phoneMatch = (lead.phone || "").toLowerCase().includes(q);
        const emailMatch = (lead.email || "").toLowerCase().includes(q);
        return nameMatch || phoneMatch || emailMatch;
      }

      return true;
    });
  }, [leads, activeTab, searchQuery]);

  const newLeadsCount = useMemo(() => {
    return leads.filter((l) => (l.status || "new").toLowerCase() === "new").length;
  }, [leads]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)] bg-[#F5F5F5] pb-16">
      {/* 1. Page Header */}
      <div className="bg-white border-b border-[#E7E9ED] px-4 md:px-8 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#151A2D] flex items-center justify-center text-white shadow-xs shrink-0">
              <Inbox size={20} className="text-[#76C442]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-black text-[#151A2D] tracking-tight uppercase m-0">
                  LEADS
                </h1>
              </div>
              <p className="text-xs text-[#737A86] mt-0.5 font-medium">
                Manage and follow up with incoming leads.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            {/* Compact Counter */}
            <div className="flex items-center gap-2 bg-[#F6F7F9] border border-[#E7E9ED] rounded-xl px-3.5 py-1.5 shadow-2xs">
              <span className="text-[11px] font-bold text-[#737A86] uppercase tracking-wider">
                Total Leads
              </span>
              <span className="text-xs font-black text-[#151A2D] bg-white px-2 py-0.5 rounded-md border border-[#E7E9ED]">
                {leads.length}
              </span>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchLeads(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E7E9ED] hover:bg-[#F6F7F9] text-xs font-bold text-[#151A2D] transition-colors cursor-pointer shadow-xs disabled:opacity-60"
              title="Refresh leads list"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin text-[#76C442]" : "text-[#737A86]"} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Content Container */}
      <div className="max-w-7xl mx-auto w-full px-4 md:px-8 pt-6 space-y-4">
        {/* Search Bar & Minimal Filter Tabs */}
        <div className="bg-white p-3.5 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E7E9ED] space-y-3">
          {/* Filter Tabs */}
          <div className="flex items-center gap-2 border-b border-[#E7E9ED] pb-3">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "all"
                  ? "bg-[#151A2D] text-white"
                  : "text-[#737A86] hover:bg-[#F6F7F9] hover:text-[#171A1F]"
              }`}
            >
              <span>All Leads</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === "all" ? "bg-white/20 text-white" : "bg-gray-100 text-[#737A86]"
              }`}>
                {leads.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("new")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "new"
                  ? "bg-[#16A34A] text-white"
                  : "text-[#737A86] hover:bg-[#F6F7F9] hover:text-[#171A1F]"
              }`}
            >
              <span>New</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === "new" ? "bg-white/20 text-white" : "bg-gray-100 text-[#737A86]"
              }`}>
                {newLeadsCount}
              </span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737A86] w-4.5 h-4.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leads by name, phone, or email..."
              className="w-full pl-9 pr-4 py-2.5 border border-[#E6E8EC] hover:border-[#737A86]/60 focus:border-[#76C442] focus:ring-2 focus:ring-[#76C442]/10 rounded-lg text-xs bg-[#F7F8FA] transition-all focus:outline-none placeholder-[#737A86]/60 font-medium"
            />
          </div>
        </div>

        {/* 3. Table / Cards View */}
        <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E7E9ED] overflow-hidden">
          {loading && leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#737A86]">
              <Loader2 className="w-8 h-8 animate-spin text-[#76C442]" />
              <span className="text-xs font-bold uppercase tracking-wider">Loading Leads...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-red-500">
              <AlertCircle className="w-9 h-9" />
              <span className="text-xs font-bold uppercase tracking-wider">{error}</span>
              <button
                type="button"
                onClick={() => fetchLeads()}
                className="mt-2 text-xs bg-[#151A2D] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#1f263e] transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <Inbox className="w-12 h-12 text-[#737A86]/40 mb-3 stroke-[1.5]" />
              <h3 className="text-sm font-bold text-[#171A1F] m-0">No Leads Found</h3>
              <p className="text-xs text-[#737A86] max-w-sm mt-1 leading-relaxed">
                {searchQuery
                  ? `No leads match your search for "${searchQuery}".`
                  : activeTab === "new"
                  ? "There are currently no new unreviewed leads."
                  : "Incoming Meta and website leads will appear here."}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mt-4 text-xs font-bold text-[#151A2D] hover:underline cursor-pointer"
                >
                  Clear search query
                </button>
              )}
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE (Hidden on mobile) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E7E9ED] bg-[#F9FAFB] text-[10px] font-black uppercase tracking-wider text-[#737A86]">
                      <th className="py-3 px-4">Lead</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Source</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Received</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E9ED] text-xs">
                    {filteredLeads.map((lead) => {
                      const hasName = Boolean(lead.name && lead.name.trim());
                      const hasPhone = Boolean(lead.phone && lead.phone.trim());
                      const hasEmail = Boolean(lead.email && lead.email.trim());
                      const initials = getInitials(lead.name);
                      const isNew = (lead.status || "new").toLowerCase() === "new";

                      return (
                        <tr
                          key={lead.id}
                          onClick={() => navigate(`/leads/${lead.id}`)}
                          className="hover:bg-[#F9FAFB] transition-colors cursor-pointer group"
                        >
                          {/* 1. LEAD (Avatar + Name) */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#151A2D] text-white flex items-center justify-center text-xs font-black shrink-0 font-mono shadow-2xs group-hover:scale-105 transition-transform">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-[#151A2D] group-hover:text-[#76C442] transition-colors block truncate">
                                  {hasName ? lead.name : "Unknown Lead"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 2. PHONE */}
                          <td className="py-3.5 px-4 text-slate-700">
                            {hasPhone ? (
                              <a
                                href={`tel:${lead.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="font-medium text-slate-700 hover:text-[#76C442] hover:underline transition-colors"
                              >
                                {lead.phone}
                              </a>
                            ) : (
                              <span className="text-slate-400 font-normal">—</span>
                            )}
                          </td>

                          {/* 3. EMAIL */}
                          <td className="py-3.5 px-4 text-slate-700">
                            {hasEmail ? (
                              <a
                                href={`mailto:${lead.email}`}
                                onClick={(e) => e.stopPropagation()}
                                className="font-medium text-slate-700 hover:text-[#76C442] hover:underline transition-colors truncate max-w-[200px] inline-block align-middle"
                              >
                                {lead.email}
                              </a>
                            ) : (
                              <span className="text-slate-400 font-normal">—</span>
                            )}
                          </td>

                          {/* 4. SOURCE */}
                          <td className="py-3.5 px-4">
                            {lead.source?.toLowerCase() === "facebook" ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20">
                                <svg className="w-2.5 h-2.5 fill-current shrink-0" viewBox="0 0 24 24">
                                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                </svg>
                                Facebook
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-slate-600 capitalize">
                                {lead.source || "—"}
                              </span>
                            )}
                          </td>

                          {/* 5. STATUS */}
                          <td className="py-3.5 px-4">
                            {isNew ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-[#22C55E]/10 text-[#16A34A] border border-[#22C55E]/30 tracking-wider uppercase">
                                New
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                                {formatStatus(lead.status)}
                              </span>
                            )}
                          </td>

                          {/* 6. RECEIVED */}
                          <td className="py-3.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                            {formatDateTime(lead.received_at)}
                          </td>

                          {/* 7. ACTIONS */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setActiveMenuId(activeMenuId === lead.id ? null : lead.id)}
                                className="p-1.5 rounded-lg hover:bg-[#E7E9ED] text-[#737A86] hover:text-[#151A2D] transition-colors cursor-pointer"
                                title="Lead actions"
                              >
                                <MoreVertical size={14} />
                              </button>

                              {activeMenuId === lead.id && (
                                <div className="absolute right-0 mt-1 w-36 bg-white rounded-xl shadow-lg border border-[#E7E9ED] py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      navigate(`/leads/${lead.id}`);
                                    }}
                                    className="w-full text-left px-3.5 py-1.5 text-xs font-bold text-[#151A2D] hover:bg-[#F6F7F9] flex items-center justify-between transition-colors cursor-pointer"
                                  >
                                    <span>View Lead</span>
                                    <ChevronRight size={13} className="text-[#737A86]" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARDS (Visible on mobile only, md:hidden) */}
              <div className="md:hidden divide-y divide-[#E7E9ED]">
                {filteredLeads.map((lead) => {
                  const hasName = Boolean(lead.name && lead.name.trim());
                  const hasPhone = Boolean(lead.phone && lead.phone.trim());
                  const hasEmail = Boolean(lead.email && lead.email.trim());
                  const initials = getInitials(lead.name);
                  const isNew = (lead.status || "new").toLowerCase() === "new";

                  return (
                    <div
                      key={lead.id}
                      onClick={() => navigate(`/leads/${lead.id}`)}
                      className="p-4 space-y-3 hover:bg-[#F9FAFB] active:bg-[#F0F2F5] transition-colors cursor-pointer"
                    >
                      {/* Top: Avatar, Name, Status */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-[#151A2D] text-white flex items-center justify-center text-xs font-black shrink-0 font-mono shadow-2xs">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-sm text-[#151A2D] block truncate">
                              {hasName ? lead.name : "Unknown Lead"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isNew ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-[#22C55E]/10 text-[#16A34A] border border-[#22C55E]/30 tracking-wider uppercase">
                              New
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                              {formatStatus(lead.status)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Contact Details */}
                      <div className="space-y-1.5 text-xs text-slate-700 pl-12">
                        {hasPhone ? (
                          <div className="flex items-center gap-2">
                            <Phone size={12} className="text-[#737A86] shrink-0" />
                            <a
                              href={`tel:${lead.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-medium text-slate-700 hover:text-[#76C442]"
                            >
                              {lead.phone}
                            </a>
                          </div>
                        ) : null}

                        {hasEmail ? (
                          <div className="flex items-center gap-2">
                            <Mail size={12} className="text-[#737A86] shrink-0" />
                            <a
                              href={`mailto:${lead.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-medium text-slate-700 hover:text-[#76C442] truncate"
                            >
                              {lead.email}
                            </a>
                          </div>
                        ) : null}
                      </div>

                      {/* Footer: Source, Date, Button */}
                      <div className="flex items-center justify-between pt-1 border-t border-[#F0F2F5] text-[11px] text-[#737A86]">
                        <div className="flex items-center gap-2">
                          {lead.source?.toLowerCase() === "facebook" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20">
                              <svg className="w-2 h-2 fill-current shrink-0" viewBox="0 0 24 24">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                              </svg>
                              Facebook
                            </span>
                          ) : (
                            <span className="capitalize">{lead.source || "—"}</span>
                          )}
                          <span>•</span>
                          <span>{formatDateTime(lead.received_at)}</span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/leads/${lead.id}`);
                          }}
                          className="inline-flex items-center gap-1 font-bold text-[#151A2D] hover:text-[#76C442] cursor-pointer"
                        >
                          <span>View</span>
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
