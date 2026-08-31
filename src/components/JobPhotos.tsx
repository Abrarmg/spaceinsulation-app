import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Camera, 
  Upload, 
  Loader2, 
  Trash2, 
  FileText, 
  Eye, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

interface JobMedia {
  id: string;
  job_id: string;
  category: 'before' | 'after' | 'permit';
  file_url: string;
  created_at: string;
  publicUrl?: string; // Loaded dynamically
}

interface JobPhotosProps {
  jobId: string;
}

type TabType = 'before' | 'after' | 'permit';

export const JobPhotos: React.FC<JobPhotosProps> = ({ jobId }) => {
  const [activeTab, setActiveTab] = useState<TabType>('before');
  const [mediaList, setMediaList] = useState<JobMedia[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Full-screen carousel preview states
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  // Fetch job media records from database & link public urls
  const fetchMedia = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('job_media')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const items = (data || []) as JobMedia[];
      
      // Load public URL for each file (since storage path is in file_url)
      const updatedItems = items.map(item => {
        const { data: urlData } = supabase.storage
          .from('job-media')
          .getPublicUrl(item.file_url);
        return {
          ...item,
          publicUrl: urlData.publicUrl
        };
      });

      setMediaList(updatedItems);
    } catch (err: any) {
      console.error('Failed to load job media:', err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  // Filter media based on active tab
  const filteredMedia = mediaList.filter(item => item.category === activeTab);

  // Handle file uploads
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = e.target.files;
    if (!rawFiles || rawFiles.length === 0) return;

    setUploadError(null);
    setSuccessMsg(null);

    const filesArray = Array.from(rawFiles);

    // 1. Single-file handling for Permit tab
    if (activeTab === 'permit') {
      const file = filesArray[0];
      const MAX_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        setUploadError('File is too large. Maximum size allowed is 10MB.');
        e.target.value = '';
        return;
      }

      setIsUploading(true);
      setUploadStatusText('Uploading file...');
      try {
        const fileExt = file.name.split('.').pop();
        const filename = `permit/${jobId}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        
        const { error: uploadErr } = await supabase.storage
          .from('job-media')
          .upload(filename, file, {
            cacheControl: '3600',
            upsert: true,
            contentType: file.type
          });

        if (uploadErr) throw uploadErr;

        const { error: dbErr } = await supabase
          .from('job_media')
          .insert([{
            job_id: jobId,
            category: 'permit',
            file_url: filename
          }]);

        if (dbErr) throw dbErr;

        setSuccessMsg(`${file.name} uploaded successfully!`);
        await fetchMedia();
        setTimeout(() => setSuccessMsg(null), 3000);
      } catch (err: any) {
        console.error('Permit upload failed:', err);
        setUploadError(err.message || 'Failed to upload permit file.');
      } finally {
        setIsUploading(false);
        setUploadStatusText(null);
        e.target.value = '';
      }
      return;
    }

    // 2. Multi-image handling for Before & After tabs
    const categoryLabel = activeTab === 'before' ? 'Before' : 'After';
    const existingCount = mediaList.filter(item => item.category === activeTab).length;
    const remainingAllowed = 20 - existingCount;

    if (existingCount >= 20) {
      setUploadError(`You can upload up to 20 ${categoryLabel} images.`);
      e.target.value = '';
      return;
    }

    let filesToUpload = filesArray;
    let limitNotice = '';

    if (filesArray.length > remainingAllowed) {
      filesToUpload = filesArray.slice(0, remainingAllowed);
      limitNotice = `This job already has ${existingCount} ${categoryLabel} images. Only ${remainingAllowed} more can be uploaded.`;
    }

    // Validate file sizes (10MB limit per image)
    const MAX_SIZE = 10 * 1024 * 1024;
    const validFiles: File[] = [];
    let skippedCount = 0;

    for (const f of filesToUpload) {
      if (f.size <= MAX_SIZE) {
        validFiles.push(f);
      } else {
        skippedCount++;
      }
    }

    if (validFiles.length === 0) {
      setUploadError('All selected images exceeded the 10MB maximum file size limit.');
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      setUploadStatusText(`Uploading ${i + 1} of ${validFiles.length}...`);

      try {
        const fileExt = file.name.split('.').pop();
        const uniqueSuffix = Math.random().toString(36).substring(2, 7);
        const filename = `${activeTab}/${jobId}/${Date.now()}_${i}_${uniqueSuffix}.${fileExt}`;

        const { error: storageErr } = await supabase.storage
          .from('job-media')
          .upload(filename, file, {
            cacheControl: '3600',
            upsert: true,
            contentType: file.type
          });

        if (storageErr) {
          console.error(`Storage upload error for file ${file.name}:`, storageErr);
          failCount++;
          continue;
        }

        const { error: dbErr } = await supabase
          .from('job_media')
          .insert([{
            job_id: jobId,
            category: activeTab,
            file_url: filename
          }]);

        if (dbErr) {
          console.error(`Database insert error for file ${file.name}:`, dbErr);
          await supabase.storage.from('job-media').remove([filename]);
          failCount++;
          continue;
        }

        successCount++;
      } catch (err: any) {
        console.error(`Error uploading ${file.name}:`, err);
        failCount++;
      }
    }

    setIsUploading(false);
    setUploadStatusText(null);
    e.target.value = ''; // Reset file input

    // Refresh media gallery immediately
    await fetchMedia();

    // Construct user feedback banners
    const messages: string[] = [];

    if (successCount > 0) {
      messages.push(`${successCount} ${categoryLabel} ${successCount === 1 ? 'photo' : 'photos'} uploaded successfully.`);
    }

    if (limitNotice) {
      messages.push(limitNotice);
    }

    if (skippedCount > 0) {
      messages.push(`${skippedCount} ${skippedCount === 1 ? 'file was' : 'files were'} skipped (>10MB).`);
    }

    if (failCount > 0) {
      setUploadError(`${failCount} ${failCount === 1 ? 'photo' : 'photos'} failed to upload.`);
    }

    if (messages.length > 0) {
      setSuccessMsg(messages.join(' '));
      setTimeout(() => setSuccessMsg(null), 5000);
    }
  };

  // Delete Job Media
  const handleDeleteMedia = async (item: JobMedia, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering full-screen preview

    const confirmDelete = window.confirm('Are you sure you want to delete this media file?');
    if (!confirmDelete) return;

    try {
      // 1. Delete from Supabase Storage using the file_url storage path
      const { error: storageErr } = await supabase.storage
        .from('job-media')
        .remove([item.file_url]);

      if (storageErr) throw storageErr;

      // 2. Delete from Database
      const { error: dbErr } = await supabase
        .from('job_media')
        .delete()
        .eq('id', item.id);

      if (dbErr) throw dbErr;

      // Reload gallery
      await fetchMedia();
      
      // If previewing the deleted item, close preview
      setPreviewIndex(null);
    } catch (err: any) {
      console.error('Delete failed:', err);
      alert('Failed to delete media: ' + err.message);
    }
  };

  // Navigation inside full screen preview carousel
  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewIndex === null) return;
    setPreviewIndex(prev => (prev !== null && prev > 0) ? prev - 1 : filteredMedia.length - 1);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewIndex === null) return;
    setPreviewIndex(prev => (prev !== null && prev < filteredMedia.length - 1) ? prev + 1 : 0);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-brand-grey-medium p-6 space-y-6">
      
      {/* Title & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-grey-medium pb-4">
        <div>
          <h3 className="text-base font-bold text-[#151A2D] m-0">Job Photos & Files</h3>
          <p className="text-xs text-[#64748B] mt-0.5">Attach before/after photos and job files.</p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 bg-brand-grey p-1 rounded-lg border border-brand-grey-medium shrink-0">
          {(['before', 'after', 'permit'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setPreviewIndex(null);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'bg-[#151A2D] text-white shadow-sm'
                  : 'text-[#64748B] hover:text-[#151A2D] bg-[#F1F5F9]'
              }`}
            >
              {tab === 'permit' ? 'FILES' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Alert Banners */}
      {uploadError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg flex items-center gap-2">
          <CheckCircle2 size={14} className="text-green-500 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid: Upload Target & Photo Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        
        {/* Upload Trigger Square */}
        <div className="relative border-2 border-dashed border-brand-grey-dark/40 hover:border-brand-green/80 rounded-xl bg-brand-grey-light transition-all flex flex-col items-center justify-center p-4 text-center group cursor-pointer aspect-square">
          {isUploading ? (
            <div className="space-y-2 flex flex-col items-center justify-center text-brand-grey-dark">
              <Loader2 className="w-8 h-8 animate-spin text-brand-green" />
              <span className="text-[10px] font-semibold text-brand-charcoal text-center px-1">
                {uploadStatusText || 'Uploading...'}
              </span>
            </div>
          ) : (
            <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer p-4 select-none">
              <input
                type="file"
                accept={activeTab === 'permit' ? 'image/*,application/pdf' : 'image/*'}
                multiple={activeTab === 'before' || activeTab === 'after'}
                onChange={handleUpload}
                className="hidden"
                disabled={isUploading}
              />
              <div className="p-3 bg-white rounded-full border border-brand-grey-medium group-hover:scale-105 transition-transform shadow-sm">
                {activeTab === 'permit' ? (
                  <Upload size={18} className="text-brand-charcoal" />
                ) : (
                  <Camera size={18} className="text-brand-charcoal" />
                )}
              </div>
              <span className="text-xs font-bold text-[#151A2D] mt-3">
                {activeTab === 'permit' ? '+ UPLOAD FILE' : `+ UPLOAD ${activeTab.toUpperCase()} PHOTOS`}
              </span>
              <span className="text-[9px] text-[#64748B] mt-1">
                {activeTab === 'permit' ? 'PDF or Image' : 'Select up to 20 photos'}
              </span>
            </label>
          )}
        </div>

        {/* Gallery Thumbnails */}
        {filteredMedia.map((item, index) => {
          // Identify PDF based on filename extension
          const isPdf = item.file_url.toLowerCase().endsWith('.pdf');
          
          return (
            <div 
              key={item.id}
              className="relative rounded-xl border border-brand-grey-medium overflow-hidden bg-brand-grey group shadow-sm hover:shadow transition-all aspect-square flex cursor-pointer"
              onClick={() => {
                if (isPdf) {
                  // PDFs are viewed in a new browser tab for clean zoom/scroll
                  window.open(item.publicUrl, '_blank');
                } else {
                  setPreviewIndex(index);
                }
              }}
            >
              {isPdf ? (
                // PDF display placeholder
                <div className="flex-1 flex flex-col items-center justify-center p-4 bg-white text-center gap-1.5 select-none">
                  <FileText size={40} className="text-purple-500 stroke-[1.2]" />
                  <span className="text-[10px] font-bold text-brand-charcoal max-w-full truncate px-1">
                    Permit Document
                  </span>
                  <span className="text-[9px] text-brand-grey-dark">Click to Open</span>
                </div>
              ) : (
                // Image display thumbnail
                <img 
                  src={item.publicUrl} 
                  alt={`${item.category} media`} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                />
              )}

              {/* Hover Overlay Controls */}
              <div className="absolute inset-0 bg-brand-charcoal/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {!isPdf && (
                  <button 
                    className="p-1.5 bg-white text-brand-charcoal rounded-lg hover:bg-brand-grey transition-colors cursor-pointer"
                    title="View Fullscreen"
                  >
                    <Eye size={14} />
                  </button>
                )}
                <button 
                  onClick={(e) => handleDeleteMedia(item, e)}
                  className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
                  title="Delete Document"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}

      </div>

      {/* Empty State Banner */}
      {!loading && filteredMedia.length === 0 && (
        <div className="py-8 bg-brand-grey-light rounded-xl border border-brand-grey border-dashed text-center">
          <span className="text-xs text-brand-grey-dark italic">
            No {activeTab} {activeTab === 'permit' ? 'files' : 'photos'} uploaded yet.
          </span>
        </div>
      )}

      {/* Full-screen Image Preview Carousel Modal */}
      {previewIndex !== null && filteredMedia[previewIndex] && (
        <div className="fixed inset-0 z-50 bg-brand-charcoal/95 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          {/* Top Header Bar */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-10">
            <span className="text-xs font-bold uppercase tracking-wider">
              {activeTab} Photo ({previewIndex + 1} of {filteredMedia.length})
            </span>
            <button
              onClick={() => setPreviewIndex(null)}
              className="p-1 text-brand-grey-dark hover:text-white transition-colors cursor-pointer"
            >
              <X size={24} />
            </button>
          </div>

          {/* Previous Arrow */}
          {filteredMedia.length > 1 && (
            <button
              onClick={handlePrev}
              className="absolute left-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer z-10"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {/* Carousel Image container */}
          <div className="max-w-4xl max-h-[80vh] w-full flex items-center justify-center relative select-none">
            <img
              src={filteredMedia[previewIndex].publicUrl}
              alt="fullscreen preview"
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>

          {/* Next Arrow */}
          {filteredMedia.length > 1 && (
            <button
              onClick={handleNext}
              className="absolute right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer z-10"
            >
              <ChevronRight size={24} />
            </button>
          )}

          {/* Action Row */}
          <div className="absolute bottom-6 flex items-center gap-4">
            <button
              onClick={(e) => handleDeleteMedia(filteredMedia[previewIndex], e)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-md"
            >
              <Trash2 size={13} />
              <span>Delete Photo</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
