import React, { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { JOB_COLORS } from './jobColors';
import { Job } from './types';

interface JobColorPickerProps {
  job: Job;
  /** Called after the colour is saved (null = back to the status colour). */
  onChanged: (color: string | null) => void;
}

export const JobColorPicker: React.FC<JobColorPickerProps> = ({ job, onChanged }) => {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = job.color || null;

  const pick = async (color: string | null) => {
    if (color === current) return;
    setSaving(color ?? 'default');
    setError(null);
    const { error: err } = await supabase.from('jobs').update({ color }).eq('id', job.id);
    setSaving(null);
    if (err) {
      setError(
        /color/i.test(err.message)
          ? 'Card colours need a one-time database update (20261018150000_job_card_color.sql).'
          : err.message
      );
      return;
    }
    onChanged(color);
  };

  return (
    <div className="px-5 py-4 border-t border-[#E7E9ED] space-y-2">
      <div className="text-[9px] uppercase font-bold text-[#737A86]">Card colour</div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => pick(null)}
          title="Status colour (default)"
          aria-label="Use status colour"
          className={`h-7 px-2.5 rounded-full border text-[10px] font-bold cursor-pointer ${
            current === null ? 'border-[#151A2D] bg-[#151A2D] text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          {saving === 'default' ? <Loader2 size={12} className="animate-spin" /> : 'Auto'}
        </button>
        {JOB_COLORS.map(c => {
          const selected = current === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => pick(c.key)}
              title={c.label}
              aria-label={`${c.label} card colour`}
              aria-pressed={selected}
              className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110 ${
                selected ? 'ring-2 ring-offset-2 ring-[#151A2D]' : ''
              }`}
              style={{ backgroundColor: c.swatch }}
            >
              {saving === c.key ? (
                <Loader2 size={12} className="animate-spin text-white" />
              ) : selected ? (
                <Check size={13} className="text-white" strokeWidth={3} />
              ) : null}
            </button>
          );
        })}
      </div>
      {error && <div className="text-[10.5px] font-semibold text-red-600">{error}</div>}
    </div>
  );
};
