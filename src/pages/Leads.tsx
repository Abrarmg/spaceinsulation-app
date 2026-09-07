import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { ScheduleAssessmentModal } from "../components/ScheduleAssessmentModal";
import { CompleteAssessmentModal } from "../components/CompleteAssessmentModal";
import { 
  Inbox, 
  Loader2, 
  AlertCircle, 
  RefreshCw, 
  Phone, 
  User, 
  Clock, 
  MoreVertical, 
  X, 
  Calendar, 
  FileText, 
  ExternalLink,
  Kanban,
  Sparkles,
  CheckCircle2
} from "lucide-react";

interface AssessmentInfo {
  id: string;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  notes: string | null;
  assigned_to: string | null;
  updated_at?: string | null;
  profiles: {
    full_name: string;
  } | null;
}

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
  received_at: string | null;
  created_at: string;
  updated_at: string;
  assessments?: AssessmentInfo[];
}

interface PipelineColumn {
  id: string;
  title: string;
}

const PIPELINE_COLUMNS: PipelineColumn[] = [
  { id: "new_request", title: "New Request" },
  { id: "assessment_unscheduled", title: "Assessment Unscheduled" },
  { id: "assessment_scheduled", title: "Assessment Scheduled" },
  { id: "assessment_completed", title: "Assessment Completed" },
  { id: "quote_draft", title: "Quote Draft" },
  { id: "awaiting_response", title: "Awaiting Response" },
  { id: "changes_requested", title: "Changes Requested" },
];

type FreshnessLevel = "new" | "aging" | "stale";

interface FreshnessConfig {
  level: FreshnessLevel;
  label: string;
  badgeClasses: string;
  dotClasses: string;
}

const getFreshness = (dateStr: string | null | undefined): FreshnessConfig => {
  if (!dateStr) {
    return {
      level: "stale",
      label: "Stale",
      badgeClasses: "bg-slate-100 text-slate-600 border-slate-200",
      dotClasses: "bg-slate-400",
    };
  }

  const receivedTime = new Date(dateStr).getTime();
  if (isNaN(receivedTime)) {
    return {
      level: "stale",
      label: "Stale",
      badgeClasses: "bg-slate-100 text-slate-600 border-slate-200",
      dotClasses: "bg-slate-400",
    };
  }

  const diffHours = (Date.now() - receivedTime) / (1000 * 60 * 60);

  if (diffHours < 1) {
    return {
      level: "new",
      label: "New",
      badgeClasses: "bg-emerald-50 text-emerald-700 border-emerald-200",
      dotClasses: "bg-emerald-500",
    };
  }

  if (diffHours <= 24) {
    return {
      level: "aging",
      label: "Aging",
      badgeClasses: "bg-amber-50 text-amber-700 border-amber-200",
      dotClasses: "bg-amber-500",
    };
  }

  return {
    level: "stale",
    label: "Stale",
    badgeClasses: "bg-slate-100 text-slate-600 border-slate-200",
    dotClasses: "bg-slate-400",
  };
};

