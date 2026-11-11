import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2, UserX } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ADMIN_LOGIN_PREFIXES = ['/scheduling', '/employees', '/contacts', '/customers', '/notes'];
const WORKER_RESTRICTED_PREFIXES = [
  '/contacts',
  '/customers',
  '/scheduling',
  '/employees',
  '/expenses',
  '/net-profit-breakdown',
  '/notes',
];

const matchesAny = (path: string, prefixes: string[]) => path === '/' || prefixes.some(p => path.startsWith(p));

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const { session, role, loading, profileMissing } = useAuth();

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen gap-3 text-brand-grey-dark">
        <Loader2 className="w-10 h-10 animate-spin text-brand-green" />
        <span className="text-sm font-semibold">Verifying credentials...</span>
      </div>
    );
  }

  if (!session) {
    const redirectPath = matchesAny(location.pathname, ADMIN_LOGIN_PREFIXES) ? '/login/admin' : '/login/worker';
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  // Signed in, but this login has no staff profile (for example the person was removed from
  // Employees). Without one nothing can load, so say so instead of spinning forever.
  if (profileMissing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas p-6">
        <div className="max-w-sm w-full bg-white border border-line rounded-2xl shadow-card p-6 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center">
            <UserX size={22} />
          </div>
          <h1 className="text-lg font-bold text-navy">This account isn't set up</h1>
          <p className="text-sm text-muted">
            {session.user.email ? <span className="font-semibold text-ink-soft break-all">{session.user.email}</span> : 'This login'} isn't
            linked to a staff member in Space Insulation. Ask the office to add you on the Employees page.
          </p>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="w-full h-11 rounded-xl bg-navy text-white text-sm font-semibold cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (role === 'field_worker' && matchesAny(location.pathname, WORKER_RESTRICTED_PREFIXES)) {
    return <Navigate to="/worker-dashboard" replace />;
  }

  return <>{children}</>;
};
