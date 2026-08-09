import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Loader2, AlertCircle, Mail, CheckCircle2, Lock, Eye, EyeOff } from 'lucide-react';

export const LoginWorker: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Standard Login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Entrance states
  const [showPanel, setShowPanel] = useState(false);
  const [displayedTitle, setDisplayedTitle] = useState('');

  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password states
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Workers always default to their jobs pipeline list
  const from = (location.state as any)?.from?.pathname || '/worker-dashboard';

  // Two-stage animation sequence
  useEffect(() => {
    const fullText = "Field Management System";
    let current = "";
    let index = 0;
    setDisplayedTitle("");
    const typingTimer = setInterval(() => {
      if (index < fullText.length) {
        current += fullText.charAt(index);
        setDisplayedTitle(current);
        index++;
      } else {
        clearInterval(typingTimer);
      }
    }, 45);

    const panelTimer = setTimeout(() => {
      setShowPanel(true);
    }, 800); // Show panel much faster so users don't wait

    return () => {
      clearInterval(typingTimer);
      clearTimeout(panelTimer);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data: { user }, error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authErr) throw authErr;
      if (!user) throw new Error('Authentication failed.');

      // Proceed immediately to navigate. Role verification and redirection
      // is already handled securely by ProtectedRoute.tsx
      navigate(from, { replace: true });
    } catch (err: any) {
      console.error('Worker Login failed:', err);
      if (err.message === 'Failed to fetch') {
        setError('Unable to connect to the server. Please check your internet connection or disable ad blockers.');
      } else {
        setError(err.message || 'Incorrect credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setForgotSuccess(null);
    setForgotLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) throw error;
      setForgotSuccess('A password reset link has been sent to your email.');
    } catch (err: any) {
      console.error('Password reset failed:', err);
      setError(err.message || 'Failed to send password reset email.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen w-full flex flex-col items-center justify-center relative bg-[#111827] px-4 py-6 overflow-y-auto selection:bg-[#76C442]/30 selection:text-white font-sans"
      style={{
        backgroundImage: 'url("/login_bg.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Dark overlay & vignette */}
      <div className="absolute inset-0 bg-[#111827]/85 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,#111827_90%)] pointer-events-none" />

      {/* Unified visual group wrapper */}
      <div className="relative z-10 w-full max-w-[420px] flex flex-col items-center">
        
        {/* Branding Area (reduced vertical distance) */}
        <div 
          className={`flex flex-col items-center text-center space-y-2 mb-5 select-none transition-all duration-[900ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] transform ${
            showPanel 
              ? 'translate-y-0 scale-100 opacity-100' 
              : 'translate-y-[10vh] scale-105'
          }`}
        >
          <div className="relative flex items-center justify-center">
            {/* Ambient green glow backdrop */}
            <div className="absolute w-24 h-24 bg-[#76C442]/20 rounded-full blur-2xl pointer-events-none" />
            <img 
              src="/logo_leads.png" 
              alt="Space Insulation Logo" 
              className="w-20 h-20 md:w-24 md:h-24 object-contain relative z-10 filter drop-shadow-[0_0_15px_rgba(118,196,66,0.45)] drop-shadow-[0_0_30px_rgba(118,196,66,0.25)]"
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-widest uppercase m-0 drop-shadow-sm">
              SPACE INSULATION
            </h1>
            <h2 className="text-xs sm:text-sm font-semibold text-white/95 tracking-wide m-0 min-h-[20px] drop-shadow">
              <span>{displayedTitle}</span>
              <span className="animate-pulse text-[#76C442] ml-0.5 font-normal">|</span>
            </h2>
            <p className="text-[11px] sm:text-xs text-[#A7AFBD]/80 max-w-xs m-0 leading-relaxed font-medium">
              Manage projects, technicians and operations in one place.
            </p>
          </div>
        </div>

        {/* Compact Login Card (Glassmorphic) */}
        <div 
          className={`w-full bg-[#171D2E]/90 backdrop-blur-md rounded-2xl border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-[900ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] transform ${
            showPanel 
              ? 'opacity-100 translate-y-0 pointer-events-auto' 
              : 'opacity-0 translate-y-8 pointer-events-none'
          }`}
        >
          {/* Thin green accent line across top */}
          <div className="h-0.5 bg-[#76C442] w-full animate-pulse" />

          <div className="p-6 md:p-8 space-y-5">
            {/* Card Header */}
            <div className="flex flex-col items-center text-center space-y-1 select-none">
              <h2 className="text-xs font-semibold text-white tracking-widest uppercase m-0">
                FIELD WORKER PORTAL
              </h2>
              <p className="text-[11px] text-[#A7AFBD] m-0">
                Sign in to access your mobile dashboard
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-3 bg-red-950/40 border border-red-500/10 text-red-200 text-[11px] rounded-lg flex items-start gap-2 leading-relaxed">
                <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Banner */}
            {forgotSuccess && (
              <div className="p-3 bg-green-950/40 border border-green-500/10 text-green-200 text-[11px] rounded-lg flex items-start gap-2 leading-relaxed">
                <CheckCircle2 size={13} className="text-green-400 shrink-0 mt-0.5" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {!showForgot ? (
              /* SIGN IN FORM */
              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email Address */}
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-[#A7AFBD] tracking-wider block">
                    Email Address
                  </label>
                  <div className="relative flex items-center">
                    <Mail size={13} className="absolute left-3 text-[#A7AFBD]/40" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="worker@spaceinsulation.com"
                      className="w-full text-xs border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 bg-[#111827]/80 font-semibold text-white placeholder-white/20 focus:outline-none focus:border-[#76C442] focus:ring-1 focus:ring-[#76C442]/20 transition-all"
                      disabled={loading || !showPanel}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] uppercase font-bold text-[#A7AFBD] tracking-wider block">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setShowForgot(true);
                      }}
                      className="text-[9px] font-extrabold text-[#76C442] hover:underline cursor-pointer"
                      disabled={!showPanel}
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <Lock size={13} className="absolute left-3 text-[#A7AFBD]/40" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-xs border border-white/[0.08] rounded-lg pl-9 pr-9 py-2.5 bg-[#111827]/80 font-semibold text-white placeholder-white/20 focus:outline-none focus:border-[#76C442] focus:ring-1 focus:ring-[#76C442]/20 transition-all"
                      disabled={loading || !showPanel}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-[#A7AFBD]/40 hover:text-white focus:outline-none cursor-pointer flex items-center justify-center p-1"
                      disabled={!showPanel}
                    >
                      {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || !showPanel}
                  className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-[#76C442] to-[#18A957] hover:from-[#18A957] hover:to-[#76C442] text-[#111827] h-[46px] rounded-lg font-black transition-all duration-200 cursor-pointer text-xs uppercase tracking-widest shadow-md hover:shadow-[#76C442]/10 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 border-none"
                >
                  {loading && <Loader2 size={12} className="animate-spin text-[#111827]" />}
                  <span>LOG IN TO MOBILE PORTAL &rarr;</span>
                </button>

                {/* Security Indicator */}
                <div className="flex items-center justify-center gap-1.5 text-[9px] text-[#A7AFBD]/50 font-bold select-none uppercase tracking-widest pt-1">
                  <Lock size={10} className="text-[#76C442]/60" />
                  <span>Secure Worker Access</span>
                </div>
                
                {/* Divider */}
                <div className="w-full h-px bg-white/[0.06] my-4" />

                {/* Toggle to admin portal */}
                <div className="text-center">
                  <span className="text-[10px] text-[#A7AFBD]/50 font-medium">Office Staff?</span>{' '}
                  <Link
                    to="/login/admin"
                    className="text-[10px] font-bold text-[#76C442] hover:underline cursor-pointer ml-1 inline-flex items-center gap-0.5"
                  >
                    <span>Use Office Login Portal</span>
                    <span>&rarr;</span>
                  </Link>
                </div>
              </form>
            ) : (
              /* FORGOT PASSWORD FORM */
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-[#A7AFBD] tracking-wider block">
                    Enter Email
                  </label>
                  <div className="relative flex items-center">
                    <Mail size={13} className="absolute left-3 text-[#A7AFBD]/40" />
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full text-xs border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 bg-[#111827]/80 font-semibold text-white placeholder-white/20 focus:outline-none focus:border-[#76C442] focus:ring-1 focus:ring-[#76C442]/20 transition-all"
                      disabled={forgotLoading || !showPanel}
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setShowForgot(false);
                    }}
                    className="flex-1 py-2.5 border border-white/[0.08] hover:bg-white/5 text-[#A7AFBD] text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    disabled={forgotLoading || !showPanel}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading || !showPanel}
                    className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#76C442] to-[#18A957] hover:from-[#18A957] hover:to-[#76C442] text-[#111827] py-2.5 rounded-lg font-black transition-all duration-200 cursor-pointer text-xs uppercase tracking-widest shadow-md hover:shadow-[#76C442]/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 border-none"
                  >
                    {forgotLoading && <Loader2 size={11} className="animate-spin text-[#111827]" />}
                    <span>Reset Password</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
