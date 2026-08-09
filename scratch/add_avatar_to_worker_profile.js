import fs from 'fs';

const path = 'src/pages/WorkerProfile.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add Camera import
content = content.replace(
  "import { User, Phone, Mail, Shield, Save, Loader2, CheckCircle2 } from 'lucide-react';",
  "import { User, Phone, Mail, Shield, Save, Loader2, CheckCircle2, Camera } from 'lucide-react';"
);

// Add avatarUrl to state
content = content.replace(
  "email: '',",
  "email: '',\n    avatar_url: '',"
);

// Add state for uploading avatar
content = content.replace(
  "const [error, setError] = useState<string | null>(null);",
  "const [error, setError] = useState<string | null>(null);\n  const [uploadingAvatar, setUploadingAvatar] = useState(false);"
);

// Populate avatar_url from session metadata in fetchProfile
content = content.replace(
  "role: data.role || 'field_worker'",
  "role: data.role || 'field_worker',\n          avatar_url: session.user.user_metadata?.avatar_url || ''"
);

// Add handleAvatarUpload function before handleSave
const handleAvatarUpload = `
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      
      setUploadingAvatar(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('No active session');

      const fileExt = file.name.split('.').pop();
      const fileName = \`avatars/\${session.user.id}_\${Math.random()}.\${fileExt}\`;

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
`;
content = content.replace("const handleSave =", handleAvatarUpload + "\n  const handleSave =");

// Replace AVATAR HERO JSX
const avatarHeroJsxOld = `        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 mb-6 flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 rounded-full bg-[#7CC242]/10 border-2 border-[#7CC242]/20 flex items-center justify-center text-[#7CC242] text-3xl font-black mb-4">
            {profileData.full_name ? profileData.full_name.substring(0, 2).toUpperCase() : 'WK'}
          </div>
          <h2 className="text-xl font-black">{profileData.full_name || 'Crew Member'}</h2>
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold text-[#64748B]">
            <Shield size={14} className="text-[#94A3B8]" />
            {profileData.role === 'field_worker' ? 'Field Technician' : 'Office Staff'}
          </div>
        </div>`;

const avatarHeroJsxNew = `        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 mb-6 flex flex-col items-center justify-center text-center">
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
        </div>`;

content = content.replace(avatarHeroJsxOld, avatarHeroJsxNew);

fs.writeFileSync(path, content);
console.log('WorkerProfile updated');
