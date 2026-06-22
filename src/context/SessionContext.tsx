"use client";
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js'
import { syncServerAuthSession } from '@/lib/auth-session-sync'
import { supabase } from '@/lib/supabase';

export type SessionContextType = {
  session: Session | null;
  user: User | null;
  token: string | null;
  refreshSession: () => Promise<void>;
  loading: boolean;
  error: string | null;
};

const SessionContext = createContext<SessionContextType | undefined>(undefined);

function isInvalidRefreshTokenError(message: string | undefined) {
  const normalized = (message || '').trim().toLowerCase()
  return (
    normalized.includes('invalid refresh token') ||
    normalized.includes('refresh token not found')
  )
}

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastSyncedAccessTokenRef = useRef<string | null | undefined>(undefined);

  const syncSessionInBackground = useCallback((session: Session | null) => {
    const accessToken = session?.access_token ?? null
    if (lastSyncedAccessTokenRef.current === accessToken) return

    lastSyncedAccessTokenRef.current = accessToken
    void syncServerAuthSession(session).catch(() => {
      if (lastSyncedAccessTokenRef.current === accessToken) {
        lastSyncedAccessTokenRef.current = undefined
      }
    })
  }, [])

  const refreshSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      setSession(session);
      setToken(session?.access_token || null);
      setUser(session?.user || null);
      syncSessionInBackground(session)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch session'
      setSession(null);
      setUser(null);
      setToken(null);
      syncSessionInBackground(null)
      if (isInvalidRefreshTokenError(message)) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        setError(null);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [syncSessionInBackground]);

  useEffect(() => {
    refreshSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setToken(session?.access_token || null);
      setUser(session?.user || null);
      setError(null);
      setLoading(false);
      syncSessionInBackground(session)
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [refreshSession, syncSessionInBackground]);

  useEffect(() => {
    if (loading) return

    const loader = document.getElementById('initial-app-loader')
    if (!loader) return

    loader.classList.add('initial-app-loader--hidden')
    const timeoutId = window.setTimeout(() => {
      loader.remove()
    }, 220)

    return () => window.clearTimeout(timeoutId)
  }, [loading])

  return (
    <SessionContext.Provider value={{ session, user, token, refreshSession, loading, error }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSessionContext = () => {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSessionContext must be used within a SessionProvider');
  return ctx;
};
