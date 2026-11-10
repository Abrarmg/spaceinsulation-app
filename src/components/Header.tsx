import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Search, Settings, User } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { InlineSearch, SearchOverlay } from './layout/GlobalSearch';
import { CreateDropdown } from './layout/CreateMenu';
import { NotificationBell } from './layout/Notifications';
import { AnimatePresence, m } from 'framer-motion';
import { pop } from './ui/motion';

interface HeaderProps {
  /** Kept for compatibility; the phone menu now opens from the bottom tab bar. */
  onMenuClick?: () => void;
}

const initialsOf = (name?: string) =>
  (name || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .map(p => p[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

const ProfileMenu: React.FC = () => {
  const navigate = useNavigate();
  const { session, role } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const user = session?.user;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!user) return null;
  const name: string = user.user_metadata?.full_name || 'Account';
  const avatarUrl: string | undefined = user.user_metadata?.avatar_url;
  const isWorker = role === 'field_worker';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login/worker');
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 h-10 pl-1 pr-1.5 rounded-lg hover:bg-mist border-0 bg-transparent"
      >
        <span className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-xs font-semibold overflow-hidden">
          {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : initialsOf(name)}
        </span>
        <ChevronDown size={14} className="hidden md:block text-muted" />
      </button>

      <AnimatePresence>
      {open && (
        <m.div {...pop} style={{ transformOrigin: 'top right' }} className="absolute right-0 mt-2 w-60 bg-white border border-line rounded-xl shadow-pop p-1.5 z-50">
          <div className="px-3 py-2.5 border-b border-line mb-1">
            <div className="text-sm font-semibold text-navy truncate">{name}</div>
            <div className="text-xs text-muted truncate">{user.email}</div>
          </div>
          <Link
            to={isWorker ? '/profile' : '/settings'}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 h-10 rounded-lg text-sm text-navy no-underline hover:bg-mist"
          >
            {isWorker ? <User size={16} className="text-muted" /> : <Settings size={16} className="text-muted" />}
            {isWorker ? 'My profile' : 'Settings'}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-sm text-red-600 hover:bg-red-50 border-0 bg-transparent text-left"
          >
            <LogOut size={16} />
            Log out
          </button>
        </m.div>
      )}
      </AnimatePresence>
    </div>
  );
};

export const Header: React.FC<HeaderProps> = () => {
  const { role } = useAuth();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const isOffice = role === 'office_staff';

  return (
    <>
      <header className="sticky top-0 z-20 shrink-0 bg-white/95 backdrop-blur border-b border-line pt-[env(safe-area-inset-top)]">
        <div className="h-14 md:h-16 px-4 md:px-6 lg:px-8 flex items-center gap-3">
          {/* Phone: brand */}
          <Link to={isOffice ? '/' : '/worker-dashboard'} className="lg:hidden flex items-center gap-2 no-underline min-w-0">
            <img src="/logo-mark.png" alt="" className="w-7 h-7 object-contain shrink-0" />
            <span className="text-[0.9375rem] font-bold text-navy truncate">Space Insulation</span>
          </Link>

          {/* Tablet & desktop: search */}
          <div className="hidden md:flex flex-1 min-w-0 lg:ml-0 md:ml-4">
            <InlineSearch />
          </div>

          <div className="ml-auto flex items-center gap-1.5 md:gap-3">
            <button
              type="button"
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Search"
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg text-ink-soft hover:bg-mist border-0 bg-transparent"
            >
              <Search size={20} />
            </button>
            {isOffice && <NotificationBell />}
            {isOffice && (
              <div className="hidden lg:block">
                <CreateDropdown />
              </div>
            )}
            <ProfileMenu />
          </div>
        </div>
      </header>

      <AnimatePresence>{mobileSearchOpen && <SearchOverlay key="search" onClose={() => setMobileSearchOpen(false)} />}</AnimatePresence>
    </>
  );
};
