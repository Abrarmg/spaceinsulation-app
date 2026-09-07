import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { CheckCircle2, X, Loader2, FileText, AlertCircle } from 'lucide-react';

interface CompleteAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessment: {
    id: string;
    notes: string | null;
    lead_id: string;
  };
  leadName?: string | null;
  onSuccess: () => void;
}

export const CompleteAssessmentModal: React.FC<CompleteAssessmentModalProps> = ({
  isOpen,
  onClose,
  assessment,
  leadName,
  onSuccess,
}) => {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNotes(assessment.notes || '');
      setError(null);
    }
  }, [isOpen, assessment]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // 1. Update public.assessments record
      const { error: assessErr } = await supabase
        .from('assessments')
        .update({
          status: 'completed',
          notes: notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assessment.id);

      if (assessErr) throw assessErr;

      // 2. Update public.leads pipeline stage
      const { error: leadErr } = await supabase
        .from('leads')
        .update({
          pipeline_stage: 'assessment_completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', assessment.lead_id);

      if (leadErr) throw leadErr;

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to complete assessment:', err);
      setError(err?.message || 'Failed to complete assessment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#E7E9ED] overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E7E9ED] flex items-center justify-between bg-[#F8F9FA]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#22C55E]/10 text-[#16A34A] border border-[#22C55E]/20 flex items-center justify-center shadow-xs">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-[#151A2D] m-0">
                Complete Assessment?
              </h2>
              <p className="text-xs text-[#737A86] mt-0.5 font-medium">
                For: <span className="font-bold text-[#151A2D]">{leadName || 'Opportunity'}</span>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2.5 font-medium">
              <AlertCircle size={16} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-xs text-[#525866] leading-relaxed m-0">
            Marking this assessment as completed will transition the opportunity to{' '}
            <span className="font-bold text-[#151A2D]">Assessment Completed</span> in the Sales Pipeline, making it ready for quote drafting.
          </p>

          {/* Assessment Notes */}
          <div>
            <label className="block text-xs font-bold text-[#151A2D] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText size={12} className="text-[#737A86]" />
              Assessment Notes / Findings <span className="text-[#737A86] font-normal lowercase">(optional)</span>
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record findings from the visit (e.g. Attic depth is 4 inches, R-13, needs R-38 blown-in fiberglass, air sealing required around hatch)..."
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
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-xl text-xs font-bold active:scale-[0.98] transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin text-white" />
                  <span>Completing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Complete Assessment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
