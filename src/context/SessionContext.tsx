"use client";
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js'
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

  const refreshSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      setSession(session);
      setToken(session?.access_token || null);
      setUser(session?.user || null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch session'
      setSession(null);
      setUser(null);
      setToken(null);
      if (isInvalidRefreshTokenError(message)) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        setError(null);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setToken(session?.access_token || null);
      setUser(session?.user || null);
      setError(null);
      setLoading(false);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [refreshSession]);

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
