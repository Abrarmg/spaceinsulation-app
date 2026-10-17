import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

/** In-app replacement for window.confirm: `if (await confirm({...}))`. Render `confirmDialog` once in the page. */
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | undefined>(undefined);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>(resolve => {
      resolver.current = resolve;
    });
  }, []);

  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = undefined;
    setOpts(null);
  };

  useEffect(() => {
    if (!opts) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opts]);

  const confirmDialog = opts ? (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 font-sans" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#151A2D]/60" onClick={() => close(false)} />
      <div className="relative w-full sm:max-w-sm bg-white rounded-2xl shadow-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-black text-[#151A2D] m-0">{opts.title}</h2>
          {opts.message && <p className="text-xs text-[#64748B] font-medium mt-1.5 mb-0 leading-relaxed">{opts.message}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => close(false)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#151A2D] bg-white border border-[#E2E8F0] hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => close(true)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer ${
              opts.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#151A2D] hover:bg-[#252B45]'
            }`}
          >
            {opts.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, confirmDialog };
}

type ToastKind = 'success' | 'error';

/** Lightweight in-app replacement for window.alert. Render `toastElement` once in the page. */
export function useToast() {
  const [toast, setToast] = useState<{ text: string; kind: ToastKind } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.kind === 'error' ? 6000 : 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const showToast = useCallback((text: string, kind: ToastKind = 'success') => setToast({ text, kind }), []);

  const toastElement = toast ? (
    <div
      role="status"
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] max-w-[90vw] flex items-center gap-2 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-lg ${
        toast.kind === 'error' ? 'bg-red-600' : 'bg-[#151A2D]'
      }`}
    >
      {toast.kind === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} className="text-[#76C442]" />}
      {toast.text}
    </div>
  ) : null;

  return { showToast, toastElement };
}
