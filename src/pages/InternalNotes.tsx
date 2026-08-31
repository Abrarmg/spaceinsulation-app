import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { CreateNoteModal, Note } from '../components/CreateNoteModal';
import { 
  StickyNote, 
  Plus, 
  Pin, 
  PinOff, 
  Edit3, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  Clock, 
  User 
} from 'lucide-react';

export const InternalNotes: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedNoteToEdit, setSelectedNoteToEdit] = useState<Note | null>(null);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('notes')
        .select(`
          id,
          title,
          content,
          is_pinned,
          created_by,
          created_at,
          updated_at,
          profiles:created_by (
            full_name
          )
        `)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setNotes((data as any[]) || []);
    } catch (err: any) {
      console.error('Failed to load internal notes:', err);
      setError(err.message || 'Unable to load internal notes. Please check connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Handle Pin / Unpin Toggle
  const handleTogglePin = async (note: Note) => {
    const newPinnedStatus = !note.is_pinned;
    
    // Optimistic UI update
    setNotes((prevNotes) =>
      prevNotes.map((n) => (n.id === note.id ? { ...n, is_pinned: newPinnedStatus } : n))
    );

    try {
      const { error: updateErr } = await supabase
        .from('notes')
        .update({
          is_pinned: newPinnedStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', note.id);

      if (updateErr) {
        throw updateErr;
      }
    } catch (err: any) {
      console.error('Failed to update pin status:', err);
      // Revert optimistic update
      fetchNotes();
    }
  };

  // Handle Note Deletion
  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Delete this note? This action cannot be undone.')) {
      return;
    }

    try {
      const { error: deleteErr } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);

      if (deleteErr) {
        throw deleteErr;
      }

      setNotes((prevNotes) => prevNotes.filter((n) => n.id !== noteId));
    } catch (err: any) {
      console.error('Failed to delete note:', err);
      alert(err.message || 'Failed to delete note. Please try again.');
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (note: Note) => {
    setSelectedNoteToEdit(note);
    setIsModalOpen(true);
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setSelectedNoteToEdit(null);
    setIsModalOpen(true);
  };

  // Format Timestamp Helper
  const formatDateTime = (isoString: string) => {
    if (!isoString) return '';
    const dateObj = new Date(isoString);
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Sort: Pinned notes first (newest created_at), then Unpinned notes (newest created_at)
  const pinnedNotes = notes
    .filter((n) => n.is_pinned)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const unpinnedNotes = notes
    .filter((n) => !n.is_pinned)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const sortedNotes = [...pinnedNotes, ...unpinnedNotes];

  return (
    <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center text-brand-green">
              <StickyNote className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-black text-brand-navy tracking-tight">
              Internal Notes
            </h1>
          </div>
          <p className="text-xs md:text-sm font-medium text-gray-500 pl-13">
            Keep track of important tasks and reminders.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-green text-brand-navy font-black text-xs md:text-sm hover:bg-brand-green-dark transition-all shadow-md active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Add Note</span>
        </button>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 text-red-700 text-xs md:text-sm font-semibold border border-red-100 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-brand-green" />
          <span className="text-xs font-semibold">Loading internal notes...</span>
        </div>
      ) : sortedNotes.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400">
            <StickyNote className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-gray-900">No notes yet. Add your first note.</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Create quick reminders, operational checklists, or internal instructions for the office team.
            </p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-navy text-white text-xs font-bold hover:bg-brand-navy-light transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Note</span>
          </button>
        </div>
      ) : (
        /* Notes Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedNotes.map((note) => {
            const isEdited = note.updated_at && note.updated_at !== note.created_at;
            const authorName = note.profiles?.full_name || 'Former Staff';

            return (
              <div
                key={note.id}
                className={`relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md bg-white ${
                  note.is_pinned
                    ? 'border-brand-green/40 ring-1 ring-brand-green/20'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                {/* Note Card Top Header */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-bold text-gray-900 leading-snug break-words flex-1 pr-2">
                      {note.title}
                    </h3>

                    {/* Pin Toggle Button */}
                    <button
                      onClick={() => handleTogglePin(note)}
                      title={note.is_pinned ? 'Unpin note' : 'Pin note'}
                      className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                        note.is_pinned
                          ? 'bg-brand-green/15 text-brand-green hover:bg-brand-green/25'
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {note.is_pinned ? (
                        <Pin className="w-4 h-4 fill-brand-green" />
                      ) : (
                        <PinOff className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Note Body */}
                  <p className="text-xs md:text-sm text-gray-600 font-medium whitespace-pre-wrap break-words leading-relaxed">
                    {note.content}
                  </p>
                </div>

                {/* Note Card Footer */}
                <div className="pt-4 mt-4 border-t border-gray-100 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium">
                    <div className="flex items-center gap-1.5 truncate">
                      <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate font-semibold text-gray-700">{authorName}</span>
                    </div>

                    {/* Edit / Delete Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEditModal(note)}
                        title="Edit Note"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-brand-navy hover:bg-gray-100 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        title="Delete Note"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>
                      {formatDateTime(note.created_at)}
                      {isEdited && ` (Edited: ${formatDateTime(note.updated_at)})`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <CreateNoteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchNotes}
        noteToEdit={selectedNoteToEdit}
      />
    </div>
  );
};
