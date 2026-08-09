import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Search, Plus, Bell, ChevronDown, Menu, LogOut } from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const [isCreateDropdownOpen, setIsCreateDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setUserRole(null);
      return;
    }
    const fetchRole = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (data) setUserRole(data.role);
    };
    fetchRole();
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login/worker');
  };

  return (
    <header className="h-14 md:h-16 border-b border-[#E6E8EC] bg-white px-4 md:px-8 flex items-center justify-between shrink-0 relative z-20 font-sans">
      {/* Left: Mobile Menu Trigger & Logo / Search */}
      <div className="flex items-center gap-2 md:gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl hover:bg-[#F7F8FA] text-[#171A1F] focus:outline-none cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center border-none bg-transparent"
          aria-label="Open sidebar menu"
        >
          <Menu size={20} />
        </button>

        {/* Mobile Brand Header */}
        <div className="flex lg:hidden items-center select-none shrink-0">
          <span className="text-[11px] sm:text-xs font-black tracking-wider text-[#151A2D] uppercase">Space Insulation</span>
        </div>

        {/* Desktop Search Field */}
        <div className="relative hidden md:flex items-center group">
          <Search size={15} className="absolute left-3 text-[#737A86]/60 transition-colors duration-300 group-focus-within:text-[#76C442]" />
          <input 
            type="text" 
            placeholder="Search jobs, customers, invoices..." 
            className="text-xs bg-[#F7F8FA] border border-[#E6E8EC] rounded-xl pl-9 pr-12 py-2 w-64 focus:outline-none focus:bg-white focus:border-[#76C442] focus:ring-4 focus:ring-[#76C442]/10 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus:w-72 hover:border-[#CBD5E1] text-[#171A1F] placeholder-[#737A86]/50 font-medium shadow-sm focus:shadow-md"
          />
          <span className="absolute right-2 px-1.5 py-0.5 bg-white border border-[#E6E8EC] text-[9px] font-black text-[#737A86] rounded-md shadow-xs select-none transition-opacity duration-300 group-focus-within:opacity-50">⌘K</span>
        </div>
      </div>

      {/* Right: Actions, Notifications, Profiles */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Mobile Search Icon Toggle */}
        <button 
          className="md:hidden p-2 rounded-xl hover:bg-[#F7F8FA] text-[#737A86] hover:text-[#171A1F] cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center border-none bg-transparent shrink-0"
          onClick={() => navigate('/jobs')}
          aria-label="Search jobs"
        >
          <Search size={18} />
        </button>

        {/* Create New Dropdown */}
        {userRole === 'office_staff' && (
          <div className="relative">
            <button
              onClick={() => {
                setIsCreateDropdownOpen(!isCreateDropdownOpen);
                setIsProfileDropdownOpen(false);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#76C442] hover:bg-[#689F38] text-[#151A2D] text-xs font-black rounded-xl transition-all shadow-sm hover:shadow cursor-pointer border-none min-h-[36px]"
            >
              <Plus size={14} className="stroke-[2.5]" />
              <span className="hidden sm:inline">Create New</span>
              <ChevronDown size={11} className={`transition-transform duration-200 ${isCreateDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isCreateDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={() => setIsCreateDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-44 bg-white border border-[#E7E9ED] rounded-xl shadow-xl py-1.5 z-40 animate-slide-in">
                  <Link
                    to="/customers"
                    onClick={() => setIsCreateDropdownOpen(false)}
                    className="flex items-center px-4 py-2.5 text-xs font-bold text-[#171A1F] hover:bg-[#F7F8FA] hover:text-[#76C442] transition-colors"
                  >
                    Customer
                  </Link>
                  <Link
                    to="/estimates/new"
                    onClick={() => setIsCreateDropdownOpen(false)}
                    className="flex items-center px-4 py-2.5 text-xs font-bold text-[#171A1F] hover:bg-[#F7F8FA] hover:text-[#76C442] transition-colors"
                  >
                    Estimate
                  </Link>
                  <Link
                    to="/scheduling"
                    onClick={() => setIsCreateDropdownOpen(false)}
                    className="flex items-center px-4 py-2.5 text-xs font-bold text-[#171A1F] hover:bg-[#F7F8FA] hover:text-[#76C442] transition-colors"
                  >
                    Job
                  </Link>
                  <Link
                    to="/invoices/new"
                    onClick={() => setIsCreateDropdownOpen(false)}
                    className="flex items-center px-4 py-2.5 text-xs font-bold text-[#171A1F] hover:bg-[#F7F8FA] hover:text-[#76C442] transition-colors"
                  >
                    Invoice
                  </Link>
                  <Link
                    to="/expenses"
                    onClick={() => setIsCreateDropdownOpen(false)}
                    className="flex items-center px-4 py-2.5 text-xs font-bold text-[#171A1F] hover:bg-[#F7F8FA] hover:text-[#76C442] transition-colors"
                  >
                    Expense
                  </Link>
                </div>
              </>
            )}
          </div>
        )}

        {/* Notification Icon */}
        <button className="p-2 rounded-xl hover:bg-[#F7F8FA] text-[#737A86] hover:text-[#171A1F] cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center relative border-none bg-transparent">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>

        {/* Profile Dropdown */}
        {user && (
          <div className="relative">
            <button
              onClick={() => {
                setIsProfileDropdownOpen(!isProfileDropdownOpen);
                setIsCreateDropdownOpen(false);
              }}
              className="flex items-center gap-1.5 p-0.5 hover:bg-[#F7F8FA] rounded-xl cursor-pointer border-none bg-transparent focus:outline-none"
            >
              <div className="w-8 h-8 rounded-full bg-[#151A2D] text-white flex items-center justify-center text-xs font-bold select-none">
                {user.user_metadata?.full_name?.substring(0, 1).toUpperCase() || 'A'}
              </div>
            </button>

            {isProfileDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={() => setIsProfileDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-52 bg-white border border-[#E7E9ED] rounded-xl shadow-xl p-2 z-40 space-y-1">
                  <div className="px-3 py-2 border-b border-[#E6E8EC] text-left">
                    <div className="text-xs font-bold text-[#171A1F] truncate">
                      {user.user_metadata?.full_name || 'Admin'}
                    </div>
                    <div className="text-[9px] text-[#737A86] truncate mt-0.5">
                      {user.email}
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer border-none text-left bg-transparent mt-1"
                  >
                    <LogOut size={14} />
                    <span>Log Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
