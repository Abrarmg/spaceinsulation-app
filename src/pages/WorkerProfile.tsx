import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { User, Phone, Mail, Shield, Save, Loader2, CheckCircle2, Camera } from 'lucide-react';

export const WorkerProfile: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [profileData, setProfileData] = useState({
    id: '',
    full_name: '',
    phone: '',
    email: '',
    avatar_url: '',
    role: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) throw new Error('No active session');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfileData({
          id: data.id,
          full_name: data.full_name || '',
          phone: data.phone || '',
          email: session.user.email || data.email || '',
          role: data.role || 'field_worker',
          avatar_url: session.user.user_metadata?.avatar_url || ''
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch profile:', err);
      setError('Could not load profile information.');
    } finally {
      setLoading(false);
    }
  };

  
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      
      setUploadingAvatar(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('No active session');

      const fileExt = file.name.split('.').pop();
      const fileName = `avatars/${session.user.id}_${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('job-media')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('job-media')
        .getPublicUrl(fileName);

      await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      setProfileData({ ...profileData, avatar_url: publicUrl });

    } catch (err: any) {
      console.error('Avatar upload failed:', err);
      setError('Failed to upload profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          phone: profileData.phone
        })
        .eq('id', profileData.id);

      if (updateError) throw updateError;
      
      // Update Auth Metadata as well so the sidebar dot updates its initials if possible
      await supabase.auth.updateUser({
        data: { full_name: profileData.full_name }
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#F8FAFC] min-h-screen pb-20 flex items-center justify-center">
        <Loader2 className="animate-spin text-[#7CC242]" size={32} />
      </div>
    );
  }

  return (
    <div className="bg-[#F8FAFC] min-h-screen pb-20 font-sans text-[#151A2D]">
      {/* HEADER */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 py-6 md:px-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#151A2D]">My Profile</h1>
          <p className="text-sm font-semibold text-[#64748B] mt-1">Manage your personal information and contact details.</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 md:px-8 py-6">
        
        {/* AVATAR HERO */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 mb-6 flex flex-col items-center justify-center text-center">
          <div className="relative mb-4 group">
            <input 
              type="file" 
              accept="image/*" 
              id="avatarUpload" 
              className="hidden" 
              onChange={handleAvatarUpload}
              disabled={uploadingAvatar}
            />
            <label 
              htmlFor="avatarUpload" 
              className="relative w-24 h-24 rounded-full border-2 border-[#7CC242]/20 flex items-center justify-center text-[#7CC242] text-3xl font-black cursor-pointer overflow-hidden bg-[#7CC242]/10 hover:border-[#7CC242]/50 transition-colors block"
            >
              {profileData.avatar_url ? (
                <img src={profileData.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <>{profileData.full_name ? profileData.full_name.substring(0, 2).toUpperCase() : 'WK'}</>
              )}
              
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingAvatar ? <Loader2 className="animate-spin text-white" size={24} /> : <Camera className="text-white" size={24} />}
              </div>
            </label>
          </div>
          <h2 className="text-xl font-black">{profileData.full_name || 'Crew Member'}</h2>
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold text-[#64748B]">
            <Shield size={14} className="text-[#94A3B8]" />
            {profileData.role === 'field_worker' ? 'Field Technician' : 'Office Staff'}
          </div>
        </div>

        {/* EDIT FORM */}
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4 md:p-6 space-y-5">
          
          {error && (
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#EF4444] text-sm font-bold flex items-center gap-2">
              <Shield size={16} /> {error}
            </div>
          )}
          
          {saveSuccess && (
            <div className="p-3 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#10B981] text-sm font-bold flex items-center gap-2">
              <CheckCircle2 size={16} /> Profile updated successfully!
            </div>
          )}

          <div>
            <label className="block text-xs font-black text-[#94A3B8] uppercase tracking-wider mb-2 flex items-center gap-2">
              <User size={14} /> Full Name
            </label>
            <input
              type="text"
              required
              value={profileData.full_name}
              onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
              className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl font-bold text-[#151A2D] focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20 focus:border-[#7CC242] transition-colors"
              placeholder="e.g. John Smith"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-[#94A3B8] uppercase tracking-wider mb-2 flex items-center gap-2">
              <Phone size={14} /> Phone Number
            </label>
            <input
              type="tel"
              value={profileData.phone}
              onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
              className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl font-bold text-[#151A2D] focus:outline-none focus:ring-2 focus:ring-[#7CC242]/20 focus:border-[#7CC242] transition-colors"
              placeholder="e.g. (555) 123-4567"
            />
          </div>

          <div className="pt-4 border-t border-[#E2E8F0]">
            <label className="block text-xs font-black text-[#94A3B8] uppercase tracking-wider mb-2 flex items-center gap-2">
              <Mail size={14} /> Email Address <span className="normal-case tracking-normal text-[10px] bg-[#F1F5F9] px-2 py-0.5 rounded ml-2">Read Only</span>
            </label>
            <input
              type="email"
              disabled
              value={profileData.email}
              className="w-full px-4 py-3 bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl font-bold text-[#64748B] opacity-70 cursor-not-allowed"
            />
            <p className="text-[10px] font-semibold text-[#94A3B8] mt-2">Contact your administrator if you need to change your login email address.</p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full mt-6 py-3.5 bg-[#7CC242] hover:bg-[#6AB031] disabled:bg-[#7CC242]/50 disabled:cursor-not-allowed text-white font-black rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#7CC242]/20"
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            {saving ? 'SAVING CHANGES...' : 'SAVE PROFILE'}
          </button>
        </form>
      </div>
    </div>
  );
};
