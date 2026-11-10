import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';
import { AnimatePresence, m } from 'framer-motion';
import { pop } from './motion';

/**
 * A small "?" next to a label that explains a field in plain English.
 * Tap to open on phones; hover or focus on desktop. Rendered in a portal so
 * it is never clipped by cards, tables or pop-up forms.
 */
export const HelpTip: React.FC<{ children: React.ReactNode; label?: string }> = ({ children, label = 'What is this?' }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | undefined>(undefined);

  const WIDTH = 260;

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const place = () => {
      const r = btnRef.current!.getBoundingClientRect();
      const tipH = tipRef.current?.offsetHeight ?? 80;
      const below = r.bottom + 8 + tipH < window.innerHeight;
      setPos({
        top: below ? r.bottom + 8 : Math.max(8, r.top - 8 - tipH),
        left: Math.min(Math.max(8, r.left + r.width / 2 - WIDTH / 2), window.innerWidth - WIDTH - 8),
      });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !tipRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const hoverable = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(o => !o);
        }}
        onMouseEnter={() => {
          if (!hoverable()) return;
          window.clearTimeout(hoverTimer.current);
          setOpen(true);
        }}
        onMouseLeave={() => {
          if (!hoverable()) return;
          hoverTimer.current = window.setTimeout(() => setOpen(false), 120);
        }}
        className="inline-flex items-center justify-center w-5 h-5 -my-1 rounded-full text-subtle hover:text-brand-ink focus-visible:text-brand-ink border-0 bg-transparent p-0 align-middle cursor-help"
      >
        <HelpCircle size={14} />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
          <m.div
            {...pop}
            ref={tipRef}
            role="tooltip"
            onMouseEnter={() => window.clearTimeout(hoverTimer.current)}
            onMouseLeave={() => hoverable() && setOpen(false)}
            style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: WIDTH }}
            className="z-[90] rounded-lg bg-navy text-white text-xs leading-relaxed font-normal normal-case tracking-normal p-3 shadow-pop"
          >
            {children}
          </m.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
};
