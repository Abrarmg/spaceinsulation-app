import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AnimatePresence, m } from 'framer-motion';
import { Plus } from 'lucide-react';
import { CREATE_ITEMS } from './navigation';
import { EASE } from '../ui/motion';

/**
 * Phone quick-create: tapping + in the tab bar dims the screen and fans out a
 * column of round, colour-coded buttons (Contact, Lead, Estimate, Job,
 * Invoice, Expense). The + turns into × to close.
 */
export const QuickCreateDial: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Bottom of the list sits just above the tab bar's + button.
  const items = [...CREATE_ITEMS].reverse();

  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div
          key="dial"
          data-motion="off"
          className="lg:hidden fixed inset-0 z-[60]"
          role="dialog"
          aria-modal="true"
          aria-label="Create new"
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1, transition: { duration: 0.25 } }}
        >
          <m.div
            data-motion="off"
            className="absolute inset-0 bg-navy/75 backdrop-blur-[2px]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE }}
          />

          <ul
            className="absolute inset-x-0 m-0 p-0 list-none flex flex-col-reverse items-center gap-3.5"
            style={{ bottom: 'calc(env(safe-area-inset-bottom) + 84px)' }}
          >
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <m.li
                  key={item.name}
                  className="relative"
                  initial={{ opacity: 0, y: 18, scale: 0.6 }}
                  animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', damping: 22, stiffness: 420, delay: i * 0.035 } }}
                  exit={{ opacity: 0, y: 12, scale: 0.7, transition: { duration: 0.12, delay: (items.length - 1 - i) * 0.02 } }}
                >
                  <Link to={item.path} onClick={onClose} className="group flex items-center no-underline" aria-label={`New ${item.name.toLowerCase()}`}>
                    {/* Label sits to the left of the round button, so the buttons line up with + */}
                    <span
                      className={`absolute right-[calc(100%+12px)] top-1/2 -translate-y-1/2 whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-semibold shadow-card ${item.soft}`}
                    >
                      {item.name}
                    </span>
                    <span
                      className={`w-[52px] h-[52px] rounded-full flex items-center justify-center text-white shadow-pop ring-4 ring-white/15 group-active:scale-95 transition-transform ${item.color} ${
                        item.color === 'bg-brand' ? '!text-navy' : ''
                      }`}
                    >
                      <Icon size={22} />
                    </span>
                  </Link>
                </m.li>
              );
            })}
          </ul>

          {/* Close: sits exactly over the tab bar's + button */}
          <div className="absolute inset-x-0 flex justify-center" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}>
            <m.button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-12 h-12 rounded-full bg-brand text-navy flex items-center justify-center shadow-pop border-0"
              initial={{ rotate: 0 }}
              animate={{ rotate: 45 }}
              exit={{ rotate: 0 }}
              transition={{ type: 'spring', damping: 18, stiffness: 300 }}
            >
              <Plus size={24} strokeWidth={2.5} />
            </m.button>
          </div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
