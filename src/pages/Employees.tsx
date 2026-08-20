import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { EmployeesHeader } from './employees/EmployeesHeader';
import { EmployeesControls } from './employees/EmployeesControls';
import { StaffGrid } from './employees/StaffGrid';
import { StaffProfileModal } from './employees/StaffProfileModal';
import { CreateStaffModal } from './employees/CreateStaffModal';
import { PayrollLogs } from './employees/PayrollLogs';
import type { Profile, TimeEntry, StaffFilterState } from './employees/types';

export const Employees: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [activeTab, setActiveTab] = useState<'roster' | 'payroll'>('roster');
  const [filters, setFilters] = useState<StaffFilterState>({
    searchQuery: '',
    role: '',
    status: '',
    certification: '',
    availability: ''
  });

  // Payroll Dates
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14); // Default to past 14 days
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Modals
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfiles = useCallback(async () => {
    if (!currentUser) return;
    try {
      let { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          profile_wages (hourly_rate, payroll_type),
          staff_certifications (id, name, issue_date, expiry_date)
        `)
        .order('full_name', { ascending: true });

      // If the migration hasn't been run, staff_certifications won't exist and will throw a relationship error
      if (error && error.message.includes('Could not find a relationship')) {
        console.warn('Migration not run. Falling back to legacy query.');
        const fallback = await supabase
          .from('profiles')
          .select(`
            *,
            profile_wages (hourly_rate, payroll_type)
          `)
          .order('full_name', { ascending: true });
        
        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;
      setProfiles(data as any[] || []);
    } catch (err) {
      console.error('Failed to load profiles:', err);
    }
  }, [currentUser]);

  const fetchTimeEntries = useCallback(async () => {
    if (!currentUser) return;
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*, profiles(full_name)')
        .gte('clock_in', `${startDate}T00:00:00Z`)
        .lte('clock_in', `${endDate}T23:59:59Z`)
        .order('clock_in', { ascending: false });

      if (error) throw error;
      setTimeEntries(data as any[] || []);
    } catch (err) {
      console.error('Failed to load time entries:', err);
    }
  }, [currentUser, startDate, endDate]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchProfiles(), fetchTimeEntries()]);
    setLoading(false);
  }, [fetchProfiles, fetchTimeEntries]);

  useEffect(() => {
    if (currentUser) loadAllData();
  }, [currentUser, loadAllData]);

  // Handle Filtering
  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesName = p.full_name?.toLowerCase().includes(query);
        const matchesPhone = p.phone?.toLowerCase().includes(query);
        const matchesEmail = p.email?.toLowerCase().includes(query);
        const matchesRole = p.role?.toLowerCase().includes(query);
        if (!matchesName && !matchesPhone && !matchesEmail && !matchesRole) return false;
      }
      
      if (filters.role) {
        const roleStr = p.role === 'field_worker' ? 'Field Technician' : p.role === 'office_staff' ? 'Office Staff' : p.role;
        if (roleStr !== filters.role) return false;
      }
      
      if (filters.status) {
        const isActive = p.is_active !== false && p.status !== 'Inactive';
        if (filters.status === 'Active' && !isActive) return false;
        if (filters.status === 'Inactive' && isActive) return false;
      }
      
      if (filters.certification) {
        const hasCerts = (p.staff_certifications && p.staff_certifications.length > 0) || p.certification_name;
        if (filters.certification === 'Has Certifications' && !hasCerts) return false;
        if (filters.certification === 'No Certifications' && hasCerts) return false;
        
        if (filters.certification === 'Expiring Soon') {
          let hasExpiring = false;
          const today = new Date();
          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(today.getDate() + 30);
          
          if (p.staff_certifications) {
            p.staff_certifications.forEach(c => {
              if (c.expiry_date) {
                const expDate = new Date(c.expiry_date);
                if (expDate > today && expDate <= thirtyDaysFromNow) hasExpiring = true;
              }
            });
          } else if (p.certification_expiry) {
            const expDate = new Date(p.certification_expiry);
            if (expDate > today && expDate <= thirtyDaysFromNow) hasExpiring = true;
          }
          if (!hasExpiring) return false;
        }
      }
      
      if (filters.availability === 'Available Today') {
        if (p.weekly_availability) {
          const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
          const todayName = days[new Date().getDay()];
          const avail = (p.weekly_availability as any)[todayName];
          if (!avail || !avail.isAvailable) return false;
        } else {
          // Fallback for legacy
          if (!p.availability) return false;
        }
      }

      return true;
    });
  }, [profiles, filters]);

  // Actions
  const handleViewProfile = (profile: Profile) => {
    setSelectedProfile(profile);
    setIsProfileModalOpen(true);
  };

  const handleEditProfile = (profile: Profile) => {
    setSelectedProfile(profile);
    setIsEditModalOpen(true);
  };

  const handleDeactivate = async (profile: Profile) => {
    const isActive = profile.is_active !== false && profile.status !== 'Inactive';
    const action = isActive ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} ${profile.full_name}?`)) return;

    try {
      const { error } = await supabase.from('profiles').update({
        is_active: !isActive,
        status: !isActive ? 'Active' : 'Inactive'
      }).eq('id', profile.id);
      
      if (error) throw error;
      await fetchProfiles();
    } catch (err: any) {
      alert(err.message || `Failed to ${action} staff member.`);
    }
  };

  const handleDelete = async (profile: Profile) => {
    const confirmed = confirm(
      "Delete this staff member permanently?\n\nThis will permanently remove their account, profile, wages, time records, breaks, certifications and other staff data. This action cannot be undone."
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session found.");

      const response = await fetch('/api/delete-staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          staffId: profile.id,
          auth_token: session.access_token
        })
      });

      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to delete staff member.');
      }

      alert("Staff member permanently deleted.");
      await fetchProfiles();
    } catch (err: any) {
      alert(err.message || 'Failed to delete staff member. Check permissions or historical constraints.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-fade-in">
      
      {/* Header section */}
      <div>
        <h1 className="text-3xl font-black text-[#151A2D] uppercase tracking-widest mb-2">Staff Management</h1>
        <p className="text-sm font-semibold text-[#64748B]">Review certifications, manage schedules, and calculate payroll.</p>
      </div>

      <EmployeesHeader profiles={profiles} />

      <EmployeesControls 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        filters={filters}
        onFilterChange={(newFilters) => setFilters(prev => ({ ...prev, ...newFilters }))}
        onAddStaff={() => { setSelectedProfile(null); setIsEditModalOpen(true); }}
        filteredCount={filteredProfiles.length}
      />

      {activeTab === 'roster' ? (
        <StaffGrid 
          profiles={filteredProfiles}
          loading={loading}
          onViewProfile={handleViewProfile}
          onEdit={handleEditProfile}
          onDeactivate={handleDeactivate}
          onDelete={handleDelete}
          onAddStaff={() => { setSelectedProfile(null); setIsEditModalOpen(true); }}
        />
      ) : (
        <PayrollLogs 
          timeEntries={timeEntries}
          profiles={profiles}
          loading={loading}
          startDate={startDate}
          endDate={endDate}
          onDateChange={(start, end) => { setStartDate(start); setEndDate(end); }}
        />
      )}

      {/* Modals */}
      <StaffProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profile={selectedProfile}
        onEdit={handleEditProfile}
        onDeactivate={handleDeactivate}
      />

      <CreateStaffModal 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        profileToEdit={selectedProfile}
        onSuccess={fetchProfiles}
      />
      
    </div>
  );
};
