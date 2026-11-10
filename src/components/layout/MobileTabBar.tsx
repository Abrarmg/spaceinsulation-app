import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { OFFICE_TABS, WORKER_NAV, isNavItemActive, shouldShowTabBar } from './navigation';
import type { NavItem } from './navigation';
import { QuickCreateDial } from './QuickCreateDial';


const Tab: React.FC<{ item: NavItem; active: boolean }> = ({ item, active }) => {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      aria-current={active ? 'page' : undefined}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full no-underline ${active ? 'text-navy' : 'text-muted'}`}
    >
      <span className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors ${active ? 'bg-brand-soft text-brand-ink' : ''}`}>
        <Icon size={20} strokeWidth={active ? 2.4 : 2} />
      </span>
      <span className={`text-2xs ${active ? 'font-semibold' : 'font-medium'}`}>{item.short ?? item.name}</span>
    </Link>
  );
};

export const MobileTabBar: React.FC<{ onOpenMenu: () => void }> = ({ onOpenMenu }) => {
  const { pathname } = useLocation();
  const { role } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);

  if (!role || !shouldShowTabBar(pathname)) return null;
  const isWorker = role === 'field_worker';

  return (
    <>
      <nav
        aria-label="Main"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-line shadow-[0_-2px_10px_rgba(21,26,45,0.05)] pb-safe"
      >
        <div className="h-16 flex items-stretch max-w-xl mx-auto px-1">
          {isWorker ? (
            WORKER_NAV[0].items.map(item => <Tab key={item.path} item={item} active={isNavItemActive(item, pathname)} />)
          ) : (
            <>
              <Tab item={OFFICE_TABS[0]} active={isNavItemActive(OFFICE_TABS[0], pathname)} />
              <Tab item={OFFICE_TABS[1]} active={isNavItemActive(OFFICE_TABS[1], pathname)} />
              <div className="flex-1 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  aria-label="Create new"
                  className="w-12 h-12 -mt-1 rounded-full bg-brand hover:bg-brand-hover text-navy flex items-center justify-center shadow-pop border-0"
                >
                  <Plus size={24} strokeWidth={2.5} />
                </button>
              </div>
              <Tab item={OFFICE_TABS[2]} active={isNavItemActive(OFFICE_TABS[2], pathname)} />
              <button
                type="button"
                onClick={onOpenMenu}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 text-muted border-0 bg-transparent"
              >
                <span className="flex items-center justify-center w-12 h-7">
                  <Menu size={20} />
                </span>
                <span className="text-2xs font-medium">More</span>
              </button>
            </>
          )}
        </div>
      </nav>
      {!isWorker && <QuickCreateDial open={createOpen} onClose={() => setCreateOpen(false)} />}
    </>
  );
};
