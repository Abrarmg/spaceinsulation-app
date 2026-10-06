import React, { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Trash2, Calendar, User, Tag } from 'lucide-react';
import { InspectionPhoto, PHOTO_CATEGORIES } from './types';

interface InspectionLightboxProps {
  photos: InspectionPhoto[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onDeletePhoto?: (photo: InspectionPhoto) => Promise<void>;
  canDelete?: boolean;
}

export const InspectionLightbox: React.FC<InspectionLightboxProps> = ({
  photos,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
  onDeletePhoto,
  canDelete = false
}) => {
  const currentPhoto = photos[currentIndex];

  const handlePrev = useCallback(() => {
    if (photos.length <= 1) return;
    const prev = (currentIndex - 1 + photos.length) % photos.length;
    onNavigate(prev);
  }, [currentIndex, photos.length, onNavigate]);

  const handleNext = useCallback(() => {
    if (photos.length <= 1) return;
    const next = (currentIndex + 1) % photos.length;
    onNavigate(next);
  }, [currentIndex, photos.length, onNavigate]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext]);

  if (!isOpen || !currentPhoto) return null;

  const categoryLabel = PHOTO_CATEGORIES.find(c => c.id === currentPhoto.category)?.label || currentPhoto.category;
  const dateFormatted = currentPhoto.created_at
    ? new Date(currentPhoto.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm select-none animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="absolute top-0 inset-x-0 p-4 md:px-8 flex items-center justify-between text-white bg-gradient-to-b from-black/80 to-transparent z-10">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#76C442] text-[#151A2D]">
            <Tag size={12} />
            {categoryLabel}
          </span>
          <span className="text-xs font-semibold text-gray-300">
            {currentIndex + 1} of {photos.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {canDelete && onDeletePhoto && (
            <button
              onClick={async () => {
                if (window.confirm('Are you sure you want to delete this inspection photo?')) {
                  await onDeletePhoto(currentPhoto);
                }
              }}
              className="p-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition-colors cursor-pointer"
              title="Delete Photo"
            >
              <Trash2 size={18} />
            </button>
          )}

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Close Viewer"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Image Viewport */}
      <div className="relative w-full h-full flex items-center justify-center p-4 md:p-16">
        <img
          src={currentPhoto.signedUrl || currentPhoto.storage_path}
          alt={currentPhoto.caption || categoryLabel}
          className="max-w-full max-h-[80vh] md:max-h-[85vh] object-contain rounded-lg shadow-2xl transition-all"
        />

        {/* Previous Button */}
        {photos.length > 1 && (
          <button
            onClick={handlePrev}
            className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/20 transition-all cursor-pointer focus:outline-none hover:scale-105"
            aria-label="Previous Photo"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {/* Next Button */}
        {photos.length > 1 && (
          <button
            onClick={handleNext}
            className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/20 transition-all cursor-pointer focus:outline-none hover:scale-105"
            aria-label="Next Photo"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>

      {/* Bottom Information Bar */}
      <div className="absolute bottom-0 inset-x-0 p-4 md:p-6 text-white bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div className="max-w-2xl">
          {currentPhoto.caption ? (
            <p className="text-sm md:text-base font-semibold text-white mb-1">
              "{currentPhoto.caption}"
            </p>
          ) : (
            <p className="text-xs text-gray-400 italic mb-1">No caption provided</p>
          )}

          <div className="flex items-center gap-4 text-[11px] text-gray-300">
            {currentPhoto.uploader?.full_name && (
              <span className="flex items-center gap-1">
                <User size={12} className="text-[#76C442]" />
                {currentPhoto.uploader.full_name}
              </span>
            )}
            {dateFormatted && (
              <span className="flex items-center gap-1">
                <Calendar size={12} className="text-[#76C442]" />
                {dateFormatted}
              </span>
            )}
            {currentPhoto.file_name && (
              <span className="text-gray-400 truncate max-w-xs">
                {currentPhoto.file_name}
              </span>
            )}
          </div>
        </div>

        {/* Thumbnails strip on desktop */}
        {photos.length > 1 && (
          <div className="hidden md:flex items-center gap-2 overflow-x-auto max-w-md pb-1 scrollbar-hide">
            {photos.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => onNavigate(idx)}
                className={`relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                  idx === currentIndex ? 'border-[#76C442] scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img
                  src={p.signedUrl || p.storage_path}
                  alt={p.caption || 'Thumbnail'}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
