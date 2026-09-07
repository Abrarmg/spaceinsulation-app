import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  X, 
  Loader2, 
  Calendar, 
  Clock, 
  User, 
  FileText, 
  AlertCircle 
} from 'lucide-react';

interface StaffProfile {
  id: string;
  full_name: string;
  role: string;
}

interface ScheduleAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: {
    id: string;
    name: string | null;
    phone: string | null;
  };
  onSuccess: () => void;
}

export const ScheduleAssessmentModal: React.FC<ScheduleAssessmentModalProps> = ({
  isOpen,
  onClose,
  lead,
  onSuccess,
}) => {
  const [profiles, setProfiles] = useState<StaffProfile[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const getTomorrowDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const [scheduledDate, setScheduledDate] = useState(getTomorrowDate());
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch available staff members from profiles
  useEffect(() => {
    if (!isOpen) return;
    const fetchStaff = async () => {
      setLoadingStaff(true);
      try {
        const { data, error: staffErr } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .not('full_name', 'is', null)
          .order('full_name');

        if (staffErr) throw staffErr;
        setProfiles(data || []);
        if (data && data.length > 0 && !assignedTo) {
          setAssignedTo(data[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load staff profiles:', err);
      } finally {
        setLoadingStaff(false);
      }
    };

    fetchStaff();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!scheduledDate) {
      setError('Please select an assessment date.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Insert assessment record (NO job, NO customer, NO estimate)
      const { error: insertErr } = await supabase
        .from('assessments')
        .insert({
          lead_id: lead.id,
          assigned_to: assignedTo || null,
          scheduled_date: scheduledDate,
          start_time: startTime ? `${startTime}:00` : null,
          end_time: endTime ? `${endTime}:00` : null,
          status: 'scheduled',
          notes: notes.trim() || null,
        });

      if (insertErr) throw insertErr;

      // 2. Update lead's pipeline stage
      const { error: updateErr } = await supabase
        .from('leads')
        .update({
          pipeline_stage: 'assessment_scheduled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id);

      if (updateErr) throw updateErr;

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to schedule assessment:', err);
      setError(err?.message || 'Failed to schedule assessment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-[#E7E9ED] overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E7E9ED] flex items-center justify-between bg-[#F8F9FA]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#151A2D] text-white flex items-center justify-center shadow-xs">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-[#151A2D] m-0">
                Schedule Assessment
              </h2>
              <p className="text-xs text-[#737A86] mt-0.5 font-medium">
                For: <span className="font-bold text-[#151A2D]">{lead.name || 'Opportunity'}</span> {lead.phone ? `(${lead.phone})` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-[#737A86] hover:text-[#151A2D] hover:bg-gray-200/60 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2.5 font-medium">
              <AlertCircle size={16} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Assessment Date */}
          <div>
            <label className="block text-xs font-bold text-[#151A2D] uppercase tracking-wider mb-1.5">
              Assessment Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F6F7F9] border border-[#E7E9ED] rounded-xl text-xs font-semibold text-[#151A2D] focus:outline-hidden focus:ring-2 focus:ring-[#7CB342]/40 focus:border-[#7CB342] transition-all"
              />
            </div>
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#151A2D] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Clock size={12} className="text-[#737A86]" />
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F6F7F9] border border-[#E7E9ED] rounded-xl text-xs font-semibold text-[#151A2D] focus:outline-hidden focus:ring-2 focus:ring-[#7CB342]/40 focus:border-[#7CB342] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#151A2D] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Clock size={12} className="text-[#737A86]" />
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F6F7F9] border border-[#E7E9ED] rounded-xl text-xs font-semibold text-[#151A2D] focus:outline-hidden focus:ring-2 focus:ring-[#7CB342]/40 focus:border-[#7CB342] transition-all"
              />
            </div>
          </div>

          {/* Assigned Staff / Estimator */}
          <div>
            <label className="block text-xs font-bold text-[#151A2D] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <User size={12} className="text-[#737A86]" />
              Assigned Staff / Estimator
            </label>
            {loadingStaff ? (
              <div className="flex items-center gap-2 text-xs text-[#737A86] py-2">
                <Loader2 size={14} className="animate-spin text-[#7CB342]" />
                <span>Loading team members...</span>
              </div>
            ) : (
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F6F7F9] border border-[#E7E9ED] rounded-xl text-xs font-semibold text-[#151A2D] focus:outline-hidden focus:ring-2 focus:ring-[#7CB342]/40 focus:border-[#7CB342] transition-all"
              >
                <option value="">-- Unassigned --</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.role.replace('_', ' ')})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block text-xs font-bold text-[#151A2D] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText size={12} className="text-[#737A86]" />
              Internal Notes <span className="text-[#737A86] font-normal lowercase">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Customer requested attic insulation inspection, ladder required on-site."
              className="w-full px-3.5 py-2.5 bg-[#F6F7F9] border border-[#E7E9ED] rounded-xl text-xs font-medium text-[#151A2D] focus:outline-hidden focus:ring-2 focus:ring-[#7CB342]/40 focus:border-[#7CB342] transition-all resize-none placeholder:text-[#8B93A0]"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#E7E9ED]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 bg-white border border-[#E7E9ED] rounded-xl text-xs font-bold text-[#737A86] hover:text-[#151A2D] hover:bg-[#F6F7F9] transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#151A2D] text-white rounded-xl text-xs font-bold hover:bg-[#1f263e] active:scale-[0.98] transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin text-[#7CB342]" />
                  <span>Scheduling...</span>
                </>
              ) : (
                <>
                  <Calendar size={14} />
                  <span>Confirm Assessment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
