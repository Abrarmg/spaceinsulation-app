import React, { useRef, useEffect, useState } from 'react';
import SignaturePad from 'signature_pad';
import { supabase } from '../supabaseClient';
import { X, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  onSuccess: () => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  isOpen,
  onClose,
  jobId,
  onSuccess
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  
  const [isEmpty, setIsEmpty] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Setup signature pad on canvas mount
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    
    // Create signature pad instance
    const signaturePad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(26, 26, 26)', // brand charcoal
      throttle: 8
    });
    
    signaturePadRef.current = signaturePad;

    // Monitor canvas draw state to enable/disable Save button
    signaturePad.addEventListener('afterUpdateStroke', () => {
      setIsEmpty(signaturePad.isEmpty());
    });

    // Resize canvas function to support responsive viewports
    const resizeCanvas = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);
      signaturePad.clear();
      setIsEmpty(true);
    };

    // Trigger initial resize
    resizeCanvas();

    // Listen to resize events
    window.addEventListener('resize', resizeCanvas);

    return () => {
      signaturePad.off();
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClear = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
      setIsEmpty(true);
      setError(null);
    }
  };

  const handleSave = async () => {
    if (!signaturePadRef.current || isEmpty) return;

    setIsSaving(true);
    setError(null);

    try {
      // 1. Get drawing data URL and convert to PNG Blob
      const dataURL = signaturePadRef.current.toDataURL('image/png');
      const response = await fetch(dataURL);
      const blob = await response.blob();

      // 2. Upload file to supabase storage
      const timestamp = Date.now();
      const storagePath = `signatures/${jobId}/${timestamp}.png`;

      const { error: uploadError } = await supabase.storage
        .from('job-media')
        .upload(storagePath, blob, {
          contentType: 'image/png',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 3. Get public URL of the uploaded image
      const { data: urlData } = supabase.storage
        .from('job-media')
        .getPublicUrl(storagePath);
      
      const fileUrl = urlData.publicUrl;

      // 4. Update job record with url and signed_at timestamp
      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          customer_signature_url: fileUrl,
          signed_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (updateError) throw updateError;

      // 5. Success callback
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to save customer signature:', err);
      setError(err.message || 'Failed to upload or link customer signature.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-brand-charcoal/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative bg-white w-full max-w-lg mx-4 rounded-xl shadow-2xl overflow-hidden border border-brand-grey-medium flex flex-col z-10">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-grey-medium bg-brand-charcoal text-white">
          <div>
            <h2 className="text-base font-bold tracking-tight m-0 text-white">
              Customer Sign-off
            </h2>
            <p className="text-[10px] text-brand-grey-dark m-0 mt-0.5">
              Draw signature below to authorize completed work.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-brand-grey-dark hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawing Workspace */}
        <div className="p-6 bg-brand-grey flex flex-col gap-4">
          {error && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
              <X size={14} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Canvas Wrapper */}
          <div className="relative border border-brand-grey-medium bg-white rounded-xl overflow-hidden shadow-inner h-56 flex">
            <canvas 
              ref={canvasRef} 
              className="w-full h-full touch-none cursor-crosshair"
            />
            {isEmpty && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-brand-grey-dark text-xs select-none">
                Sign here with touch or mouse
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-brand-grey-medium bg-brand-grey-light flex items-center justify-between">
          <button
            type="button"
            onClick={handleClear}
            disabled={isSaving || isEmpty}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-brand-grey-medium bg-white hover:bg-brand-grey text-brand-charcoal text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw size={13} />
            <span>Clear Canvas</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 border border-brand-grey-dark/40 hover:bg-brand-grey-medium text-brand-charcoal text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isEmpty}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-green hover:bg-brand-green-hover text-brand-charcoal text-xs font-bold rounded-full shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-charcoal" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Save Signature</span>
                </>
              )}
            </button>
          </div>
        </div>
        
      </div>
    </div>
  );
};
