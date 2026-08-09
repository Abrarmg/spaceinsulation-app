import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Sparkles, Loader2, AlertCircle, Key, CheckCircle2 } from 'lucide-react';

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    // Check if we have an active session (which is automatically set by Supabase when clicking the email hash link)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setError('No active password reset session found. Please request a new link from the login screen.');
      }
      setSessionChecked(true);
    });
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password
      });

      if (updateErr) throw updateErr;

      setSuccess('Your password has been successfully updated! Redirecting to login...');
      
      // Redirect after brief display delay
      setTimeout(() => {
        navigate('/login/worker', { replace: true });
      }, 3500);
    } catch (err: any) {
      console.error('Password update failed:', err);
      setError(err.message || 'Failed to update your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-grey px-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-brand-grey-medium shadow-xl overflow-hidden">
        {/* Brand Accent */}
        <div className="h-2 bg-brand-green w-full" />

        <div className="p-8 space-y-6">
          {/* Header */}
          <div className="flex flex-col items-center text-center space-y-2 select-none">
            <div className="bg-brand-charcoal text-brand-green p-2.5 rounded-xl flex items-center justify-center shadow-md">
              <Sparkles size={24} className="stroke-[2.5]" />
            </div>
            <h2 className="text-xl font-black text-brand-charcoal tracking-tight m-0 uppercase mt-2">
              Setup New Password
            </h2>
            <p className="text-xs text-brand-grey-dark max-w-xs m-0">
              Update your account password below to finalize credential configuration.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-start gap-2 leading-relaxed">
              <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {success && (
            <div className="p-3.5 bg-green-50 border border-green-200 text-green-800 text-xs rounded-lg flex items-start gap-2 leading-relaxed">
              <CheckCircle2 size={15} className="text-green-500 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {sessionChecked && !success && (
            <form onSubmit={handleReset} className="space-y-4">
              {/* Password */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-brand-grey-dark tracking-wider flex items-center gap-1.5">
                  <Key size={12} className="text-brand-green" />
                  <span>New Password</span>
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs border border-brand-grey-dark/60 rounded-md px-3 py-2 bg-white font-semibold text-brand-charcoal focus:outline-none focus:border-brand-green"
                  disabled={loading || !!error}
                />
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-brand-grey-dark tracking-wider flex items-center gap-1.5">
                  <Key size={12} className="text-brand-green" />
                  <span>Confirm Password</span>
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs border border-brand-grey-dark/60 rounded-md px-3 py-2 bg-white font-semibold text-brand-charcoal focus:outline-none focus:border-brand-green"
                  disabled={loading || !!error}
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !!error}
                className="w-full mt-4 flex items-center justify-center gap-2 bg-brand-charcoal hover:bg-brand-dark text-white py-2.5 rounded-lg font-bold transition-colors cursor-pointer text-xs disabled:opacity-50"
              >
                {loading && <Loader2 size={13} className="animate-spin text-brand-green" />}
                <span>Update Account Password</span>
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
