import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { OFFICE_FOOTER_NAV, OFFICE_NAV, WORKER_NAV, isNavItemActive } from './layout/navigation';
import type { NavGroup, NavItem } from './layout/navigation';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const COLLAPSE_KEY = 'si.sidebarCollapsed';

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
};

const initialsOf = (name?: string) =>
  (name || 'User')
    .split(/\s+/)
    .filter(Boolean)
    .map(p => p[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

const Brand: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <Link to="/" className="flex items-center gap-2.5 select-none min-w-0 no-underline">
    <img src="/logo-mark.png" alt="Space Insulation" className="w-8 h-8 object-contain shrink-0" />
    {!compact && (
      <div className="leading-tight min-w-0">
        <div className="text-[0.9375rem] font-bold text-navy tracking-tight">Space Insulation</div>
        <div className="text-2xs text-muted">Field management</div>
      </div>
    )}
  </Link>
);

interface NavLinkRowProps {
  item: NavItem;
  active: boolean;
  compact?: boolean;
  onNavigate?: () => void;
}

const NavLinkRow: React.FC<NavLinkRowProps> = ({ item, active, compact, onNavigate }) => {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      onClick={onNavigate}
      title={compact ? item.name : undefined}
      aria-current={active ? 'page' : undefined}
      className={`relative flex items-center gap-3 rounded-lg no-underline transition-colors ${
        compact ? 'justify-center h-10 w-10 mx-auto' : 'h-10 px-3'
      } ${active ? 'bg-brand-soft text-navy font-semibold' : 'text-ink-soft font-medium hover:text-navy hover:bg-mist'}`}
    >
      {active && !compact && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-brand" />}
      <Icon size={18} strokeWidth={2} className={`shrink-0 ${active ? 'text-brand-ink' : 'text-muted'}`} />
      {!compact && <span className="text-sm truncate">{item.name}</span>}
    </Link>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { session, role } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, isCollapsed ? '1' : '0');
    } catch {
      /* storage unavailable — collapsing still works for this visit */
    }
  }, [isCollapsed]);

  // Close the phone drawer whenever the route changes.
  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const isWorker = role === 'field_worker';
  const groups: NavGroup[] = isWorker ? WORKER_NAV : OFFICE_NAV;
  const footerItems: NavItem[] = isWorker ? [] : OFFICE_FOOTER_NAV;

  const user = session?.user;
  const fullName: string = user?.user_metadata?.full_name || user?.email || 'Signed in';
  const avatarUrl: string | undefined = user?.user_metadata?.avatar_url;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onClose?.();
    navigate('/login/worker');
  };

  const renderGroups = (compact: boolean, onNavigate?: () => void) => (
    <div className="space-y-5">
      {groups.map((group, i) => (
        <div key={group.label ?? i} className="space-y-0.5">
          {group.label &&
            (compact ? (
              <div className="mx-auto mb-2 h-px w-6 bg-line" />
            ) : (
              <div className="px-3 pb-1.5 text-2xs font-semibold text-muted uppercase tracking-wider select-none">
                {group.label}
              </div>
            ))}
          {group.items.map(item => (
            <NavLinkRow key={item.path} item={item} compact={compact} active={isNavItemActive(item, pathname)} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </div>
  );

  const renderAccount = (compact: boolean, onNavigate?: () => void) => (
    <div className="space-y-0.5">
      {footerItems.map(item => (
        <NavLinkRow key={item.path} item={item} compact={compact} active={isNavItemActive(item, pathname)} onNavigate={onNavigate} />
      ))}
      {user && (
        <div className={`mt-2 flex items-center gap-3 rounded-lg ${compact ? 'flex-col py-2' : 'p-2 bg-canvas border border-line'}`}>
          <div
            className="w-9 h-9 rounded-full bg-brand-soft text-brand-ink flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden"
            title={compact ? fullName : undefined}
          >
            {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : initialsOf(fullName)}
          </div>
          {!compact && (
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-navy truncate">{fullName}</div>
              <div className="text-2xs text-muted truncate">{isWorker ? 'Field technician' : 'Office staff'}</div>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            title="Log out"
            aria-label="Log out"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-muted hover:text-navy hover:bg-mist border-0 bg-transparent shrink-0"
          >
            <LogOut size={16} />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex h-screen sticky top-0 shrink-0 flex-col bg-white border-r border-line z-30 transition-[width] duration-200 ${
          isCollapsed ? 'w-[72px]' : 'w-60'
        }`}
      >
        <div className={`h-16 flex items-center border-b border-line ${isCollapsed ? 'justify-center px-2' : 'px-4'}`}>
          <Brand compact={isCollapsed} />
        </div>

        <nav className={`flex-1 overflow-y-auto no-scrollbar py-4 ${isCollapsed ? 'px-2' : 'px-3'}`}>{renderGroups(isCollapsed)}</nav>

        <div className={`border-t border-line py-3 ${isCollapsed ? 'px-2' : 'px-3'}`}>
          {renderAccount(isCollapsed)}
          <button
            type="button"
            onClick={() => setIsCollapsed(c => !c)}
            className={`mt-2 flex items-center gap-3 h-9 rounded-lg text-muted hover:text-navy hover:bg-mist border-0 bg-transparent text-xs font-medium ${
              isCollapsed ? 'w-10 mx-auto justify-center' : 'w-full px-3'
            }`}
            title={isCollapsed ? 'Expand menu' : 'Collapse menu'}
          >
            {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            {!isCollapsed && 'Collapse menu'}
          </button>
        </div>
      </aside>

      {/* Phone / tablet drawer (opened from the "More" tab) */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-[55] flex">
          <div className="absolute inset-0 bg-navy/50 animate-fade-in" onClick={onClose} />
          <aside className="relative flex flex-col w-72 max-w-[85vw] h-full bg-white shadow-pop animate-slide-in">
            <div className="h-16 px-4 flex items-center justify-between border-b border-line pt-[env(safe-area-inset-top)]">
              <Brand />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="w-10 h-10 flex items-center justify-center rounded-lg text-muted hover:text-navy hover:bg-mist border-0 bg-transparent"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4">{renderGroups(false, onClose)}</nav>
            <div className="border-t border-line px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{renderAccount(false, onClose)}</div>
          </aside>
        </div>
      )}
    </>
  );
};
