import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout, AuthNotice } from '../components/layout/AuthLayout';
import { Button, Field, Input } from '../components/ui';
import { supabase } from '../supabaseClient';

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

      setSuccess('Your password is updated. Taking you to sign in…');
      
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
    <AuthLayout>
      <h1 className="m-0 text-2xl font-bold text-navy tracking-tight">Choose a new password</h1>
      <p className="m-0 mt-1 text-sm text-muted">Use at least 6 characters. You'll sign in with it next time.</p>

      <div className="mt-6 space-y-4">
        {error && <AuthNotice tone="error">{error}</AuthNotice>}
        {success && <AuthNotice tone="success">{success}</AuthNotice>}

        {sessionChecked && !success && (
          <form onSubmit={handleReset} className="space-y-4">
            <Field label="New password" htmlFor="new-password">
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading || !!error}
                className="!h-12"
              />
            </Field>
            <Field label="Confirm new password" htmlFor="confirm-password">
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                disabled={loading || !!error}
                className="!h-12"
              />
            </Field>
            <Button type="submit" size="lg" block loading={loading} disabled={!!error} className="!h-12 text-base">
              Update password
            </Button>
          </form>
        )}

        {error && (
          <Link to="/login/worker" className="block text-center text-sm font-semibold text-brand-ink no-underline hover:underline">
            Back to sign in
          </Link>
        )}
      </div>
    </AuthLayout>
  );
};
