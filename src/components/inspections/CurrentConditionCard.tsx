import React, { useState } from 'react';
import { 
  ClipboardCheck, 
  Plus, 
  Edit3, 
  Calendar, 
  User, 
  Camera, 
  CheckCircle2, 
  Clock,
  ExternalLink
} from 'lucide-react';
import { InspectionReport, InspectionPhoto, PHOTO_CATEGORIES, PhotoCategory } from './types';
import { InspectionLightbox } from './InspectionLightbox';

interface CurrentConditionCardProps {
  inspection: InspectionReport | null;
  onOpenNewInspection?: () => void;
  onEditInspection?: (report: InspectionReport) => void;
  onDeletePhoto?: (photo: InspectionPhoto) => Promise<void>;
  canEdit?: boolean;
  canDeletePhoto?: boolean;
  showStepNumber?: boolean;
}

export const CurrentConditionCard: React.FC<CurrentConditionCardProps> = ({
  inspection,
  onOpenNewInspection,
  onEditInspection,
  onDeletePhoto,
  canEdit = true,
  canDeletePhoto = false,
  showStepNumber = true
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Group photos by category
  const allPhotos: InspectionPhoto[] = inspection?.photos || [];

  const photosByCategory = React.useMemo(() => {
    const map = new Map<PhotoCategory, InspectionPhoto[]>();
    PHOTO_CATEGORIES.forEach(cat => map.set(cat.id, []));

    allPhotos.forEach(p => {
      const arr = map.get(p.category) || [];
      arr.push(p);
      map.set(p.category, arr);
    });
    return map;
  }, [allPhotos]);

  const handleThumbnailClick = (photo: InspectionPhoto) => {
    const idx = allPhotos.findIndex(p => p.id === photo.id);
    if (idx !== -1) {
      setLightboxIndex(idx);
      setLightboxOpen(true);
    }
  };

  if (!inspection) {
    return (
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            {showStepNumber && (
              <div className="w-6 h-6 rounded-full bg-[#151A2D] text-white text-xs font-black flex items-center justify-center">
                1
              </div>
            )}
            <ClipboardCheck size={18} className="text-[#76C442]" />
            <h2 className="text-base md:text-lg font-black text-[#151A2D] tracking-tight m-0">
              Current condition
            </h2>
          </div>

          {canEdit && onOpenNewInspection && (
            <button
              onClick={onOpenNewInspection}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] text-xs font-black rounded-lg transition-all cursor-pointer shadow-xs"
            >
              <Plus size={14} strokeWidth={3} />
              <span>Start Inspection</span>
            </button>
          )}
        </div>

        <div className="text-center py-8 px-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] border-dashed">
          <Camera className="mx-auto text-[#94A3B8] mb-2" size={32} />
          <p className="text-sm font-bold text-[#151A2D]">No Inspection Recorded</p>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto mt-1">
            Capture existing attic conditions, current R-values, square footage, and field photos for accurate scope and verification.
          </p>
          {canEdit && onOpenNewInspection && (
            <button
              onClick={onOpenNewInspection}
              className="mt-4 px-4 py-2 bg-[#151A2D] hover:bg-[#2A3441] text-white text-xs font-black rounded-lg transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Create Inspection Report</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const inspectionDateFormatted = inspection.inspection_date
    ? new Date(inspection.inspection_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    : 'Unknown Date';

  const subtitleInfo = [
    'Current R-value',
    inspection.current_insulation_type || null
  ].filter(Boolean).join(' • ');

  return (
    <>
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 md:p-6 shadow-xs space-y-5">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F1F5F9] pb-4">
          <div className="flex items-center gap-2.5">
            {showStepNumber && (
              <div className="w-6 h-6 rounded-full bg-[#151A2D] text-white text-xs font-black flex items-center justify-center shrink-0">
                1
              </div>
            )}
            <ClipboardCheck size={18} className="text-[#76C442] shrink-0" />
            <h2 className="text-base md:text-lg font-black text-[#151A2D] tracking-tight m-0">
              Current condition
            </h2>

            {inspection.status === 'completed' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 size={11} />
                Completed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                <Clock size={11} />
                Draft
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="text-[11px] font-semibold text-[#64748B] flex items-center gap-1.5 mr-1">
              <Calendar size={12} className="text-[#94A3B8]" />
              <span>{inspectionDateFormatted}</span>
              {inspection.inspector?.full_name && (
                <>
                  <span>&middot;</span>
                  <User size={12} className="text-[#94A3B8]" />
                  <span>{inspection.inspector.full_name}</span>
                </>
              )}
            </div>

            {canEdit && onEditInspection && (
              <button
                onClick={() => onEditInspection(inspection)}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#151A2D] text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                <Edit3 size={13} />
                <span>Edit</span>
              </button>
            )}
          </div>
        </div>

        {/* Primary Spec Cards: Matches Client Screenshot */}
        <div className="grid grid-cols-2 gap-4 md:gap-8 bg-[#F8FAFC] p-4 md:p-5 rounded-xl border border-[#E2E8F0]">
          {/* Left Column: Current R-Value */}
          <div>
            <div className="text-2xl md:text-3xl font-black text-[#151A2D] tracking-tight">
              {inspection.current_r_value || '—'}
            </div>
            <div className="text-xs font-medium text-[#64748B] mt-0.5">
              {subtitleInfo}
            </div>
          </div>

          {/* Right Column: Attic Size */}
          <div>
            <div className="text-2xl md:text-3xl font-black text-[#151A2D] tracking-tight">
              {inspection.attic_sqft !== null && inspection.attic_sqft !== undefined
                ? `${Number(inspection.attic_sqft).toLocaleString()} sqft`
                : '—'}
            </div>
            <div className="text-xs font-medium text-[#64748B] mt-0.5">
              Attic size
            </div>
          </div>
        </div>

        {/* Secondary Specs Bar (Target R, Depth, Baffles, Condition) */}
        {(inspection.target_r_value || inspection.insulation_depth || inspection.soffits_baffles_condition || inspection.general_condition) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
            {inspection.target_r_value && (
              <div className="bg-white p-2.5 rounded-lg border border-[#E2E8F0]">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase block">Target R-Value</span>
                <span className="font-bold text-[#151A2D]">{inspection.target_r_value}</span>
              </div>
            )}
            {inspection.insulation_depth && (
              <div className="bg-white p-2.5 rounded-lg border border-[#E2E8F0]">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase block">Insulation Depth</span>
                <span className="font-bold text-[#151A2D]">{inspection.insulation_depth}</span>
              </div>
            )}
            {inspection.soffits_baffles_condition && (
              <div className="bg-white p-2.5 rounded-lg border border-[#E2E8F0]">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase block">Soffits & Baffles</span>
                <span className="font-bold text-[#151A2D] truncate block">{inspection.soffits_baffles_condition}</span>
              </div>
            )}
            {inspection.general_condition && (
              <div className="bg-white p-2.5 rounded-lg border border-[#E2E8F0]">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase block">General Condition</span>
                <span className="font-bold text-[#151A2D] truncate block">{inspection.general_condition}</span>
              </div>
            )}
          </div>
        )}

        {/* Notes if available */}
        {inspection.notes && (
          <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60 text-xs text-[#151A2D] font-medium leading-relaxed">
            <span className="font-bold text-amber-900 block mb-0.5 uppercase text-[10px] tracking-wider">
              Inspection Notes:
            </span>
            {inspection.notes}
          </div>
        )}

        {/* Grouped Photos Sections: Exactly matching client screenshot */}
        <div className="space-y-4 pt-1">
          {PHOTO_CATEGORIES.map(category => {
            const categoryPhotos = photosByCategory.get(category.id) || [];
            if (categoryPhotos.length === 0) return null;

            return (
              <div key={category.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black text-[#151A2D] tracking-tight uppercase">
                    {category.label}
                  </h3>
                  <span className="text-xs font-bold text-[#94A3B8]">
                    {categoryPhotos.length}
                  </span>
                </div>

                {/* Photo Grid: 2 columns mobile, 3-4 columns desktop */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {categoryPhotos.map(photo => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => handleThumbnailClick(photo)}
                      className="group relative aspect-square rounded-xl overflow-hidden bg-black/5 border border-[#E2E8F0] hover:border-[#76C442] hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#76C442]/50 text-left"
                    >
                      <img
                        src={photo.signedUrl || photo.storage_path}
                        alt={photo.caption || category.label}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      {photo.caption && (
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-white">
                          <p className="text-[10px] font-semibold truncate leading-tight">
                            {photo.caption}
                          </p>
                        </div>
                      )}
                      <div className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <ExternalLink size={12} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {allPhotos.length === 0 && (
            <div className="text-center py-6 px-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] border-dashed">
              <Camera className="mx-auto text-[#94A3B8] mb-1.5" size={24} />
              <p className="text-xs font-bold text-[#64748B]">No photos attached to this inspection</p>
              {canEdit && onEditInspection && (
                <button
                  onClick={() => onEditInspection(inspection)}
                  className="mt-2 text-xs font-black text-[#76C442] hover:underline cursor-pointer"
                >
                  + Add Inspection Photos
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      <InspectionLightbox
        photos={allPhotos}
        currentIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={(newIdx) => setLightboxIndex(newIdx)}
        onDeletePhoto={onDeletePhoto}
        canDelete={canDeletePhoto}
      />
    </>
  );
};
