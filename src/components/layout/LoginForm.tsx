import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { Button, Field, Input } from '../ui';
import { AuthLayout, AuthNotice } from './AuthLayout';
import { InstallCard } from '../onboarding/InstallCard';

interface LoginFormProps {
  /** e.g. "Office sign in" */
  title: string;
  subtitle: string;
  /** Where to go after signing in when no page was requested. */
  defaultRedirect: string;
  emailPlaceholder: string;
  switchPrompt: string;
  switchLabel: string;
  switchTo: string;
  logLabel: string;
}

/** Shared sign-in + forgot-password form for the office and field-worker portals. */
export const LoginForm: React.FC<LoginFormProps> = ({
  title,
  subtitle,
  defaultRedirect,
  emailPlaceholder,
  switchPrompt,
  switchLabel,
  switchTo,
  logLabel,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || defaultRedirect;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) throw authErr;
      if (!user) throw new Error('Authentication failed.');
      // Role checks and redirects are handled by ProtectedRoute.
      navigate(from, { replace: true });
    } catch (err: any) {
      console.error(`${logLabel} login failed:`, err);
      setError(
        err.message === 'Failed to fetch'
          ? 'Unable to connect to the server. Please check your internet connection or disable ad blockers.'
          : err.message || 'Incorrect email or password.',
      );
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
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetErr) throw resetErr;
      setForgotSuccess('Check your inbox — we sent you a link to reset your password.');
    } catch (err: any) {
      console.error('Password reset failed:', err);
      setError(err.message || 'Failed to send password reset email.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <AuthLayout>
      {!showForgot ? (
        <>
          <h1 className="m-0 text-2xl font-bold text-navy tracking-tight">{title}</h1>
          <p className="m-0 mt-1 text-sm text-muted">{subtitle}</p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            {error && <AuthNotice tone="error">{error}</AuthNotice>}
            {forgotSuccess && <AuthNotice tone="success">{forgotSuccess}</AuthNotice>}

            <Field label="Email" htmlFor="login-email">
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle pointer-events-none" />
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={emailPlaceholder}
                  disabled={loading}
                  className="!h-12 pl-9"
                />
              </div>
            </Field>

            <Field
              label={
                <span className="flex items-center justify-between">
                  Password
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setForgotEmail(email);
                      setShowForgot(true);
                    }}
                    className="text-xs font-semibold text-brand-ink hover:underline border-0 bg-transparent"
                  >
                    Forgot password?
                  </button>
                </span>
              }
              htmlFor="login-password"
            >
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle pointer-events-none" />
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Your password"
                  disabled={loading}
                  className="!h-12 pl-9 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-md text-muted hover:text-navy hover:bg-mist border-0 bg-transparent"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            <Button type="submit" size="lg" block loading={loading} className="!h-12 text-base">
              Sign in
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-line text-center text-sm text-muted">
            {switchPrompt}{' '}
            <Link to={switchTo} className="font-semibold text-brand-ink no-underline hover:underline">
              {switchLabel}
            </Link>
          </div>

          <div className="mt-6">
            <InstallCard audience={defaultRedirect === '/worker-dashboard' ? 'crew' : 'office'} />
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setShowForgot(false);
            }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy border-0 bg-transparent mb-4 p-0"
          >
            <ArrowLeft size={16} /> Back to sign in
          </button>
          <h1 className="m-0 text-2xl font-bold text-navy tracking-tight">Reset your password</h1>
          <p className="m-0 mt-1 text-sm text-muted">Enter your email and we'll send you a link to choose a new password.</p>

          <form onSubmit={handleForgotPassword} className="mt-6 space-y-4">
            {error && <AuthNotice tone="error">{error}</AuthNotice>}
            {forgotSuccess && <AuthNotice tone="success">{forgotSuccess}</AuthNotice>}
            <Field label="Email" htmlFor="forgot-email">
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                required
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={forgotLoading}
                className="!h-12"
              />
            </Field>
            <Button type="submit" size="lg" block loading={forgotLoading} className="!h-12 text-base">
              Send reset link
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
};
