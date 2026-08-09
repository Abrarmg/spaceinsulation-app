import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session: activeSession } }) => {
      setSession(activeSession);
      if (activeSession?.user) {
        fetchUserRole(activeSession.user.id);
      } else {
        setLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, activeSession) => {
      setSession(activeSession);
      if (activeSession?.user) {
        fetchUserRole(activeSession.user.id);
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        setRole(data.role);
      }
    } catch (err) {
      console.error('Failed to load user role for routing guard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen gap-3 text-brand-grey-dark">
        <Loader2 className="w-10 h-10 animate-spin text-brand-green" />
        <span className="text-sm font-semibold">Verifying credentials...</span>
      </div>
    );
  }

  // A. Unauthenticated users: redirect to worker login page by default (or admin page if they were accessing admin routes)
  if (!session) {
    const isAdminRoute = location.pathname.startsWith('/scheduling') || 
                        location.pathname.startsWith('/employees') || 
                        location.pathname.startsWith('/customers') || 
                        location.pathname === '/';
                        
    const redirectPath = isAdminRoute ? '/login/admin' : '/login/worker';
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  // B. Role Authorization Guards
  if (role === 'field_worker') {
    // Field worker restricted paths
    const isRestrictedPath = location.pathname === '/' || 
                             location.pathname.startsWith('/customers') || 
                             location.pathname.startsWith('/scheduling') || 
                             location.pathname.startsWith('/employees') ||
                             location.pathname.startsWith('/expenses') ||
                             location.pathname.startsWith('/net-profit-breakdown');

    if (isRestrictedPath) {
      console.warn(`Access Denied: Field workers are restricted from accessing ${location.pathname}`);
      return <Navigate to="/worker-dashboard" replace />;
    }
  }

  if (role === 'office_staff') {
    // No paths restricted for office_staff
  }

  // Admins or authorized worker path: allow access
  return <>{children}</>;
};
