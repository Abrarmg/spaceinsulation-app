import React, { useState } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { supabase } from '../supabaseClient';

const SOURCES = [
  { value: 'phone', label: 'Phone call' },
  { value: 'walk-in', label: 'Walk-in' },
  { value: 'referral', label: 'Referral' },
  { value: 'website', label: 'Website' },
  { value: 'other', label: 'Other' },
];

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (leadId: string) => void;
}

const inputClass =
  'w-full h-11 md:h-10 px-3 border border-line hover:border-line-strong focus:border-brand focus:ring-3 focus:ring-brand/15 rounded-lg text-sm text-navy bg-white focus:outline-none';

export const AddLeadModal: React.FC<AddLeadModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('phone');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const reset = () => {
    setName('');
    setPhone('');
    setEmail('');
    setSource('phone');
    setError(null);
  };

  const close = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Name is required.');
    if (!phone.trim() && !email.trim()) return setError('Add a phone number or an email so you can follow up.');

    setSaving(true);
    setError(null);
    const now = new Date().toISOString();
    const { data, error: insertErr } = await supabase
      .from('leads')
      .insert({
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        source,
        status: 'new',
        pipeline_stage: 'new_request',
        received_at: now,
      })
      .select('id')
      .single();
    setSaving(false);

    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    reset();
    onCreated(data.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center font-sans">
      <div className="absolute inset-0 bg-navy/60 backdrop-blur-xs" onClick={close} />
      <form
        onSubmit={submit}
        className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="text-base font-semibold text-navy m-0">Add lead</h2>
          <button type="button" onClick={close} className="p-1.5 rounded-lg hover:bg-canvas text-muted cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-ink-soft">Name <span className="text-red-600">*</span></span>
            <input className={inputClass} value={name} onChange={e => setName(e.target.value)} autoFocus />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-ink-soft">Phone</span>
              <input className={inputClass} type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-ink-soft">Email</span>
              <input className={inputClass} type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-ink-soft">Source</span>
            <select className={inputClass} value={source} onChange={e => setSource(e.target.value)}>
              {SOURCES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-line bg-canvas">
          <button type="button" onClick={close} className="px-4 py-2.5 rounded-lg text-sm font-semibold text-navy bg-white border border-line hover:bg-canvas cursor-pointer">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-navy bg-brand hover:bg-brand-hover disabled:opacity-60 cursor-pointer"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save lead
          </button>
        </div>
      </form>
    </div>
  );
};
