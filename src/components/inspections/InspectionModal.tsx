import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  X, 
  Loader2, 
  Camera, 
  Upload, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Tag, 
  Calendar, 
  User, 
  Clock, 
  FileText,
  Check
} from 'lucide-react';
import { InspectionReport, InspectionPhoto, PHOTO_CATEGORIES, PhotoCategory } from './types';

interface InspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (reportId?: string) => void;
  customerId: string;
  reportToEdit?: InspectionReport | null;
  jobId?: string | null;
  assessmentId?: string | null;
  readOnly?: boolean;
}

export const InspectionModal: React.FC<InspectionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  customerId,
  reportToEdit = null,
  jobId = null,
  assessmentId = null,
  readOnly = false
}) => {
  // Form State
  const [inspectionDate, setInspectionDate] = useState<string>('');
  const [status, setStatus] = useState<'draft' | 'completed'>('draft');
  const [inspectedBy, setInspectedBy] = useState<string>('');
  
  // Technical Condition Specs
  const [currentRValue, setCurrentRValue] = useState<string>('');
  const [targetRValue, setTargetRValue] = useState<string>('R-60');
  const [atticSqft, setAtticSqft] = useState<number | ''>('');
  const [currentInsulationType, setCurrentInsulationType] = useState<string>('Fiberglass');
  const [insulationDepth, setInsulationDepth] = useState<string>('');
  const [soffitsBafflesCondition, setSoffitsBafflesCondition] = useState<string>('');
  const [generalCondition, setGeneralCondition] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Profiles for inspector dropdown
  const [profiles, setProfiles] = useState<Array<{ id: string; full_name: string }>>([]);

  // Existing and newly uploaded photos
  const [photos, setPhotos] = useState<InspectionPhoto[]>([]);
  const [activePhotoCategory, setActivePhotoCategory] = useState<PhotoCategory>('insulation_depth');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Status & notifications
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isEditMode = !!reportToEdit;

  // Fetch profiles for inspector dropdown
  useEffect(() => {
    async function loadProfiles() {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name');
      if (data) setProfiles(data);
    }
    loadProfiles();
  }, []);

  // Initialize or reset form values
  useEffect(() => {
    if (isOpen) {
      if (reportToEdit) {
        setInspectionDate(
          reportToEdit.inspection_date
            ? reportToEdit.inspection_date.split('T')[0]
            : new Date().toISOString().split('T')[0]
        );
        setStatus(reportToEdit.status || 'draft');
        setInspectedBy(reportToEdit.inspected_by || '');
        setCurrentRValue(reportToEdit.current_r_value || '');
        setTargetRValue(reportToEdit.target_r_value || 'R-60');
        setAtticSqft(
          reportToEdit.attic_sqft !== null && reportToEdit.attic_sqft !== undefined
            ? Number(reportToEdit.attic_sqft)
            : ''
        );
        setCurrentInsulationType(reportToEdit.current_insulation_type || 'Fiberglass');
        setInsulationDepth(reportToEdit.insulation_depth || '');
        setSoffitsBafflesCondition(reportToEdit.soffits_baffles_condition || '');
        setGeneralCondition(reportToEdit.general_condition || '');
        setNotes(reportToEdit.notes || '');
        setPhotos(reportToEdit.photos || []);
      } else {
        setInspectionDate(new Date().toISOString().split('T')[0]);
        setStatus('draft');
        supabase.auth.getSession().then(({ data }) => {
          if (data?.session?.user?.id) {
            setInspectedBy(data.session.user.id);
          }
        });
        setCurrentRValue('R-11');
        setTargetRValue('R-60');
        setAtticSqft('');
        setCurrentInsulationType('Fiberglass');
        setInsulationDepth('2 inches');
        setSoffitsBafflesCondition('');
        setGeneralCondition('');
        setNotes('');
        setPhotos([]);
      }
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, reportToEdit]);

  // Load signed URLs for photos if missing
  const loadSignedUrls = useCallback(async (rawPhotos: InspectionPhoto[]) => {
    const updated = await Promise.all(
      rawPhotos.map(async (p) => {
        if (p.signedUrl) return p;
        try {
          const { data } = await supabase.storage
            .from('inspection-photos')
            .createSignedUrl(p.storage_path, 3600);
          return { ...p, signedUrl: data?.signedUrl };
        } catch {
          return p;
        }
      })
    );
    setPhotos(updated);
  }, []);

  useEffect(() => {
    if (photos.length > 0 && photos.some(p => !p.signedUrl)) {
      loadSignedUrls(photos);
    }
  }, [photos, loadSignedUrls]);

  if (!isOpen) return null;

  // Handle uploading photos to Supabase Storage and database
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMsg(null);
    setIsUploading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData?.session?.user?.id || null;

      // Make sure we have an inspection report ID to attach photos to
      let currentReportId = reportToEdit?.id;
      if (!currentReportId) {
        // Auto-save initial draft report so photos have an inspection_report_id
        const initialReportPayload = {
          customer_id: customerId,
          job_id: jobId,
          assessment_id: assessmentId,
          inspected_by: inspectedBy || currentUserId,
          inspection_date: new Date(inspectionDate).toISOString(),
          status: 'draft',
          current_r_value: currentRValue || null,
          target_r_value: targetRValue || null,
          attic_sqft: atticSqft !== '' ? Number(atticSqft) : null,
          current_insulation_type: currentInsulationType || null,
          insulation_depth: insulationDepth || null,
          soffits_baffles_condition: soffitsBafflesCondition || null,
          general_condition: generalCondition || null,
          notes: notes || null
        };

        const { data: newReport, error: createReportErr } = await supabase
          .from('inspection_reports')
          .insert([initialReportPayload])
          .select('*')
          .single();

        if (createReportErr) throw createReportErr;
        currentReportId = newReport.id;
      }

      const filesArray = Array.from(files);
      const newPhotoRecords: InspectionPhoto[] = [];

      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];
        setUploadProgress(`Uploading ${i + 1} of ${filesArray.length}...`);

        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`File ${file.name} exceeds the 10MB limit.`);
        }

        const ext = file.name.split('.').pop() || 'jpg';
        const fileUuid = crypto.randomUUID();
        const storagePath = `customers/${customerId}/inspections/${currentReportId}/${fileUuid}.${ext}`;

        const { error: storageErr } = await supabase.storage
          .from('inspection-photos')
          .upload(storagePath, file, {
            contentType: file.type || 'image/jpeg',
            upsert: true
          });

        if (storageErr) throw storageErr;

        // Create signed URL for instant display
        const { data: signedData } = await supabase.storage
          .from('inspection-photos')
          .createSignedUrl(storagePath, 3600);

        // Insert database row
        const { data: dbPhoto, error: dbErr } = await supabase
          .from('inspection_photos')
          .insert([{
            inspection_report_id: currentReportId,
            customer_id: customerId,
            uploaded_by: currentUserId,
            category: activePhotoCategory,
            storage_path: storagePath,
            file_name: file.name,
            sort_order: photos.length + i
          }])
          .select('*')
          .single();

        if (dbErr) throw dbErr;

        newPhotoRecords.push({
          ...dbPhoto,
          signedUrl: signedData?.signedUrl
        });
      }

      setPhotos(prev => [...prev, ...newPhotoRecords]);
      setSuccessMsg(`${filesArray.length} photo(s) uploaded successfully!`);
    } catch (err: any) {
      console.error('Photo upload failed:', err);
      setErrorMsg(err.message || 'Failed to upload photo(s).');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Photo Deletion
  const handleDeletePhoto = async (photo: InspectionPhoto) => {
    if (!window.confirm('Are you sure you want to remove this inspection photo?')) return;

    try {
      // 1. Delete from Supabase Storage
      await supabase.storage.from('inspection-photos').remove([photo.storage_path]);

      // 2. Delete database row
      const { error } = await supabase
        .from('inspection_photos')
        .delete()
        .eq('id', photo.id);

      if (error) throw error;

      setPhotos(prev => prev.filter(p => p.id !== photo.id));
    } catch (err: any) {
      console.error('Failed to delete photo:', err);
      alert('Failed to delete photo: ' + err.message);
    }
  };

  // Handle caption update
  const handleUpdateCaption = async (photoId: string, caption: string) => {
    setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, caption } : p));
    try {
      await supabase
        .from('inspection_photos')
        .update({ caption })
        .eq('id', photoId);
    } catch (err) {
      console.error('Failed to update photo caption:', err);
    }
  };

  // Submit Inspection Report
  const handleSubmit = async (targetStatus?: 'draft' | 'completed') => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    const finalStatus = targetStatus || status;

    const payload = {
      customer_id: customerId,
      job_id: jobId || reportToEdit?.job_id || null,
      assessment_id: assessmentId || reportToEdit?.assessment_id || null,
      inspected_by: inspectedBy || null,
      inspection_date: new Date(inspectionDate).toISOString(),
      status: finalStatus,
      current_r_value: currentRValue.trim() || null,
      target_r_value: targetRValue.trim() || null,
      attic_sqft: atticSqft !== '' ? Number(atticSqft) : null,
      current_insulation_type: currentInsulationType.trim() || null,
      insulation_depth: insulationDepth.trim() || null,
      soffits_baffles_condition: soffitsBafflesCondition.trim() || null,
      general_condition: generalCondition.trim() || null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString()
    };

    try {
      let savedId = reportToEdit?.id;

      if (reportToEdit?.id) {
        const { error } = await supabase
          .from('inspection_reports')
          .update(payload)
          .eq('id', reportToEdit.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('inspection_reports')
          .insert([payload])
          .select('id')
          .single();

        if (error) throw error;
        savedId = data?.id;
      }

      setSuccessMsg(
        finalStatus === 'completed'
          ? 'Inspection completed and saved successfully!'
          : 'Inspection draft saved!'
      );

      setTimeout(() => {
        onSuccess(savedId);
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Failed to save inspection report:', err);
      setErrorMsg(err.message || 'An error occurred while saving the report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryPhotos = photos.filter(p => p.category === activePhotoCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center font-sans">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#151A2D]/60 backdrop-blur-xs transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Container */}
      <div className="relative bg-white w-full max-w-3xl mx-4 rounded-2xl shadow-2xl overflow-hidden border border-[#E7E9ED] flex flex-col max-h-[92vh]">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[#E7E9ED] bg-[#151A2D] text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <Camera className="text-[#76C442]" size={18} />
            <h2 className="text-sm md:text-base font-bold uppercase tracking-wider text-white m-0">
              {isEditMode ? 'Attic Inspection Report' : 'New Attic Inspection Report'}
            </h2>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
              status === 'completed' 
                ? 'bg-emerald-500 text-white' 
                : 'bg-amber-400 text-[#151A2D]'
            }`}>
              {status}
            </span>
          </div>

          <button 
            onClick={onClose}
            className="text-[#737A86] hover:text-white transition-colors cursor-pointer border-none bg-transparent"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-grow overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-lg flex items-start gap-3 text-xs font-semibold bg-red-50 text-red-800 border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-lg flex items-start gap-3 text-xs font-semibold bg-green-50 text-green-800 border border-green-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Section 1: Inspection Details */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-[#151A2D] uppercase tracking-wider border-b border-[#E7E9ED] pb-1 flex items-center gap-1.5">
              <FileText size={12} className="text-[#76C442]" />
              <span>1. Inspection Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1.5">
                  Inspection Date
                </label>
                <input
                  type="date"
                  disabled={readOnly}
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8EC] rounded-lg text-xs transition-all focus:outline-none focus:border-[#76C442] focus:ring-2 focus:ring-[#76C442]/15 bg-white disabled:bg-gray-100"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1.5">
                  Inspector
                </label>
                <select
                  disabled={readOnly}
                  value={inspectedBy}
                  onChange={(e) => setInspectedBy(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8EC] rounded-lg text-xs transition-all focus:outline-none focus:border-[#76C442] focus:ring-2 focus:ring-[#76C442]/15 bg-white disabled:bg-gray-100 cursor-pointer"
                >
                  <option value="">Select Inspector...</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1.5">
                  Report Status
                </label>
                <select
                  disabled={readOnly}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-[#E6E8EC] rounded-lg text-xs font-bold transition-all focus:outline-none focus:border-[#76C442] focus:ring-2 focus:ring-[#76C442]/15 bg-white disabled:bg-gray-100 cursor-pointer"
                >
                  <option value="draft">Draft (Work in Progress)</option>
                  <option value="completed">Completed (Finalized)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Current Condition Specs */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-[#151A2D] uppercase tracking-wider border-b border-[#E7E9ED] pb-1 flex items-center gap-1.5">
              <Tag size={12} className="text-[#76C442]" />
              <span>2. Current Condition Specifications</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1.5">
                  Current R-Value
                </label>
                <input
                  type="text"
                  disabled={readOnly}
                  value={currentRValue}
                  onChange={(e) => setCurrentRValue(e.target.value)}
                  placeholder="e.g. R-11"
                  className="w-full px-3 py-2 border border-[#E6E8EC] rounded-lg text-xs font-bold transition-all focus:outline-none focus:border-[#76C442] focus:ring-2 focus:ring-[#76C442]/15 disabled:bg-gray-100"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1.5">
                  Target R-Value
                </label>
                <input
                  type="text"
                  disabled={readOnly}
                  value={targetRValue}
                  onChange={(e) => setTargetRValue(e.target.value)}
                  placeholder="e.g. R-60"
                  className="w-full px-3 py-2 border border-[#E6E8EC] rounded-lg text-xs font-bold transition-all focus:outline-none focus:border-[#76C442] focus:ring-2 focus:ring-[#76C442]/15 disabled:bg-gray-100"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1.5">
                  Attic Size (SQFT)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    disabled={readOnly}
                    value={atticSqft}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAtticSqft(v === '' ? '' : Math.max(0, parseInt(v, 10) || 0));
                    }}
                    placeholder="e.g. 1,300"
                    className="w-full px-3 py-2 pr-14 border border-[#E6E8EC] rounded-lg text-xs font-bold transition-all focus:outline-none focus:border-[#76C442] focus:ring-2 focus:ring-[#76C442]/15 disabled:bg-gray-100"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#737A86] bg-[#F6F7F9] px-2 py-0.5 rounded border border-[#E7E9ED]">
                    SQFT
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1.5">
                  Current Insulation Type
                </label>
                <input
                  type="text"
                  disabled={readOnly}
                  value={currentInsulationType}
                  onChange={(e) => setCurrentInsulationType(e.target.value)}
                  placeholder="e.g. Fiberglass, Cellulose, None"
                  className="w-full px-3 py-2 border border-[#E6E8EC] rounded-lg text-xs transition-all focus:outline-none focus:border-[#76C442] focus:ring-2 focus:ring-[#76C442]/15 disabled:bg-gray-100"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1.5">
                  Insulation Depth
                </label>
                <input
                  type="text"
                  disabled={readOnly}
                  value={insulationDepth}
                  onChange={(e) => setInsulationDepth(e.target.value)}
                  placeholder="e.g. 2 inches, 4 inches"
                  className="w-full px-3 py-2 border border-[#E6E8EC] rounded-lg text-xs transition-all focus:outline-none focus:border-[#76C442] focus:ring-2 focus:ring-[#76C442]/15 disabled:bg-gray-100"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1.5">
                  Soffits / Baffles Condition
                </label>
                <input
                  type="text"
                  disabled={readOnly}
                  value={soffitsBafflesCondition}
                  onChange={(e) => setSoffitsBafflesCondition(e.target.value)}
                  placeholder="e.g. Clear, Blocked, Needs Baffles"
                  className="w-full px-3 py-2 border border-[#E6E8EC] rounded-lg text-xs transition-all focus:outline-none focus:border-[#76C442] focus:ring-2 focus:ring-[#76C442]/15 disabled:bg-gray-100"
                />
              </div>
            </div>

            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-[#737A86] uppercase tracking-wider mb-1.5">
                General Current Condition
              </label>
              <input
                type="text"
                disabled={readOnly}
                value={generalCondition}
                onChange={(e) => setGeneralCondition(e.target.value)}
                placeholder="e.g. Dry, dust accumulation, cold drafts reported"
                className="w-full px-3 py-2 border border-[#E6E8EC] rounded-lg text-xs transition-all focus:outline-none focus:border-[#76C442] focus:ring-2 focus:ring-[#76C442]/15 disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* Section 3: Attic Photos (Grouped by Category) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#E7E9ED] pb-1">
              <h3 className="text-[10px] font-black text-[#151A2D] uppercase tracking-wider flex items-center gap-1.5">
                <Camera size={12} className="text-[#76C442]" />
                <span>3. Attic Inspection Photos ({photos.length} Total)</span>
              </h3>

              {!readOnly && (
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] text-xs font-black rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>{uploadProgress || 'Uploading...'}</span>
                      </>
                    ) : (
                      <>
                        <Camera size={13} />
                        <span>+ Take / Upload Photo</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Category Tabs Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {PHOTO_CATEGORIES.map(category => {
                const count = photos.filter(p => p.category === category.id).length;
                const isActive = activePhotoCategory === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setActivePhotoCategory(category.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-[#151A2D] text-white shadow-xs'
                        : 'bg-[#F6F7F9] text-[#737A86] hover:bg-[#E7E9ED]'
                    }`}
                  >
                    <span>{category.label}</span>
                    {count > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                        isActive ? 'bg-[#76C442] text-[#151A2D]' : 'bg-white text-[#151A2D]'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Photos in Active Category */}
            <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0] min-h-[140px]">
              {categoryPhotos.length === 0 ? (
                <div className="text-center py-6">
                  <Camera className="mx-auto text-[#CBD5E1] mb-2" size={28} />
                  <p className="text-xs font-bold text-[#64748B]">
                    No photos in {PHOTO_CATEGORIES.find(c => c.id === activePhotoCategory)?.label} yet
                  </p>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 text-xs font-black text-[#76C442] hover:underline cursor-pointer"
                    >
                      + Add photos to this category
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {categoryPhotos.map(photo => (
                    <div 
                      key={photo.id}
                      className="group relative bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-xs flex flex-col"
                    >
                      <div className="relative aspect-square overflow-hidden bg-black/5">
                        <img
                          src={photo.signedUrl || photo.storage_path}
                          alt={photo.caption || 'Attic Photo'}
                          className="w-full h-full object-cover"
                        />
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => handleDeletePhoto(photo)}
                            className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/60 hover:bg-red-600 text-white transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                            title="Delete Photo"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      <div className="p-2 bg-white">
                        <input
                          type="text"
                          disabled={readOnly}
                          defaultValue={photo.caption || ''}
                          onBlur={(e) => handleUpdateCaption(photo.id, e.target.value)}
                          placeholder="Add caption..."
                          className="w-full text-[11px] px-1.5 py-1 border border-transparent hover:border-[#E2E8F0] focus:border-[#76C442] rounded font-medium focus:outline-none transition-colors"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Notes */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-[#151A2D] uppercase tracking-wider border-b border-[#E7E9ED] pb-1 flex items-center gap-1.5">
              <FileText size={12} className="text-[#76C442]" />
              <span>4. Inspection Notes & Recommendations</span>
            </h3>

            <textarea
              disabled={readOnly}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Attic hatch needs weatherstripping and dam box. North soffit requires 8 baffles. Recommend vacuum removal of old contaminated fiberglass before blowing R-60 cellulose."
              rows={3}
              className="w-full px-3 py-2 border border-[#E6E8EC] focus:border-[#76C442] rounded-lg text-xs transition-all focus:outline-none focus:ring-2 focus:ring-[#76C442]/10 disabled:bg-gray-100"
            />
          </div>
        </div>

        {/* Sticky Footer Actions */}
        <div className="sticky bottom-0 z-10 px-6 py-4 border-t border-[#E7E9ED] bg-[#F6F7F9] flex items-center justify-between rounded-b-2xl shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-[#E6E8EC] hover:bg-white text-[#737A86] hover:text-[#171A1F] text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            {readOnly ? 'Close' : 'Cancel'}
          </button>

          {!readOnly && (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleSubmit('draft')}
                disabled={isSubmitting || isUploading}
                className="px-4 py-2 bg-white hover:bg-[#F6F7F9] text-[#151A2D] border border-[#CBD5E1] text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Clock size={13} />}
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                onClick={() => handleSubmit('completed')}
                disabled={isSubmitting || isUploading}
                className="px-5 py-2 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] text-xs font-black rounded-lg shadow-xs hover:shadow transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-[#151A2D]" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} strokeWidth={3} />
                    <span>Complete Inspection</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