export const Leads: React.FC = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from("leads")
        .select(`
          *,
          assessments (
            id,
            scheduled_date,
            start_time,
            end_time,
            status,
            notes,
            assigned_to,
            updated_at,
            profiles:assigned_to (
              full_name
            )
          )
        `)
        .order("received_at", { ascending: false });

      if (fetchErr) {
        throw fetchErr;
      }

      setLeads(data || []);
      // If a lead was selected, update its reference if present in fresh data
      if (selectedLead) {
        const updated = (data || []).find((l) => l.id === selectedLead.id);
        if (updated) setSelectedLead(updated);
      }
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

  const formatAssessmentDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    try {
      const datePart = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
      const [year, month, day] = datePart.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  const formatTime12h = (timeStr: string | null | undefined) => {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":");
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${m} ${ampm}`;
  };

  const formatTimeRange = (start: string | null | undefined, end: string | null | undefined) => {
    if (!start) return "Time not set";
    const startFormatted = formatTime12h(start);
    if (!end) return startFormatted;
    const endFormatted = formatTime12h(end);
    return `${startFormatted} – ${endFormatted}`;
  };

  // Pipeline counters
  const activeOpportunitiesCount = leads.length;
  const newRequestsCount = leads.filter(
    (l) => (l.pipeline_stage || "new_request") === "new_request"
  ).length;

  // Selected lead's scheduled or completed assessment
  const selectedAssessment = selectedLead?.assessments?.find(
    (a) => a.status === "completed"
  ) || selectedLead?.assessments?.find(
    (a) => a.status === "scheduled"
  ) || selectedLead?.assessments?.[0];

  const isAssessmentCompleted = 
    selectedLead?.pipeline_stage === "assessment_completed" || 
    selectedAssessment?.status === "completed";

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-64px)] bg-[#F5F5F5]">
      {/* Top Header & Metrics Bar */}
      <div className="bg-white border-b border-[#E7E9ED] px-4 md:px-8 py-5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#151A2D] flex items-center justify-center text-white shadow-xs">
                <Kanban size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-black text-[#151A2D] tracking-tight m-0">
                    Sales Pipeline
                  </h1>
                </div>
                <p className="text-xs text-[#737A86] mt-0.5 font-medium">
                  Track prospective customer requests from first contact to quote acceptance.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            {/* KPI Metric 1: Active Opportunities */}
            <div className="bg-[#F6F7F9] border border-[#E7E9ED] rounded-xl px-3.5 py-2 flex items-center gap-3">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#737A86]">
                  Active Opportunities
                </span>
                <span className="text-base font-black text-[#151A2D]">
                  {activeOpportunitiesCount}
                </span>
              </div>
            </div>

            {/* KPI Metric 2: New Requests */}
            <div className="bg-[#7CB342]/10 border border-[#7CB342]/20 rounded-xl px-3.5 py-2 flex items-center gap-3">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#558B2F]">
                  New Requests
                </span>
                <span className="text-base font-black text-[#33691E]">
                  {newRequestsCount}
                </span>
              </div>
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchLeads}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-[#E7E9ED] rounded-xl text-xs font-bold text-[#151A2D] hover:bg-[#F6F7F9] transition-all cursor-pointer shadow-xs disabled:opacity-50"
              title="Refresh Pipeline"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Pipeline Board Area */}
      <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-hidden flex flex-col">
        {loading && leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 py-24 gap-3 text-[#737A86]">
            <Loader2 className="w-8 h-8 animate-spin text-[#7CB342]" />
            <span className="text-xs font-bold uppercase tracking-wider">Loading Sales Pipeline...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center flex-1 py-20 gap-3 text-red-500 text-center px-4">
            <AlertCircle className="w-8 h-8" />
            <span className="text-xs font-bold uppercase tracking-wider">{error}</span>
            <button
              onClick={fetchLeads}
              className="mt-2 text-xs bg-[#151A2D] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#1f263e] transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          /* Horizontally Scrollable Pipeline Canvas */
          <div className="flex-1 overflow-x-auto pb-4">
            <div className="inline-flex gap-4 min-w-full items-start">
              {PIPELINE_COLUMNS.map((column) => {
                // Partition leads by their actual pipeline_stage
                const columnLeads = leads.filter(
                  (l) => (l.pipeline_stage || "new_request") === column.id
                );
                const count = columnLeads.length;

                return (
                  <div
                    key={column.id}
                    className="w-80 min-w-[320px] shrink-0 flex flex-col rounded-2xl bg-[#ECEEF2]/60 border border-[#DFE2E8] overflow-hidden"
                  >
                    {/* Column Header */}
                    <div className="px-4 py-3.5 bg-white/80 border-b border-[#DFE2E8] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h2 className="text-xs font-black uppercase tracking-wider text-[#151A2D] m-0">
                          {column.title}
                        </h2>
                      </div>
                      <span className={`px-2 py-0.5 text-[11px] font-black rounded-full ${
                        count > 0 
                          ? "bg-[#151A2D] text-white" 
                          : "bg-gray-200/80 text-[#737A86]"
                      }`}>
                        {count}
                      </span>
                    </div>

                    {/* Column Content / Cards List */}
                    <div className="p-3 flex flex-col gap-3 min-h-[460px] max-h-[calc(100vh-270px)] overflow-y-auto">
                      {columnLeads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center flex-1 py-12 px-4 text-center rounded-xl border border-dashed border-[#D3D7DF] bg-white/30 text-[#8B93A0]">
                          <Inbox className="w-5 h-5 mb-1.5 opacity-40" />
                          <span className="text-[11px] font-medium">No opportunities</span>
                        </div>
                      ) : (
                        columnLeads.map((lead) => {
                          const hasName = Boolean(lead.name && lead.name.trim());
                          const hasPhone = Boolean(lead.phone && lead.phone.trim());
                          const freshness = getFreshness(lead.received_at || lead.created_at);
                          const isSelected = selectedLead?.id === lead.id;
                          const leadAssessment = lead.assessments?.[0];

                          return (
                            <div
                              key={lead.id}
                              onClick={() => setSelectedLead(lead)}
                              className={`group relative bg-white rounded-xl p-4 border transition-all cursor-pointer text-left ${
                                isSelected 
                                  ? "border-[#7CB342] ring-2 ring-[#7CB342]/20 shadow-md" 
                                  : "border-[#E7E9ED] hover:border-[#151A2D]/30 hover:shadow-md shadow-xs"
                              }`}
                            >
                              {/* Top row: Name & 3-dot Menu placeholder */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-7 h-7 rounded-full bg-[#151A2D]/5 flex items-center justify-center text-[#151A2D] shrink-0 font-black text-[11px]">
                                    {hasName ? (
                                      lead.name?.charAt(0).toUpperCase()
                                    ) : (
                                      <User size={12} />
                                    )}
                                  </div>
                                  <h3 className={`text-sm font-bold truncate m-0 ${
                                    hasName ? "text-[#151A2D]" : "text-[#737A86] font-normal"
                                  }`}>
                                    {hasName ? lead.name : "—"}
                                  </h3>
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                  }}
                                  className="p-1 -mr-1 rounded-md text-[#8B93A0] hover:text-[#151A2D] hover:bg-gray-100 transition-colors cursor-pointer"
                                  title="Actions"
                                >
                                  <MoreVertical size={14} />
                                </button>
                              </div>

                              {/* Phone if available */}
                              <div className="mt-2.5 flex items-center gap-1.5 text-xs text-[#525866]">
                                <Phone size={12} className="text-[#8B93A0] shrink-0" />
                                <span className={hasPhone ? "font-medium" : "text-[#8B93A0]"}>
                                  {hasPhone ? lead.phone : "—"}
                                </span>
                              </div>

                              {/* Stage Badges */}
                              {lead.pipeline_stage === "assessment_completed" ? (
                                <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200/60">
                                  <CheckCircle2 size={12} className="shrink-0 text-emerald-600" />
                                  <span className="truncate">
                                    Assessment Completed ✓
                                  </span>
                                </div>
                              ) : lead.pipeline_stage === "assessment_scheduled" && leadAssessment && leadAssessment.scheduled_date ? (
                                <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                                  <Calendar size={11} className="shrink-0 text-indigo-500" />
                                  <span className="truncate">
                                    Assessment: {formatAssessmentDate(leadAssessment.scheduled_date)}
                                  </span>
                                </div>
                              ) : null}

                              {/* Badges row: Facebook source badge & Freshness indicator */}
                              <div className="mt-3 pt-2.5 border-t border-[#F0F2F5] flex items-center justify-between gap-2 flex-wrap">
                                {/* Facebook Source Badge */}
                                {lead.source?.toLowerCase() === "facebook" ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20">
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

                                {/* Freshness Indicator */}
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${freshness.badgeClasses}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${freshness.dotClasses}`} />
                                  {freshness.label}
                                </span>
                              </div>

                              {/* Received Date/Time */}
                              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#8B93A0]">
                                <Clock size={11} className="shrink-0" />
                                <span>{formatDateTime(lead.received_at)}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right-Side Slide-Over Panel (Drawer) */}
      {selectedLead && (
        <>
          {/* Backdrop (Pipeline visible behind it) */}
          <div
            className="fixed inset-0 bg-black/25 backdrop-blur-xs z-40 transition-opacity animate-in fade-in duration-200"
            onClick={() => setSelectedLead(null)}
          />

          {/* Slide-over Drawer */}
          <div
            className="fixed top-0 right-0 h-full w-full sm:w-[440px] md:w-[480px] bg-white shadow-2xl z-50 flex flex-col border-l border-[#E7E9ED] animate-in slide-in-from-right duration-300 ease-out"
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#E7E9ED] flex items-center justify-between bg-[#F8F9FA]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#151A2D] flex items-center justify-center text-white">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-[#151A2D] m-0">
                    Opportunity Details
                  </h2>
                  <span className="text-[11px] text-[#737A86] font-medium capitalize">
                    Stage: {(selectedLead.pipeline_stage || "new_request").replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="w-8 h-8 rounded-lg text-[#737A86] hover:text-[#151A2D] hover:bg-gray-200/60 flex items-center justify-center transition-colors cursor-pointer"
                title="Close panel"
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Lead Primary Card */}
              <div className="p-4 rounded-xl bg-[#F6F7F9] border border-[#E7E9ED] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-[#151A2D] text-white flex items-center justify-center font-black text-sm">
                      {selectedLead.name ? (
                        selectedLead.name.charAt(0).toUpperCase()
                      ) : (
                        <User size={16} />
                      )}
                    </div>
                    <div>
                      <h3 className="text-base font-black text-[#151A2D] m-0">
                        {selectedLead.name || "—"}
                      </h3>
                      <span className="text-[11px] text-[#737A86] font-medium">
                        Received {formatDateTime(selectedLead.received_at)}
                      </span>
                    </div>
                  </div>

                  {/* Freshness badge in drawer */}
                  {(() => {
                    const freshness = getFreshness(selectedLead.received_at || selectedLead.created_at);
                    return (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${freshness.badgeClasses}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${freshness.dotClasses}`} />
                        {freshness.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Assessment Section: Completed vs Scheduled */}
              {isAssessmentCompleted && selectedAssessment ? (
                /* Requirement 7: Completed Assessment Card */
                <div className="p-4 rounded-xl bg-emerald-50/90 border border-emerald-200 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-[#16A34A] text-white flex items-center justify-center">
                        <CheckCircle2 size={13} />
                      </div>
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-950">
                        Assessment
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <span>Completed</span>
                      <span>✓</span>
                    </span>
                  </div>

                  <div className="text-xs space-y-1.5 text-emerald-950 pt-1">
                    <div className="font-semibold text-xs text-emerald-900">
                      Completed on: <span className="font-bold">{formatAssessmentDate(selectedAssessment.updated_at || selectedAssessment.scheduled_date)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-900 font-bold pt-0.5">
                      <User size={12} className="shrink-0 text-emerald-600" />
                      <span>
                        Assigned to: {selectedAssessment.profiles?.full_name || "Unassigned"}
                      </span>
                    </div>
                    {selectedAssessment.notes && (
                      <div className="text-[11px] text-emerald-800 bg-white/80 p-2.5 rounded-lg border border-emerald-100 mt-1 font-medium leading-relaxed">
                        <span className="font-bold text-emerald-900 block mb-0.5">Notes:</span>
                        {selectedAssessment.notes}
                      </div>
                    )}
                  </div>
                </div>
              ) : selectedAssessment && selectedAssessment.status === "scheduled" ? (
                /* Requirement 1: Scheduled Assessment Display Box with Complete Assessment button */
                <div className="p-4 rounded-xl bg-indigo-50/90 border border-indigo-200 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                        <Calendar size={13} />
                      </div>
                      <span className="text-xs font-black uppercase tracking-wider text-indigo-950">
                        Assessment
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                      {selectedAssessment.status}
                    </span>
                  </div>

                  <div className="text-xs space-y-1.5 text-indigo-950 pt-1">
                    <div className="font-extrabold text-sm text-indigo-950">
                      {formatAssessmentDate(selectedAssessment.scheduled_date)}
                    </div>
                    <div className="flex items-center gap-1.5 text-indigo-800 font-medium">
                      <Clock size={12} className="shrink-0 text-indigo-600" />
                      <span>
                        {formatTimeRange(selectedAssessment.start_time, selectedAssessment.end_time)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-indigo-900 font-bold pt-0.5">
                      <User size={12} className="shrink-0 text-indigo-600" />
                      <span>
                        Assigned to: {selectedAssessment.profiles?.full_name || "Unassigned"}
                      </span>
                    </div>
                    {selectedAssessment.notes && (
                      <div className="text-[11px] text-indigo-800 bg-white/70 p-2.5 rounded-lg border border-indigo-100 mt-1 font-medium">
                        {selectedAssessment.notes}
                      </div>
                    )}
                  </div>

                  {/* Complete Assessment & View in Schedule buttons */}
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCompleteModalOpen(true)}
                      className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                    >
                      <CheckCircle2 size={14} />
                      <span>Complete Assessment</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate("/scheduling")}
                      className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 text-indigo-900 border border-indigo-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    >
                      <Calendar size={13} className="text-indigo-600" />
                      <span>View in Schedule</span>
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Opportunity Information Fields */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#737A86] m-0">
                  Opportunity
                </h4>

                <div className="bg-white rounded-xl border border-[#E7E9ED] divide-y divide-[#E7E9ED] overflow-hidden text-xs">
                  {/* Name */}
                  <div className="px-4 py-3 flex items-center justify-between gap-4">
                    <span className="text-[#737A86] font-semibold">Name</span>
                    <span className="font-bold text-[#151A2D]">
                      {selectedLead.name || "—"}
                    </span>
                  </div>

                  {/* Phone */}
                  <div className="px-4 py-3 flex items-center justify-between gap-4">
                    <span className="text-[#737A86] font-semibold">Phone</span>
                    {selectedLead.phone ? (
                      <a
                        href={`tel:${selectedLead.phone}`}
                        className="font-bold text-[#1877F2] hover:underline"
                      >
                        {selectedLead.phone}
                      </a>
                    ) : (
                      <span className="font-medium text-[#8B93A0]">—</span>
                    )}
                  </div>

                  {/* Email */}
                  <div className="px-4 py-3 flex items-center justify-between gap-4">
                    <span className="text-[#737A86] font-semibold">Email</span>
                    {selectedLead.email ? (
                      <a
                        href={`mailto:${selectedLead.email}`}
                        className="font-bold text-[#1877F2] hover:underline break-all text-right"
                      >
                        {selectedLead.email}
                      </a>
                    ) : (
                      <span className="font-medium text-[#8B93A0]">—</span>
                    )}
                  </div>

                  {/* Source */}
                  <div className="px-4 py-3 flex items-center justify-between gap-4">
                    <span className="text-[#737A86] font-semibold">Source</span>
                    {selectedLead.source?.toLowerCase() === "facebook" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20">
                        <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                        Facebook
                      </span>
                    ) : (
                      <span className="font-bold text-[#151A2D] capitalize">
                        {selectedLead.source || "—"}
                      </span>
                    )}
                  </div>

                  {/* Received Date */}
                  <div className="px-4 py-3 flex items-center justify-between gap-4">
                    <span className="text-[#737A86] font-semibold">Received Date</span>
                    <span className="font-medium text-[#151A2D] text-right">
                      {formatDateTime(selectedLead.received_at)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#737A86] m-0">
                    Quick Actions
                  </h4>
                  {isAssessmentCompleted && (
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded">
                      Ready for Quote
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {isAssessmentCompleted ? (
                    /* Requirement 7: Show disabled Convert to Quote placeholder */
                    <button
                      type="button"
                      disabled
                      className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-3 rounded-xl bg-gray-100 text-gray-500 border border-gray-200 text-xs font-bold cursor-not-allowed"
                      title="Quote conversion coming in next step"
                    >
                      <FileText size={14} className="text-gray-400" />
                      <span>Convert to Quote</span>
                    </button>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Functional Schedule / Reschedule Assessment button */}
                      <button
                        type="button"
                        onClick={() => setIsScheduleModalOpen(true)}
                        className={`w-full inline-flex items-center justify-center gap-2 px-3.5 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-[0.98] ${
                          selectedAssessment
                            ? "bg-[#151A2D]/5 text-[#151A2D] border border-[#151A2D]/20 hover:bg-[#151A2D]/10"
                            : "bg-[#151A2D] text-white hover:bg-[#1f263e]"
                        }`}
                      >
                        <Calendar size={14} className={selectedAssessment ? "text-[#151A2D]" : "text-white"} />
                        <span>{selectedAssessment ? "Reschedule Assessment" : "Schedule Assessment"}</span>
                      </button>

                      {/* Placeholder Create Estimate button */}
                      <button
                        type="button"
                        disabled
                        className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-3 rounded-xl bg-[#7CB342]/10 text-[#558B2F]/60 border border-[#7CB342]/20 text-xs font-bold cursor-not-allowed"
                        title="Action placeholder - not active yet"
                      >
                        <FileText size={14} className="text-[#7CB342]/60" />
                        <span>Create Estimate</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation link to full /leads/:id page */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => navigate(`/leads/${selectedLead.id}`)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#E7E9ED] text-xs font-bold text-[#151A2D] hover:bg-[#F6F7F9] transition-all cursor-pointer shadow-xs"
                >
                  <span>View Full Lead & Meta Records</span>
                  <ExternalLink size={13} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Schedule Assessment Modal */}
      {selectedLead && (
        <ScheduleAssessmentModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          lead={{
            id: selectedLead.id,
            name: selectedLead.name,
            phone: selectedLead.phone,
          }}
          onSuccess={() => {
            fetchLeads();
          }}
        />
      )}

      {/* Complete Assessment Confirmation Modal */}
      {selectedLead && selectedAssessment && (
        <CompleteAssessmentModal
          isOpen={isCompleteModalOpen}
          onClose={() => setIsCompleteModalOpen(false)}
          assessment={{
            id: selectedAssessment.id,
            notes: selectedAssessment.notes,
            lead_id: selectedLead.id,
          }}
          leadName={selectedLead.name}
          onSuccess={() => {
            fetchLeads();
          }}
        />
      )}
    </div>
  );
};
