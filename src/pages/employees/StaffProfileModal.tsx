import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../../supabaseClient';
import { X, Phone, Mail, Calendar, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import type { Profile } from './types';

interface StaffProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  onEdit: (profile: Profile) => void;
  onDeactivate: (profile: Profile) => void;
}

interface Job {
  id: string;
  job_number: number;
  customer_id: string;
  status: string;
  scheduled_date: string | null;
  customers?: {
    full_name: string;
    service_address: string;
  } | null;
}

export const StaffProfileModal: React.FC<StaffProfileModalProps> = ({ isOpen, onClose, profile, onEdit, onDeactivate }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  useEffect(() => {
    if (isOpen && profile) {
      document.body.style.overflow = 'hidden';
      const fetchJobs = async () => {
        setLoadingJobs(true);
        const { data } = await supabase
          .from('jobs')
          .select('*, customers(full_name, service_address)')
          .eq('assigned_worker_id', profile.id)
          .order('scheduled_date', { ascending: false })
          .limit(10);
        
        setJobs(data as any[] || []);
        setLoadingJobs(false);
      };
      fetchJobs();
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen, profile]);

  if (!isOpen || !profile) return null;

  const initials = profile.full_name.substring(0, 2).toUpperCase();
  const roleStr = profile.role === 'field_worker' ? 'Field Technician' : profile.role === 'office_staff' ? 'Office Staff' : profile.role;
  const isActive = profile.is_active !== false && profile.status !== 'Inactive';
  const wage = profile.profile_wages?.hourly_rate || 0;
  
  const jobsAssigned = jobs.length;
  const jobsCompleted = jobs.filter(j => j.status === 'Completed' || j.status === 'Invoiced' || j.status === 'Paid').length;
  const jobsInProgress = jobs.filter(j => j.status === 'In Progress').length;

  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  // Collect all certs (legacy + new)
  const allCerts: { name: string, issue: string | null, expiry: string | null }[] = [];
  if (profile.staff_certifications) {
    profile.staff_certifications.forEach(c => allCerts.push({ name: c.name, issue: c.issue_date, expiry: c.expiry_date }));
  } else if (profile.certification_name) {
    allCerts.push({ name: profile.certification_name, issue: null, expiry: profile.certification_expiry });
  }

  const getDayAvailability = (dayKey: string) => {
    if (!profile.weekly_availability) return null;
    return (profile.weekly_availability as any)[dayKey];
  };
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden" aria-modal="true">
      <div className="absolute inset-0 bg-[#151A2D]/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="fixed inset-y-0 right-0 flex max-w-full z-[60] pointer-events-none">
        <div className="w-screen max-w-2xl h-[100dvh] max-h-screen flex flex-col bg-[#F8FAFC] shadow-2xl sm:animate-fade-in-right relative pointer-events-auto">
        
        {/* Header */}
        <div className="bg-white p-6 md:p-8 border-b border-[#E2E8F0] shrink-0 relative">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 text-[#94A3B8] hover:text-[#151A2D] hover:bg-[#F1F5F9] rounded-xl transition-colors">
            <X size={20} />
          </button>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="w-20 h-20 bg-[#151A2D] rounded-full flex items-center justify-center text-white text-3xl font-black shrink-0 shadow-inner">
              {initials}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-black text-[#151A2D] mb-1">{profile.full_name}</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-[#64748B] uppercase tracking-widest">{roleStr}</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  isActive ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]' : 'bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#15803D]' : 'bg-[#94A3B8]'}`}></span>
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
              <button 
                onClick={() => { onClose(); onEdit(profile); }}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#151A2D] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-sm"
              >
                Edit Profile
              </button>
              <button 
                onClick={() => { onClose(); onDeactivate(profile); }}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-white border border-[#FCA5A5] text-[#DC2626] hover:bg-[#FEF2F2] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-sm"
              >
                {isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-6 md:p-8 space-y-6" style={{ WebkitOverflowScrolling: 'touch' }}>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Info */}
            <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm">
              <h3 className="text-[10px] font-black text-[#151A2D] uppercase tracking-widest border-b border-[#E2E8F0] pb-2 mb-4">Personal Information</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">Phone</div>
                  <div className="text-sm font-semibold text-[#151A2D] flex items-center gap-2"><Phone size={14} className="text-[#94A3B8]" /> {profile.phone || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">Email</div>
                  <div className="text-sm font-semibold text-[#151A2D] flex items-center gap-2"><Mail size={14} className="text-[#94A3B8]" /> {profile.email || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">Start Date</div>
                  <div className="text-sm font-semibold text-[#151A2D] flex items-center gap-2"><Calendar size={14} className="text-[#94A3B8]" /> {profile.start_date ? new Date(profile.start_date).toLocaleDateString() : 'Not provided'}</div>
                </div>
              </div>
            </div>

            {/* Pay Info */}
            <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm">
              <h3 className="text-[10px] font-black text-[#151A2D] uppercase tracking-widest border-b border-[#E2E8F0] pb-2 mb-4">Pay Information</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">Rate</div>
                  <div className="text-2xl font-black text-[#151A2D] flex items-center gap-1">${wage}<span className="text-sm font-bold text-[#64748B]">/hr</span></div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">Payroll Type</div>
                  <div className="text-sm font-semibold text-[#151A2D]">{profile.profile_wages?.payroll_type || 'Hourly'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Availability */}
            <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm">
              <h3 className="text-[10px] font-black text-[#151A2D] uppercase tracking-widest border-b border-[#E2E8F0] pb-2 mb-4">Availability</h3>
              {!profile.weekly_availability ? (
                <p className="text-sm font-semibold text-[#151A2D]">{profile.availability || 'No availability set.'}</p>
              ) : (
                <div className="space-y-2">
                  {days.map(d => {
                    const avail = getDayAvailability(d);
                    return (
                      <div key={d} className="flex justify-between items-center text-sm font-semibold">
                        <span className="text-[#64748B] w-10">{d}</span>
                        {avail?.isAvailable ? (
                          <span className="text-[#151A2D]">{avail.start} – {avail.end}</span>
                        ) : (
                          <span className="text-[#94A3B8] text-xs font-bold uppercase tracking-wider">Unavailable</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Certifications */}
            <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm">
              <h3 className="text-[10px] font-black text-[#151A2D] uppercase tracking-widest border-b border-[#E2E8F0] pb-2 mb-4">Certifications</h3>
              {allCerts.length === 0 ? (
                <p className="text-sm font-semibold text-[#94A3B8]">No certifications found.</p>
              ) : (
                <div className="space-y-4">
                  {allCerts.map((cert, i) => {
                    let status = 'Active';
                    let statusColor = 'text-[#15803D] bg-[#F0FDF4] border-[#BBF7D0]';
                    let Icon = CheckCircle2;
                    
                    if (cert.expiry) {
                      const expDate = new Date(cert.expiry);
                      if (expDate < today) {
                        status = 'Expired';
                        statusColor = 'text-[#DC2626] bg-[#FEF2F2] border-[#FECACA]';
                        Icon = X;
                      } else if (expDate <= thirtyDaysFromNow) {
                        status = 'Expiring Soon';
                        statusColor = 'text-[#D97706] bg-[#FEF3C7] border-[#FDE68A]';
                        Icon = AlertTriangle;
                      }
                    }

                    return (
                      <div key={i} className="flex items-start justify-between border-b border-[#E2E8F0] last:border-0 pb-3 last:pb-0">
                        <div>
                          <div className="text-sm font-bold text-[#151A2D] mb-1">{cert.name}</div>
                          <div className="text-xs font-semibold text-[#64748B]">
                            {cert.issue && `Issued: ${new Date(cert.issue).toLocaleDateString()} • `}
                            {cert.expiry ? `Expires: ${new Date(cert.expiry).toLocaleDateString()}` : 'No expiry'}
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${statusColor}`}>
                          <Icon size={12} /> {status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Job Activity */}
          <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm">
            <h3 className="text-[10px] font-black text-[#151A2D] uppercase tracking-widest border-b border-[#E2E8F0] pb-2 mb-4">Job Activity</h3>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
                <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Assigned</div>
                <div className="text-xl font-black text-[#151A2D]">{jobsAssigned}</div>
              </div>
              <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
                <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">In Progress</div>
                <div className="text-xl font-black text-[#151A2D]">{jobsInProgress}</div>
              </div>
              <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
                <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Completed</div>
                <div className="text-xl font-black text-[#151A2D]">{jobsCompleted}</div>
              </div>
            </div>

            <h4 className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-3">Recent Jobs</h4>
            {loadingJobs ? (
              <div className="flex justify-center p-4"><Loader2 className="animate-spin text-[#7CC242]" /></div>
            ) : jobs.length === 0 ? (
              <p className="text-sm font-semibold text-[#94A3B8]">No jobs assigned yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E8F0]">
                      <th className="py-2 text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">Job ID</th>
                      <th className="py-2 text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">Customer</th>
                      <th className="py-2 text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">Date</th>
                      <th className="py-2 text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {jobs.map(job => (
                      <tr key={job.id}>
                        <td className="py-3 text-xs font-bold text-[#151A2D]">JOB-{job.job_number}</td>
                        <td className="py-3 text-xs font-semibold text-[#475569]">{job.customers?.full_name}</td>
                        <td className="py-3 text-xs font-semibold text-[#475569]">{job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString() : '--'}</td>
                        <td className="py-3">
                          <span className="text-[10px] font-bold text-[#64748B] uppercase bg-[#F1F5F9] px-2 py-0.5 rounded border border-[#E2E8F0]">
                            {job.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  </div>,
    document.body
  );
};
