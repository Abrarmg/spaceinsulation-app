import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { fade, rise, sheet } from '../components/ui/motion';

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

  const confirmDialog = (
    <AnimatePresence>
      {opts && (
    <m.div
      key="confirm"
      data-motion="off"
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 font-sans"
      role="dialog"
      aria-modal="true"
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 1, transition: { duration: 0.22 } }}
    >
      <m.div data-motion="off" className="absolute inset-0 bg-navy/60" onClick={() => close(false)} {...fade} />
      <m.div data-motion="off" {...sheet(false)} className="relative w-full sm:max-w-sm bg-white rounded-2xl shadow-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-navy m-0">{opts.title}</h2>
          {opts.message && <p className="text-xs text-muted font-medium mt-1.5 mb-0 leading-relaxed">{opts.message}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => close(false)}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-navy bg-white border border-line hover:bg-canvas cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => close(true)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer ${
              opts.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-navy hover:bg-navy-soft'
            }`}
          >
            {opts.confirmLabel || 'Confirm'}
          </button>
        </div>
      </m.div>
    </m.div>
      )}
    </AnimatePresence>
  );

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

  const toastElement = (
    <AnimatePresence>
      {toast && (
    <m.div
      key={toast.text}
      {...rise}
      role="status"
      className={`fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-[70] max-w-[90vw] flex items-center gap-2 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-lg ${
        toast.kind === 'error' ? 'bg-red-600' : 'bg-navy'
      }`}
    >
      {toast.kind === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} className="text-brand" />}
      {toast.text}
    </m.div>
      )}
    </AnimatePresence>
  );

  return { showToast, toastElement };
}
