import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Plus } from 'lucide-react';
import { CREATE_ITEMS } from './navigation';
import { Sheet } from '../ui';
import { AnimatePresence, m } from 'framer-motion';
import { pop } from '../ui/motion';

/** The list of things the user can create, used by both the dropdown and the phone sheet. */
export const CreateMenuList: React.FC<{ onPick: () => void; large?: boolean }> = ({ onPick, large }) => (
  <div className={large ? 'grid grid-cols-1 gap-1' : 'py-1'}>
    {CREATE_ITEMS.map(({ name, description, path, icon: Icon }) => (
      <Link
        key={name}
        to={path}
        onClick={onPick}
        className={`flex items-center gap-3 rounded-lg no-underline text-navy hover:bg-mist transition-colors ${large ? 'px-2 py-3' : 'mx-1 px-3 py-2.5'}`}
      >
        <span className={`rounded-lg bg-brand-soft text-brand-ink flex items-center justify-center shrink-0 ${large ? 'w-11 h-11' : 'w-9 h-9'}`}>
          <Icon size={large ? 20 : 18} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{name}</span>
          <span className="block text-xs text-muted">{description}</span>
        </span>
      </Link>
    ))}
  </div>
);

/** Desktop "+ Create" button with dropdown. */
export const CreateDropdown: React.FC = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="h-10 pl-3 pr-2.5 inline-flex items-center gap-1.5 rounded-lg bg-brand hover:bg-brand-hover text-navy text-sm font-semibold border-0 shadow-card"
      >
        <Plus size={18} strokeWidth={2.5} />
        Create
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <m.div {...pop} style={{ transformOrigin: 'top right' }} className="absolute right-0 mt-2 w-72 bg-white border border-line rounded-xl shadow-pop z-50">
            <div className="px-4 pt-3 pb-1 text-2xs font-semibold text-muted uppercase tracking-wider">Create new</div>
            <CreateMenuList onPick={() => setOpen(false)} />
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/** Phone bottom sheet with the same create options. */
export const CreateSheet: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => (
  <Sheet open={open} onClose={onClose} title="Create new" size="sm">
    <CreateMenuList onPick={onClose} large />
  </Sheet>
);
