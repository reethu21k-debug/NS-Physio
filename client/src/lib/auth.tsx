import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { api } from './api';
import type { Profile } from './types';

const PROFILE_TIMEOUT_MS = 15_000;

interface AuthState {
  session: Session | null; profile: Profile | null;
  loading: boolean;          // initial session lookup only
  profileLoading: boolean;   // a /profile request is in flight
  profileFailed: boolean;
  refreshProfile: () => Promise<void>; signOut: () => Promise<void>;
}
const Ctx = createContext<AuthState>({ session: null, profile: null, loading: true, profileLoading: false, profileFailed: false, refreshProfile: async () => {}, signOut: async () => {} });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileFailed, setProfileFailed] = useState(false);
  const mounted = useRef(true);
  const reqId = useRef(0); // only the newest profile request (or a sign-out) may touch state

  const loadProfile = useCallback(async () => {
    const id = ++reqId.current;
    setProfileLoading(true); setProfileFailed(false);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const p = await Promise.race([
        api<Profile>('/profile'),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Profile request timed out')), PROFILE_TIMEOUT_MS); }),
      ]);
      if (!mounted.current || id !== reqId.current) return;
      setProfile(p);
    } catch (e) {
      if (!mounted.current || id !== reqId.current) return;
      setProfile(null); setProfileFailed(true);
      // Invalid/expired session: drop it; the auth listener then clears state and ProtectedRoute redirects to /login.
      if ((e as { status?: number } | null)?.status === 401) void supabase.auth.signOut();
    } finally {
      if (timer) clearTimeout(timer);
      // Always cleared on success AND failure (unless a newer request/sign-out now owns the flag).
      if (mounted.current && id === reqId.current) setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    supabase.auth.getSession()
      .then(({ data }) => {
        if (!mounted.current) return;
        setSession(data.session);
        if (data.session) void loadProfile();
      })
      .catch(() => { if (mounted.current) setSession(null); })
      .finally(() => { if (mounted.current) setLoading(false); });

    const { data: sub } = supabase.auth.onAuthStateChange((evt, s) => {
      if (!mounted.current) return;
      setSession(s);
      if (!s) { reqId.current++; setProfile(null); setProfileFailed(false); setProfileLoading(false); return; }
      if (evt === 'INITIAL_SESSION' || evt === 'TOKEN_REFRESHED') return; // initial load handled above; refreshes don't change the profile
      setProfileLoading(true);
      setTimeout(() => void loadProfile(), 0); // avoid deadlock inside the auth callback
    });
    return () => { mounted.current = false; reqId.current++; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    try { await supabase.auth.signOut(); }
    finally { reqId.current++; setProfile(null); setProfileFailed(false); setProfileLoading(false); }
  }, []);

  return (
    <Ctx.Provider value={{ session, profile, loading, profileLoading, profileFailed, refreshProfile: loadProfile, signOut }}>
      {children}
    </Ctx.Provider>
  );
}