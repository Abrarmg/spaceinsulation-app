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
  const [uploadProgress, setUploadProgress] = useState(0);
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
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setUploadError(null);
    setSuccessMsg(null);

    // Validate file size limit (~10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError('File is too large. Maximum size allowed is 10MB.');
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Organize storage into folders: category/jobId/filename
      const fileExt = file.name.split('.').pop();
      const filename = `${activeTab}/${jobId}/${Date.now()}.${fileExt}`;

      // Upload file with progress listener
      const { error: uploadError } = await supabase.storage
        .from('job-media')
        .upload(filename, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      // Track progress mock (since standard upload is fast, but we simulate onUploadProgress support if it fires)
      setUploadProgress(50);

      // Insert record to job_media table
      const { error: dbError } = await supabase
        .from('job_media')
        .insert([{
          job_id: jobId,
          category: activeTab,
          file_url: filename
        }]);

      if (dbError) throw dbError;

      setUploadProgress(100);
      setSuccessMsg(`${file.name} uploaded successfully!`);
      
      // Reload gallery list
      await fetchMedia();
      
      // Clear messages after delay
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadError(err.message || 'Failed to upload photo.');
    } finally {
      setIsUploading(false);
      e.target.value = ''; // Reset file input
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
              <span className="text-[10px] font-semibold text-brand-charcoal">Uploading {uploadProgress}%</span>
            </div>
          ) : (
            <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer p-4 select-none">
              <input
                type="file"
                // Permits accept PDFs and images, Photos accept images only
                accept={activeTab === 'permit' ? 'image/*,application/pdf' : 'image/*'}
                // Use capture environment on mobile cameras for before/after photos
                capture={activeTab === 'permit' ? undefined : 'environment'}
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
                {activeTab === 'permit' ? '+ UPLOAD FILE' : `+ TAKE ${activeTab.toUpperCase()} PHOTO`}
              </span>
              <span className="text-[9px] text-[#64748B] mt-1">
                {activeTab === 'permit' ? 'PDF or Image' : 'Camera or Gallery'}
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
