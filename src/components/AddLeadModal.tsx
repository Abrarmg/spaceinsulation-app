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
  'w-full px-3 py-2.5 border border-[#E6E8EC] focus:border-[#76C442] focus:ring-2 focus:ring-[#76C442]/10 rounded-lg text-sm bg-[#F7F8FA] focus:outline-none font-medium';

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
      <div className="absolute inset-0 bg-[#151A2D]/60 backdrop-blur-xs" onClick={close} />
      <form
        onSubmit={submit}
        className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E7E9ED]">
          <h2 className="text-sm font-black uppercase tracking-wider text-[#151A2D] m-0">Add Lead</h2>
          <button type="button" onClick={close} className="p-1.5 rounded-lg hover:bg-[#F6F7F9] text-[#737A86] cursor-pointer">
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
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#737A86]">Name *</span>
            <input className={inputClass} value={name} onChange={e => setName(e.target.value)} autoFocus />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#737A86]">Phone</span>
              <input className={inputClass} type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#737A86]">Email</span>
              <input className={inputClass} type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#737A86]">Source</span>
            <select className={inputClass} value={source} onChange={e => setSource(e.target.value)}>
              {SOURCES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#E7E9ED] bg-[#F9FAFB]">
          <button type="button" onClick={close} className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#151A2D] bg-white border border-[#E7E9ED] hover:bg-[#F6F7F9] cursor-pointer">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#7CC242] hover:bg-[#6ab331] disabled:opacity-60 cursor-pointer"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save Lead
          </button>
        </div>
      </form>
    </div>
  );
};
