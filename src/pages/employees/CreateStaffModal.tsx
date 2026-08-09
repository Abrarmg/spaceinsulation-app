import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { X, Loader2, Plus, Trash2 } from 'lucide-react';
import type { Profile, Certification, WeeklyAvailability, DayAvailability } from './types';

interface CreateStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileToEdit: Profile | null;
  onSuccess: () => void;
}

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const defaultAvailability: WeeklyAvailability = {
  MON: { isAvailable: true, start: '07:00', end: '16:00' },
  TUE: { isAvailable: true, start: '07:00', end: '16:00' },
  WED: { isAvailable: true, start: '07:00', end: '16:00' },
  THU: { isAvailable: true, start: '07:00', end: '16:00' },
  FRI: { isAvailable: true, start: '07:00', end: '16:00' },
  SAT: { isAvailable: false, start: '07:00', end: '16:00' },
  SUN: { isAvailable: false, start: '07:00', end: '16:00' },
};

export const CreateStaffModal: React.FC<CreateStaffModalProps> = ({ isOpen, onClose, profileToEdit, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Basic Info
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('Field Technician');
  const [isActive, setIsActive] = useState(true);

  // Employment & Pay
  const [wage, setWage] = useState('');
  const [payrollType, setPayrollType] = useState('Hourly');
  const [startDate, setStartDate] = useState('');

  // Availability
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailability>(defaultAvailability);

  // Certifications
  const [certifications, setCertifications] = useState<Omit<Certification, 'id'>[]>([]);

  // Notes
  const [internalNotes, setInternalNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (profileToEdit) {
        setFullName(profileToEdit.full_name);
        setEmail(profileToEdit.email || '');
        setPhone(profileToEdit.phone || '');
        setRole(profileToEdit.role === 'field_worker' ? 'Field Technician' : profileToEdit.role === 'office_staff' ? 'Office Staff' : profileToEdit.role);
        setIsActive(profileToEdit.is_active !== false && profileToEdit.status !== 'Inactive');
        
        setWage(profileToEdit.profile_wages?.hourly_rate ? profileToEdit.profile_wages.hourly_rate.toString() : '');
        setPayrollType(profileToEdit.profile_wages?.payroll_type || 'Hourly');
        setStartDate(profileToEdit.start_date || '');

        if (profileToEdit.weekly_availability) {
          setWeeklyAvailability(profileToEdit.weekly_availability);
        } else {
          setWeeklyAvailability(defaultAvailability);
        }

        setInternalNotes(profileToEdit.internal_notes || '');

        if (profileToEdit.staff_certifications && profileToEdit.staff_certifications.length > 0) {
          setCertifications(profileToEdit.staff_certifications.map(c => ({ name: c.name, issue_date: c.issue_date, expiry_date: c.expiry_date })));
        } else if (profileToEdit.certification_name) {
          setCertifications([{ name: profileToEdit.certification_name, issue_date: null, expiry_date: profileToEdit.certification_expiry }]);
        } else {
          setCertifications([]);
        }

        setErrors({});
      } else {
        // Reset form
        setFullName('');
        setEmail('');
        setPhone('');
        setRole('Field Technician');
        setIsActive(true);
        setWage('');
        setPayrollType('Hourly');
        setStartDate('');
        setWeeklyAvailability(defaultAvailability);
        setCertifications([]);
        setInternalNotes('');
        setErrors({});
      }
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen, profileToEdit]);

  if (!isOpen) return null;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = 'Full Name is required.';
    if (!role) newErrors.role = 'Role is required.';
    if (wage && isNaN(Number(wage))) newErrors.wage = 'Wage must be a number.';
    if (wage && Number(wage) <= 0) newErrors.wage = 'Wage must be greater than $0.';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Invalid email format.';
    
    certifications.forEach((cert, idx) => {
      if (!cert.name.trim()) newErrors[`cert_${idx}`] = 'Certification name is required.';
      if (cert.issue_date && cert.expiry_date && new Date(cert.expiry_date) < new Date(cert.issue_date)) {
        newErrors[`cert_date_${idx}`] = 'Expiry date cannot be before issue date.';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setLoading(true);

    try {
      // For a new staff member, we would ideally create an auth user first.
      // But assuming we are just creating a profile record if they are an employee without login, or updating an existing one.
      // For Space Insulation, profiles are tied to auth.users. If it's a completely new user, we'd need an Edge Function to create the auth user.
      // Let's assume we update the profile if it exists, or insert it. (RLS might prevent insert without auth, so we handle best effort).
      
      const profileData = {
        full_name: fullName,
        role: role === 'Field Technician' ? 'field_worker' : role === 'Office Staff' ? 'office_staff' : role,
        phone: phone || null,
        email: email || null,
        is_active: isActive,
        status: isActive ? 'Active' : 'Inactive', // fallback
        start_date: startDate || null,
        internal_notes: internalNotes || null,
        weekly_availability: weeklyAvailability
      };

      let profileId = profileToEdit?.id;

      if (profileId) {
        // Update existing profile
        const { error: profileError } = await supabase.from('profiles').update(profileData).eq('id', profileId);
        if (profileError) throw profileError;

        // Update Wages
        if (wage) {
          const { data: existingWages } = await supabase.from('profile_wages').select('id').eq('profile_id', profileId).maybeSingle();
          if (existingWages) {
            await supabase.from('profile_wages').update({ hourly_rate: Number(wage), payroll_type: payrollType }).eq('id', existingWages.id);
          } else {
            await supabase.from('profile_wages').insert([{ profile_id: profileId, hourly_rate: Number(wage), payroll_type: payrollType }]);
          }
        }

        // Update Certifications
        await supabase.from('staff_certifications').delete().eq('profile_id', profileId);
        if (certifications.length > 0) {
          const certsToInsert = certifications.map(c => ({
            profile_id: profileId,
            name: c.name,
            issue_date: c.issue_date || null,
            expiry_date: c.expiry_date || null
          }));
          await supabase.from('staff_certifications').insert(certsToInsert);
        }
        
      } else {
        // Warning: Direct insert into profiles might fail due to RLS if it requires auth.uid() == id.
        // Assuming there is an edge function or admin capability here.
        alert("To create a completely new staff member, they must first register an account, or an admin Edge Function must be used to create their Auth credentials.");
        setLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to save staff member');
    } finally {
      setLoading(false);
    }
  };

  const updateAvailability = (day: string, field: keyof DayAvailability, value: any) => {
    setWeeklyAvailability(prev => ({
      ...prev,
      [day]: {
        ...(prev as any)[day],
        [field]: value
      }
    }));
  };

  const copyMondayToAll = () => {
    const mon = weeklyAvailability.MON;
    setWeeklyAvailability({
      MON: { ...mon }, TUE: { ...mon }, WED: { ...mon }, THU: { ...mon }, FRI: { ...mon },
      SAT: { ...weeklyAvailability.SAT }, SUN: { ...weeklyAvailability.SUN }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center sm:justify-end bg-[#151A2D]/60 backdrop-blur-sm sm:items-start overflow-hidden">
      <div className="bg-[#F8FAFC] w-full max-w-2xl h-full flex flex-col shadow-2xl sm:animate-fade-in-right">
        
        {/* Header */}
        <div className="bg-white p-6 md:px-8 md:py-6 border-b border-[#E2E8F0] shrink-0 relative flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-[#151A2D]">{profileToEdit ? 'Edit Staff Member' : 'Add New Staff Member'}</h2>
            <p className="text-xs font-semibold text-[#64748B] mt-1">Create an employee profile for scheduling, payroll, and compliance.</p>
          </div>
          <button onClick={onClose} className="p-2 text-[#94A3B8] hover:text-[#151A2D] hover:bg-[#F1F5F9] rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 md:p-8 space-y-8">
          
          {/* SECTION 1 - BASIC INFO */}
          <section>
            <h3 className="text-[10px] font-black text-[#151A2D] uppercase tracking-widest border-b border-[#E2E8F0] pb-2 mb-4">1. Basic Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Full Name *</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className={`w-full px-3 py-2 bg-white border ${errors.fullName ? 'border-red-500' : 'border-[#E2E8F0]'} rounded-lg text-sm font-semibold`} placeholder="John Doe" />
                {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Role *</label>
                <select value={role} onChange={e => setRole(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm font-semibold">
                  <option value="Field Technician">Field Technician</option>
                  <option value="Lead Technician">Lead Technician</option>
                  <option value="Installer">Installer</option>
                  <option value="Office Staff">Office Staff</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Manager">Manager</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={`w-full px-3 py-2 bg-white border ${errors.email ? 'border-red-500' : 'border-[#E2E8F0]'} rounded-lg text-sm font-semibold`} placeholder="john@example.com" />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Phone Number</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm font-semibold" placeholder="(555) 123-4567" />
              </div>
            </div>
          </section>

          {/* SECTION 2 - EMPLOYMENT & PAY */}
          <section>
            <h3 className="text-[10px] font-black text-[#151A2D] uppercase tracking-widest border-b border-[#E2E8F0] pb-2 mb-4">2. Employment & Pay</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Status</label>
                <select value={isActive ? 'Active' : 'Inactive'} onChange={e => setIsActive(e.target.value === 'Active')} className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm font-semibold">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm font-semibold" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Hourly Wage ($) *</label>
                <input type="number" value={wage} onChange={e => setWage(e.target.value)} className={`w-full px-3 py-2 bg-white border ${errors.wage ? 'border-red-500' : 'border-[#E2E8F0]'} rounded-lg text-sm font-semibold`} placeholder="0.00" />
                {errors.wage && <p className="text-xs text-red-500 mt-1">{errors.wage}</p>}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Payroll Type</label>
                <select value={payrollType} onChange={e => setPayrollType(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm font-semibold">
                  <option value="Hourly">Hourly</option>
                  <option value="Salary">Salary</option>
                </select>
              </div>
            </div>
          </section>

          {/* SECTION 3 - AVAILABILITY */}
          <section>
            <div className="flex justify-between items-end border-b border-[#E2E8F0] pb-2 mb-4">
              <h3 className="text-[10px] font-black text-[#151A2D] uppercase tracking-widest">3. Weekly Availability</h3>
              <button onClick={copyMondayToAll} className="text-[10px] font-bold text-[#3B82F6] hover:underline uppercase tracking-wider">Copy Mon to M-F</button>
            </div>
            <div className="space-y-3">
              {DAYS.map(day => {
                const avail = (weeklyAvailability as any)[day] as DayAvailability;
                return (
                  <div key={day} className="flex items-center gap-4 bg-white p-3 rounded-lg border border-[#E2E8F0]">
                    <div className="w-12 text-sm font-bold text-[#151A2D]">{day}</div>
                    <label className="flex items-center gap-2 cursor-pointer w-28">
                      <input type="checkbox" checked={avail.isAvailable} onChange={e => updateAvailability(day, 'isAvailable', e.target.checked)} className="w-4 h-4 rounded border-[#CBD5E1] text-[#7CC242] focus:ring-[#7CC242]" />
                      <span className="text-xs font-semibold text-[#64748B]">{avail.isAvailable ? 'Available' : 'Off'}</span>
                    </label>
                    {avail.isAvailable && (
                      <div className="flex items-center gap-2 flex-1">
                        <input type="time" value={avail.start} onChange={e => updateAvailability(day, 'start', e.target.value)} className="px-2 py-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded text-xs font-semibold" />
                        <span className="text-[#94A3B8] text-xs">to</span>
                        <input type="time" value={avail.end} onChange={e => updateAvailability(day, 'end', e.target.value)} className="px-2 py-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded text-xs font-semibold" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* SECTION 4 - CERTIFICATIONS */}
          <section>
            <div className="flex justify-between items-end border-b border-[#E2E8F0] pb-2 mb-4">
              <h3 className="text-[10px] font-black text-[#151A2D] uppercase tracking-widest">4. Certifications</h3>
              <button onClick={() => setCertifications([...certifications, { name: '', issue_date: '', expiry_date: '' }])} className="text-[10px] font-bold text-[#7CC242] hover:underline uppercase tracking-wider flex items-center gap-1">
                <Plus size={12} /> Add Cert
              </button>
            </div>
            
            {certifications.length === 0 ? (
              <p className="text-xs font-semibold text-[#94A3B8] italic">No certifications added.</p>
            ) : (
              <div className="space-y-3">
                {certifications.map((cert, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-lg border border-[#E2E8F0] flex flex-wrap sm:flex-nowrap items-start gap-3">
                    <div className="w-full sm:flex-1">
                      <input 
                        type="text" 
                        value={cert.name} 
                        onChange={e => {
                          const newCerts = [...certifications];
                          newCerts[idx].name = e.target.value;
                          setCertifications(newCerts);
                        }} 
                        placeholder="Certification Name (e.g. OSHA 30)"
                        className={`w-full px-3 py-1.5 bg-[#F8FAFC] border ${errors[`cert_${idx}`] ? 'border-red-500' : 'border-[#E2E8F0]'} rounded text-xs font-semibold`} 
                      />
                      {errors[`cert_${idx}`] && <p className="text-[10px] text-red-500 mt-1">{errors[`cert_${idx}`]}</p>}
                    </div>
                    <div className="w-full sm:w-32">
                      <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-0.5">Issue Date</div>
                      <input 
                        type="date" 
                        value={cert.issue_date || ''} 
                        onChange={e => {
                          const newCerts = [...certifications];
                          newCerts[idx].issue_date = e.target.value;
                          setCertifications(newCerts);
                        }}
                        className="w-full px-2 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded text-xs font-semibold" 
                      />
                    </div>
                    <div className="w-full sm:w-32">
                      <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-0.5">Expiry Date</div>
                      <input 
                        type="date" 
                        value={cert.expiry_date || ''} 
                        onChange={e => {
                          const newCerts = [...certifications];
                          newCerts[idx].expiry_date = e.target.value;
                          setCertifications(newCerts);
                        }}
                        className={`w-full px-2 py-1.5 bg-[#F8FAFC] border ${errors[`cert_date_${idx}`] ? 'border-red-500' : 'border-[#E2E8F0]'} rounded text-xs font-semibold`} 
                      />
                      {errors[`cert_date_${idx}`] && <p className="text-[10px] text-red-500 mt-1">{errors[`cert_date_${idx}`]}</p>}
                    </div>
                    <button 
                      onClick={() => {
                        const newCerts = [...certifications];
                        newCerts.splice(idx, 1);
                        setCertifications(newCerts);
                      }}
                      className="p-1.5 text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded mt-4 sm:mt-5 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* SECTION 5 - NOTES */}
          <section>
            <h3 className="text-[10px] font-black text-[#151A2D] uppercase tracking-widest border-b border-[#E2E8F0] pb-2 mb-4">5. Internal Notes</h3>
            <textarea
              value={internalNotes}
              onChange={e => setInternalNotes(e.target.value)}
              placeholder="Internal notes about this staff member (e.g. Lead installer, emergency availability...)"
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm font-semibold min-h-[100px] resize-none"
            />
          </section>

        </div>

        {/* Footer Actions */}
        <div className="bg-white p-6 border-t border-[#E2E8F0] shrink-0 flex items-center justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#151A2D] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-sm"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2.5 bg-[#7CC242] hover:bg-[#6ab331] disabled:bg-[#94A3B8] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 min-w-[140px]"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : (profileToEdit ? 'Save Changes' : 'Save Staff')}
          </button>
        </div>

      </div>
    </div>
  );
};
