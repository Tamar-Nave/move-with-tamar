import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { getMfaPending } from '@/lib/mfa';
import { supabase } from '@/lib/supabase';

export type Profile = {
  id: string;
  email: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_admin: boolean;
};

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  mfaPending: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshMfaStatus: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
  mfaPending: false,
  signOut: async () => {},
  refreshProfile: async () => {},
  refreshMfaStatus: async () => {},
});

const PROFILE_COLUMNS = 'id, email, first_name, last_name, phone, avatar_url, is_admin';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaPending, setMfaPending] = useState(false);

  // onAuthStateChange alone covers the initial load too — supabase-js fires it once right after
  // subscribing, with whatever session already exists (event INITIAL_SESSION). A separate
  // getSession() call used to run alongside it, and whichever one resolved last could overwrite the
  // other's (possibly newer) result — removed rather than patched, since it was never needed.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        setProfile((data as Profile | null) ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  async function refreshProfile() {
    if (!session) return;
    const { data } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', session.user.id).single();
    setProfile((data as Profile | null) ?? null);
  }

  // Whether this session still needs a TOTP code before it's fully trusted (only ever true for an
  // account that has MFA turned on — most members never see this).
  async function refreshMfaStatus() {
    if (!session) { setMfaPending(false); return; }
    setMfaPending(await getMfaPending());
  }

  useEffect(() => {
    refreshMfaStatus();
  }, [session]);

  return (
    <AuthContext.Provider
      value={{
        session, profile, loading, mfaPending,
        signOut: async () => void (await supabase.auth.signOut()),
        refreshProfile, refreshMfaStatus,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
