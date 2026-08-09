import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  ClipboardList, 
  HardHat, 
  ChevronLeft, 
  ChevronRight,
  Lock,
  LogOut,
  ShieldAlert,
  FileText,
  FileSpreadsheet,
  Receipt,
  User
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sessionUser, setSessionUser] = useState<any | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Monitor auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionUser(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch the role of the logged in user
  useEffect(() => {
    if (!sessionUser) {
      setUserRole(null);
      return;
    }

    const fetchUserRole = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', sessionUser.id)
          .maybeSingle();
        
        if (!error && data) {
          setUserRole(data.role);
        }
      } catch (err) {
        console.error('Failed to load active role:', err);
      }
    };

    fetchUserRole();
  }, [sessionUser]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (onClose) onClose();
    navigate('/login/worker');
  };

  // Grouped Navigation Items
  const sidebarGroups = userRole === 'field_worker'
    ? [
        {
          groupName: 'MAIN',
          items: [
            { name: 'Dashboard', path: '/worker-dashboard', icon: LayoutDashboard },
            { name: 'My Jobs', path: '/jobs', icon: ClipboardList },
            { name: 'Estimates', path: '/estimates', icon: FileText },
            { name: 'My Profile', path: '/profile', icon: User }
          ]
        }
      ]
    : [
        {
          groupName: 'MAIN',
          items: [
            { name: 'Dashboard', path: '/', icon: LayoutDashboard },
            { name: 'Customers', path: '/customers', icon: Users },
            { name: 'Scheduling', path: '/scheduling', icon: Calendar },
            { name: 'Estimates', path: '/estimates', icon: FileText }
          ]
        },
        {
          groupName: 'FINANCE',
          items: [
            { name: 'Invoices', path: '/invoices', icon: FileSpreadsheet },
            { name: 'Expenses', path: '/expenses', icon: Receipt }
          ]
        },
        {
          groupName: 'OPERATIONS',
          items: [
            { name: 'Jobs', path: '/jobs', icon: ClipboardList },
            { name: 'Employees', path: '/employees', icon: HardHat }
          ]
        }
      ];

  const renderNavLinks = (onClickAction?: () => void) => {
    return sidebarGroups.map((group) => (
      <div key={group.groupName} className="space-y-1">
        {/* Group Name Header */}
        {!isCollapsed && (
          <div className="text-[9px] font-extrabold text-white/30 tracking-widest px-3 uppercase mt-2.5 mb-1 select-none">
            {group.groupName}
          </div>
        )}
        <div className="space-y-0.5">
          {group.items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={onClickAction}
                className={({ isActive }) => {
                  let isItemActive = isActive;
                  if (item.name === 'Time') {
                     isItemActive = location.pathname === '/worker-dashboard' && location.hash === '#time';
                  } else if (item.name === 'Dashboard' && item.path === '/worker-dashboard') {
                     isItemActive = location.pathname === '/worker-dashboard' && location.hash !== '#time';
                  }

                  return `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 group min-h-[42px] relative overflow-hidden ${
                    isItemActive
                      ? 'bg-[#76C442] text-[#151A2D] shadow-[0_0_15px_rgba(118,196,66,0.25)] font-black'
                      : 'text-[#A7AFBD] hover:text-white hover:bg-white/5'
                  }`;
                }}
              >
                {({ isActive }) => {
                  let isItemActive = isActive;
                  if (item.name === 'Time') {
                     isItemActive = location.pathname === '/worker-dashboard' && location.hash === '#time';
                  } else if (item.name === 'Dashboard' && item.path === '/worker-dashboard') {
                     isItemActive = location.pathname === '/worker-dashboard' && location.hash !== '#time';
                  }
                  return (
                    <>
                      <div className="relative z-10 flex items-center gap-3 w-full">
                        <Icon 
                          size={16} 
                          className={`shrink-0 transition-all duration-300 ease-out group-hover:scale-110 ${isItemActive ? 'drop-shadow-sm' : ''}`} 
                        />
                        {(!isCollapsed || !onClickAction) && <span className="truncate transition-all duration-300">{item.name}</span>}
                      </div>
                      {isItemActive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-50 pointer-events-none animate-[fadeIn_300ms_ease-out] mix-blend-overlay"></div>
                      )}
                    </>
                  );
                }}
              </NavLink>
            );
          })}
        </div>
      </div>
    ));
  };

  const renderAuthWidget = (collapsedMode: boolean) => {
    if (!collapsedMode) {
      return (
        <div className="space-y-2">
          {sessionUser ? (
            <div className="flex items-center justify-between gap-2.5 p-2.5 bg-[#171D2E] rounded-xl border border-white/[0.05] min-w-0 shadow-lg">
              <div className="flex items-center gap-3 min-w-0 relative">
                <div className="w-9 h-9 rounded-full bg-[#76C442]/10 border border-[#76C442]/20 flex items-center justify-center text-[#76C442] text-xs font-black shrink-0 select-none shadow-inner relative overflow-visible">
                  {sessionUser.user_metadata?.avatar_url ? (
                    <img src={sessionUser.user_metadata.avatar_url} alt="Profile" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <>{sessionUser.user_metadata?.full_name?.substring(0, 2).toUpperCase() || 'AD'}</>
                  )}
                  {/* Active dot */}
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#22C55E] border-2 border-[#171D2E] z-10"></div>
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs font-bold text-white truncate leading-none tracking-wide">
                    {sessionUser.user_metadata?.full_name || 'Khder'}
                  </div>
                  <div className="text-[10px] text-[#A7AFBD] truncate leading-none mt-1 font-medium">
                    {userRole === 'field_worker' ? 'Field Technician' : 'Office Staff'}
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="text-[#A7AFBD]/70 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-all cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center shrink-0"
                title="Log Out"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-500">
              <ShieldAlert size={12} className="shrink-0" />
              <span className="text-[10px] font-bold">Unauthenticated</span>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center gap-2">
        {sessionUser ? (
          <div 
            className="w-10 h-10 rounded-xl bg-[#76C442]/20 border border-[#76C442]/40 flex items-center justify-center text-[#76C442] text-xs font-bold uppercase cursor-pointer overflow-hidden relative"
            title={`${sessionUser.email} (${userRole || 'Loading...'})`}
            onClick={handleLogout}
          >
            {sessionUser.user_metadata?.avatar_url ? (
              <img src={sessionUser.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <>{userRole === 'office_staff' ? 'AD' : 'WK'}</>
            )}
          </div>
        ) : (
          <span title="Unauthenticated">
            <Lock size={16} className="text-[#A7AFBD]" />
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside 
        className={`h-screen sticky top-0 bg-[#151A2D] text-white transition-all duration-300 flex flex-col justify-between z-30 border-r border-white/5 shadow-xl hidden lg:flex ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="p-4 flex items-center justify-between border-b border-white/5">
            {!isCollapsed ? (
              <div className="flex items-center gap-2.5 select-none">
                <img src="/logo_leads.png" alt="Logo" className="w-16 h-16 object-contain filter drop-shadow-[0_0_12px_rgba(118,196,66,0.4)]" />
                <div className="leading-none">
                  <h1 className="text-sm font-black tracking-widest text-white m-0 uppercase leading-none">SPACE</h1>
                  <span className="text-[10px] text-[#76C442] uppercase tracking-wider font-extrabold mt-1 inline-block">INSULATION</span>
                </div>
              </div>
            ) : (
              <div className="mx-auto">
                <img src="/logo_leads.png" alt="Logo" className="w-12 h-12 object-contain filter drop-shadow-[0_0_10px_rgba(118,196,66,0.35)]" />
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="mt-3 px-3 space-y-1.5">
            {renderNavLinks()}
          </nav>
        </div>

        <div>
          {/* Auth Control Widget */}
          <div className="border-t border-white/5 p-3 bg-white/[0.02] shrink-0">
            {renderAuthWidget(isCollapsed)}
          </div>

          {/* Collapse Toggle Button */}
          <div className="p-3 border-t border-white/5 flex items-center justify-center bg-white/[0.01]">
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="w-full py-2.5 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl text-[#A7AFBD] hover:text-white transition-all duration-300 ease-out cursor-pointer min-h-[40px] border-none group"
                title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              >
                {isCollapsed ? (
                  <ChevronRight size={16} className="transition-transform duration-300 group-hover:scale-110" />
                ) : (
                  <div className="flex items-center gap-2">
                    <ChevronLeft size={16} className="transition-transform duration-300 group-hover:-translate-x-1" />
                    <span className="text-[10px] font-black uppercase tracking-wider">Collapse Menu</span>
                  </div>
                )}
              </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 cursor-pointer"
            onClick={onClose}
          />
          
          {/* Drawer content */}
          <aside className="relative flex flex-col w-64 max-w-[80vw] h-full bg-[#151A2D] text-white border-r border-white/5 shadow-2xl z-50 animate-slide-in">
            {/* Close Button & Brand Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img src="/logo_leads.png" alt="Logo" className="w-14 h-14 object-contain filter drop-shadow-[0_0_10px_rgba(118,196,66,0.35)]" />
                <div className="leading-none">
                  <h1 className="text-sm font-black tracking-widest text-white m-0 uppercase leading-none">SPACE</h1>
                  <span className="text-[10px] text-[#76C442] uppercase tracking-wider font-extrabold mt-1 inline-block">INSULATION</span>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 text-[#A7AFBD] hover:text-white rounded-lg focus:outline-none cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center border-none bg-transparent"
                aria-label="Close menu"
              >
                <ChevronLeft size={20} />
              </button>
            </div>

            {/* Mobile Nav Links */}
            <nav className="flex-grow mt-4 px-3 space-y-3 overflow-y-auto">
              {renderNavLinks(onClose)}
            </nav>

            {/* Mobile Auth info */}
            <div className="border-t border-white/5 p-4 bg-white/[0.02] shrink-0">
              {renderAuthWidget(false)}
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
