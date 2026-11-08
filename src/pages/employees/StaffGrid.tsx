import React, { useState, useEffect, useRef } from 'react';
import { Phone, Clock, FileText, CheckCircle2, AlertTriangle, MoreVertical, Users } from 'lucide-react';
import type { Profile } from './types';

interface StaffGridProps {
  profiles: Profile[];
  loading: boolean;
  onViewProfile: (profile: Profile) => void;
  onEdit: (profile: Profile) => void;
  onDeactivate: (profile: Profile) => void;
  onDelete: (profile: Profile) => void;
  onAddStaff: () => void;
}

export const StaffGrid: React.FC<StaffGridProps> = ({
  profiles,
  loading,
  onViewProfile,
  onEdit,
  onDeactivate,
  onDelete,
  onAddStaff
}) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-line p-10 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-line p-16 text-center">
        <div className="w-16 h-16 bg-mist rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Users className="text-subtle" size={32} />
        </div>
        <h3 className="text-lg font-bold text-navy mb-1">No staff members found</h3>
        <p className="text-sm font-medium text-muted mb-6">Add your first employee to start managing availability, certifications, payroll, and job assignments.</p>
        <button
          onClick={onAddStaff}
          className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 mx-auto"
        >
          Add Staff Member
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" ref={menuRef}>
      {profiles.map((profile) => {
        const initials = profile.full_name.substring(0, 2).toUpperCase();
        const roleStr = profile.role === 'field_worker' ? 'Field Technician' : profile.role === 'office_staff' ? 'Office Staff' : profile.role;
        const isActive = profile.is_active !== false && profile.status !== 'Inactive';
        const wage = profile.profile_wages?.hourly_rate;
        
        let activeCerts = 0;
        let expiringCerts = 0;
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        if (profile.staff_certifications) {
          profile.staff_certifications.forEach(cert => {
            if (cert.expiry_date) {
              const expDate = new Date(cert.expiry_date);
              if (expDate > thirtyDaysFromNow) activeCerts++;
              else if (expDate > today && expDate <= thirtyDaysFromNow) expiringCerts++;
            }
          });
        } else if (profile.certification_expiry) {
          const expDate = new Date(profile.certification_expiry);
          if (expDate > thirtyDaysFromNow) activeCerts++;
          else if (expDate > today && expDate <= thirtyDaysFromNow) expiringCerts++;
        }

        return (
          <div key={profile.id} className="bg-white rounded-2xl shadow-sm border border-line hover:shadow-md transition-shadow flex flex-col h-full relative group">
            
            {/* 3-Dot Menu */}
            <div className="absolute top-4 right-4 z-10">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(openMenuId === profile.id ? null : profile.id);
                }}
                className="p-1.5 text-subtle hover:text-navy hover:bg-mist rounded-lg transition-colors"
              >
                <MoreVertical size={18} />
              </button>
              
              {openMenuId === profile.id && (
                <div className="absolute right-0 mt-1 w-48 bg-white border border-line rounded-xl shadow-xl overflow-hidden py-1">
                  <button onClick={() => { setOpenMenuId(null); onViewProfile(profile); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-navy hover:bg-canvas">View Profile</button>
                  <button onClick={() => { setOpenMenuId(null); onEdit(profile); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-navy hover:bg-canvas">Edit Profile</button>
                  <div className="h-px bg-line my-1"></div>
                  <button onClick={() => { setOpenMenuId(null); onDeactivate(profile); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-[#D97706] hover:bg-[#FEF3C7]">{isActive ? 'Deactivate Staff' : 'Reactivate Staff'}</button>
                  <button onClick={() => { setOpenMenuId(null); onDelete(profile); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-[#DC2626] hover:bg-[#FEF2F2]">Delete Staff</button>
                </div>
              )}
            </div>

            {/* Header section */}
            <div className="p-5 sm:p-6 pb-4 border-b border-line cursor-pointer" onClick={() => onViewProfile(profile)}>
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-navy rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0 shadow-inner">
                  {initials}
                </div>
                <div className="pr-6">
                  <h3 className="text-lg font-bold text-navy leading-tight group-hover:text-brand transition-colors">{profile.full_name}</h3>
                  <div className="text-2xs font-bold text-muted uppercase tracking-wide mt-1 mb-2">{roleStr}</div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider border ${
                      isActive ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]' : 'bg-mist text-muted border-line'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#15803D]' : 'bg-subtle'}`}></span>
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                    {wage && <span className="text-xs font-bold text-navy bg-canvas px-2 py-0.5 rounded border border-line">${wage}/hr</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Details section */}
            <div className="p-5 sm:p-6 pt-4 space-y-4 flex-1">
              <div className="flex items-start gap-3">
                <Phone size={16} className="text-subtle mt-0.5 shrink-0" />
                <div>
                  <div className="text-2xs font-bold text-subtle uppercase tracking-wider mb-0.5">Contact</div>
                  <div className="text-sm font-semibold text-navy">{profile.phone || 'No phone number'}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock size={16} className="text-subtle mt-0.5 shrink-0" />
                <div>
                  <div className="text-2xs font-bold text-subtle uppercase tracking-wider mb-0.5">Availability</div>
                  <div className="text-sm font-semibold text-navy line-clamp-2">
                    {profile.weekly_availability ? 'Structured Schedule' : profile.availability || 'Not specified'}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FileText size={16} className="text-subtle mt-0.5 shrink-0" />
                <div className="w-full">
                  <div className="text-2xs font-bold text-subtle uppercase tracking-wider mb-1">Certification Status</div>
                  
                  {(activeCerts === 0 && expiringCerts === 0) ? (
                    <div className="text-xs font-semibold text-muted">No active certifications</div>
                  ) : (
                    <div className="flex flex-col gap-1.5 mt-1.5">
                      {activeCerts > 0 && (
                        <div className="flex items-center gap-2 text-xs font-bold text-[#15803D]">
                          <CheckCircle2 size={14} /> {activeCerts} Active
                        </div>
                      )}
                      {expiringCerts > 0 && (
                        <div className="flex items-center gap-2 text-xs font-bold text-[#D97706]">
                          <AlertTriangle size={14} /> {expiringCerts} Expiring Soon
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-line bg-canvas rounded-b-2xl flex items-center justify-between">
              <button onClick={() => onViewProfile(profile)} className="text-xs font-bold text-[#3B82F6] hover:underline px-2">View Profile →</button>
              <button onClick={() => onEdit(profile)} className="text-xs font-bold text-muted hover:text-navy px-2 py-1 bg-white border border-line rounded shadow-sm hover:shadow transition-all">Edit</button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
