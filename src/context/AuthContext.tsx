import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { clearCache } from '../utils/memoryCache';
import { clearOfflineData } from '../utils/pwa';

const LAST_USER_KEY = 'si.lastSignedInUser';

export type UserRole = 'office_staff' | 'field_worker' | string;

interface AuthState {
  session: Session | null;
  role: UserRole | null;
  loading: boolean;
  /** Signed in, but there is no staff profile for this login (e.g. the person was removed). */
  profileMissing: boolean;
}

const AuthContext = createContext<AuthState>({ session: null, role: null, loading: true, profileMissing: false });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({ session: null, role: null, loading: true, profileMissing: false });

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
      // A different person (or nobody) is signed in now: drop cached lists from the last user.
      clearCache();
      // Saved offline data belongs to whoever was last signed in on this device; clear it when that changes.
      try {
        const previous = localStorage.getItem(LAST_USER_KEY);
        if (previous !== (userId ?? '')) {
          if (previous !== null) clearOfflineData();
          localStorage.setItem(LAST_USER_KEY, userId ?? '');
        }
      } catch {
        clearOfflineData();
      }

      if (!userId) {
        if (active) setState({ session: null, role: null, loading: false, profileMissing: false });
        return;
      }

      if (active) setState(s => ({ ...s, loading: true }));
      const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
      if (error) console.error('Failed to load user role:', error);
      if (active && lastUserId === userId) {
        // Only a successful lookup with no row means "no profile"; a network error is not that.
        setState({ session, role: data?.role ?? null, loading: false, profileMissing: !error && !data });
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
