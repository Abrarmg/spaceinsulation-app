import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { X, Loader2, StickyNote, AlertCircle } from 'lucide-react';

export interface Note {
  id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string;
  } | null;
}

interface CreateNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  noteToEdit?: Note | null;
}

export const CreateNoteModal: React.FC<CreateNoteModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  noteToEdit = null
}) => {
  const isEditMode = !!noteToEdit;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (noteToEdit) {
      setTitle(noteToEdit.title || '');
      setContent(noteToEdit.content || '');
    } else {
      setTitle('');
      setContent('');
    }
    setError(null);
  }, [noteToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle) {
      setError('Please enter a note title.');
      return;
    }

    if (!trimmedContent) {
      setError('Please enter note content.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode && noteToEdit) {
        const { error: updateErr } = await supabase
          .from('notes')
          .update({
            title: trimmedTitle,
            content: trimmedContent,
            updated_at: new Date().toISOString()
          })
          .eq('id', noteToEdit.id);

        if (updateErr) throw updateErr;
      } else {
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !session?.user) {
          throw new Error('Authenticated user session not found.');
        }

        const { error: insertErr } = await supabase
          .from('notes')
          .insert([
            {
              title: trimmedTitle,
              content: trimmedContent,
              created_by: session.user.id
            }
          ]);

        if (insertErr) throw insertErr;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to save note:', err);
      setError(err.message || 'An error occurred while saving the note.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]">
      <div 
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center text-brand-green">
              <StickyNote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {isEditMode ? 'Edit Internal Note' : 'Create Internal Note'}
              </h2>
              <p className="text-xs text-gray-500">
                {isEditMode ? 'Update existing team note.' : 'Add a reminder or task for office staff.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 text-red-700 text-xs font-medium border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Call supplier regarding insulation shipment"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 transition-all"
              disabled={isSubmitting}
              maxLength={150}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Note Details <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write the internal note details here..."
              rows={5}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 transition-all resize-none"
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !content.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-green text-brand-navy text-xs font-black hover:bg-brand-green-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isEditMode ? 'Save Note' : 'Create Note'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
