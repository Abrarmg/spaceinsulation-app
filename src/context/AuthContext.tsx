import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

export type UserRole = 'office_staff' | 'field_worker' | string;

interface AuthState {
  session: Session | null;
  role: UserRole | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ session: null, role: null, loading: true });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({ session: null, role: null, loading: true });

  useEffect(() => {
    let active = true;
    let lastUserId: string | null | undefined;

    const apply = async (session: Session | null) => {
      const userId = session?.user.id ?? null;
      // Token refreshes fire auth events for the same user; skip the role refetch then.
      if (userId === lastUserId) {
        if (active) setState(s => ({ ...s, session }));
        return;
      }
      lastUserId = userId;

      if (!userId) {
        if (active) setState({ session: null, role: null, loading: false });
        return;
      }

      if (active) setState(s => ({ ...s, loading: true }));
      const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
      if (error) console.error('Failed to load user role:', error);
      if (active && lastUserId === userId) {
        setState({ session, role: data?.role ?? null, loading: false });
      }
    };

    supabase.auth.getSession().then(({ data }) => apply(data.session));
    // Supabase warns against awaiting inside this callback, so defer the profile query.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => apply(session), 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
