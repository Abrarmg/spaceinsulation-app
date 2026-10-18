import React, { useState } from 'react';
import { AlertCircle, Loader2, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useConfirm } from '../../hooks/useFeedback';
import { Crew, Profile } from './types';

interface ManageCrewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  crews: Crew[];
  workers: Profile[];
  /** The crews table doesn't exist yet (migration not run). */
  setupNeeded: boolean;
  onChanged: () => void;
}

export const ManageCrewsModal: React.FC<ManageCrewsModalProps> = ({ isOpen, onClose, crews, workers, setupNeeded, onChanged }) => {
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  if (!isOpen) return null;

  const run = async (op: () => PromiseLike<{ error: { message: string } | null }>) => {
    setBusy(true);
    setError(null);
    const { error: err } = await op();
    setBusy(false);
    if (err) setError(err.message);
    else onChanged();
  };

  const addCrew = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setNewName('');
    run(() => supabase.from('crews').insert({ name, sort_order: crews.length + 1 }));
  };

  const rename = (crew: Crew, name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === crew.name) return;
    run(() => supabase.from('crews').update({ name: trimmed }).eq('id', crew.id));
  };

  const toggleMember = (crew: Crew, workerId: string) =>
    run(() =>
      crew.memberIds.includes(workerId)
        ? supabase.from('crew_members').delete().eq('crew_id', crew.id).eq('worker_id', workerId)
        : supabase.from('crew_members').insert({ crew_id: crew.id, worker_id: workerId })
    );

  const removeCrew = async (crew: Crew) => {
    const ok = await confirm({
      title: `Delete ${crew.name}?`,
      message: 'The crew is removed; workers and their jobs are not affected.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) run(() => supabase.from('crews').delete().eq('id', crew.id));
  };

  const crewOf = (workerId: string, except: string) => crews.find(c => c.id !== except && c.memberIds.includes(workerId))?.name;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center font-sans">
      <div className="absolute inset-0 bg-[#151A2D]/60" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-black uppercase tracking-wider text-[#151A2D] m-0">Manage crews</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {setupNeeded ? (
            <div className="flex items-start gap-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              Crews aren't set up in the database yet. Run the migration
              <code className="font-mono">20261018090000_create_crews.sql</code> in Supabase, then reopen this window.
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-start gap-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
                </div>
              )}

              {crews.length === 0 && <p className="text-xs text-slate-500 m-0">No crews yet. Add your first crew below.</p>}

              {crews.map(crew => (
                <div key={crew.id} className="border border-slate-200 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      defaultValue={crew.name}
                      onBlur={e => rename(crew, e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                      aria-label="Crew name"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-[#151A2D] focus:outline-none focus:border-[#76C442]"
                    />
                    <button
                      type="button"
                      onClick={() => removeCrew(crew)}
                      disabled={busy}
                      className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      aria-label={`Delete ${crew.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {workers.map(w => {
                      const inCrew = crew.memberIds.includes(w.id);
                      const other = !inCrew ? crewOf(w.id, crew.id) : undefined;
                      return (
                        <button
                          key={w.id}
                          type="button"
                          disabled={busy}
                          onClick={() => toggleMember(crew, w.id)}
                          title={other ? `Also in ${other}` : undefined}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                            inCrew
                              ? 'bg-[#151A2D] text-white border-[#151A2D]'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {w.full_name}
                          {other && <span className="ml-1 font-semibold text-slate-400">· {other}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <form onSubmit={addCrew} className="flex items-center gap-2">
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="New crew name (e.g. Crew E)"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#76C442]"
                />
                <button
                  type="submit"
                  disabled={busy || !newName.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#7CC242] hover:bg-[#6ab331] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add crew
                </button>
              </form>
            </>
          )}
        </div>
      </div>
      {confirmDialog}
    </div>
  );
};
