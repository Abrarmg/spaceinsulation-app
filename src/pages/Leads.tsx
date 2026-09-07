
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { Inbox, Loader2, AlertCircle, RefreshCw, Mail, Phone, User } from "lucide-react";

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
  received_at: string | null;
  created_at: string;
  updated_at: string;
}

export const Leads: React.FC = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from("leads")
        .select("*")
        .order("received_at", { ascending: false });

      if (fetchErr) {
        throw fetchErr;
      }

      setLeads(data || []);
    } catch (err: any) {
      console.error("Error fetching leads:", err);
      setError(err?.message || "Failed to load leads.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const formatReceivedDate = (dateStr: string | null | undefined) => {
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

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-black text-[#151A2D] tracking-tight m-0">Leads</h1>
            <span className="px-2 py-0.5 text-[11px] font-extrabold bg-[#151A2D]/10 text-[#151A2D] rounded-full">
              {leads.length}
            </span>
          </div>
          <p className="text-xs text-[#737A86] mt-1 font-medium">
            Manage and view incoming Facebook Lead Ads leads.
          </p>
        </div>

        <button
          onClick={fetchLeads}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-[#E7E9ED] rounded-xl text-xs font-bold text-[#151A2D] hover:bg-[#F6F7F9] transition-all cursor-pointer shadow-xs disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E7E9ED] overflow-hidden">
        {loading && leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#737A86]">
            <Loader2 className="w-8 h-8 animate-spin text-[#76C442]" />
            <span className="text-xs font-bold uppercase tracking-wider">Loading leads...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-red-500 text-center px-4">
            <AlertCircle className="w-8 h-8" />
            <span className="text-xs font-bold uppercase tracking-wider">{error}</span>
            <button
              onClick={fetchLeads}
              className="mt-2 text-xs bg-[#151A2D] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#1f263e] transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-[#151A2D]/5 flex items-center justify-center mb-3">
              <Inbox className="w-6 h-6 text-[#737A86]" />
            </div>
            <h3 className="text-sm font-bold text-[#171A1F] m-0">No Leads Yet</h3>
            <p className="text-xs text-[#737A86] max-w-sm mt-1 leading-relaxed">
              When prospective customers submit a connected Facebook Lead Ad form, their details will automatically appear here.
            </p>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-[#151A2D] text-white border-b border-[#111624] select-none text-[10px] font-bold uppercase tracking-wider">
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Phone</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Source</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Received Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E9ED] text-xs font-semibold text-[#171A1F]">
                  {leads.map((lead) => {
                    const hasName = Boolean(lead.name && lead.name.trim());
                    const hasPhone = Boolean(lead.phone && lead.phone.trim());
                    const hasEmail = Boolean(lead.email && lead.email.trim());

                    return (
                      <tr 
                        key={lead.id} 
                        onClick={() => navigate(`/leads/${lead.id}`)}
                        className="hover:bg-[#F6F7F9]/80 transition-colors cursor-pointer group"
                      >
                        {/* Name */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-[#151A2D]/5 flex items-center justify-center text-[#151A2D] shrink-0">
                              <User size={13} />
                            </div>
                            <span className={hasName ? "font-bold text-[#151A2D]" : "text-[#737A86]"}>
                              {hasName ? lead.name : "—"}
                            </span>
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="px-5 py-3.5 font-medium">
                          {hasPhone ? (
                            <span className="text-[#171A1F]">{lead.phone}</span>
                          ) : (
                            <span className="text-[#737A86] font-normal">—</span>
                          )}
                        </td>

                        {/* Email */}
                        <td className="px-5 py-3.5 font-medium">
                          {hasEmail ? (
                            <span className="text-[#171A1F]">{lead.email}</span>
                          ) : (
                            <span className="text-[#737A86] font-normal">—</span>
                          )}
                        </td>

                        {/* Source */}
                        <td className="px-5 py-3.5">
                          {lead.source?.toLowerCase() === "facebook" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20">
                              <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                              </svg>
                              Facebook
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200 capitalize">
                              {lead.source || "—"}
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          {lead.status?.toLowerCase() === "new" ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#22C55E]/10 text-[#16A34A] border border-[#22C55E]/30 tracking-wider uppercase">
                              New
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200 capitalize">
                              {lead.status || "—"}
                            </span>
                          )}
                        </td>

                        {/* Received Date */}
                        <td className="px-5 py-3.5 text-xs text-[#737A86] font-medium whitespace-nowrap">
                          {formatReceivedDate(lead.received_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden divide-y divide-[#E7E9ED]">
              {leads.map((lead) => {
                const hasName = Boolean(lead.name && lead.name.trim());
                const hasPhone = Boolean(lead.phone && lead.phone.trim());
                const hasEmail = Boolean(lead.email && lead.email.trim());

                return (
                  <div 
                    key={lead.id} 
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    className="p-4 space-y-2.5 hover:bg-[#F6F7F9]/80 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#151A2D]/5 flex items-center justify-center text-[#151A2D] shrink-0">
                          <User size={13} />
                        </div>
                        <span className={hasName ? "text-sm font-bold text-[#151A2D]" : "text-sm text-[#737A86]"}>
                          {hasName ? lead.name : "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {lead.status?.toLowerCase() === "new" ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-[#22C55E]/10 text-[#16A34A] border border-[#22C55E]/30 tracking-wider uppercase">
                            New
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-gray-100 text-gray-700 border border-gray-200 capitalize">
                            {lead.status || "—"}
                          </span>
                        )}
                        {lead.source?.toLowerCase() === "facebook" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20">
                            Facebook
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-xs space-y-1 text-[#171A1F] pl-9">
                      <div className="flex items-center gap-2">
                        <Phone size={12} className="text-[#737A86] shrink-0" />
                        <span className={hasPhone ? "" : "text-[#737A86]"}>
                          {hasPhone ? lead.phone : "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail size={12} className="text-[#737A86] shrink-0" />
                        <span className={hasEmail ? "break-all" : "text-[#737A86]"}>
                          {hasEmail ? lead.email : "—"}
                        </span>
                      </div>
                    </div>

                    <div className="text-[10px] text-[#737A86] pl-9 pt-1">
                      Received: {formatReceivedDate(lead.received_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
