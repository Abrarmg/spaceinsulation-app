import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
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
  const { session, role, loading } = useAuth();

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

  if (role === 'field_worker' && matchesAny(location.pathname, WORKER_RESTRICTED_PREFIXES)) {
    return <Navigate to="/worker-dashboard" replace />;
  }

  return <>{children}</>;
};
