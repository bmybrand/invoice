"use client";
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type SessionContextType = {
  session: any;
  user: any;
  token: string | null;
  refreshSession: () => Promise<void>;
  loading: boolean;
  error: string | null;
};

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
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
    } catch (err: any) {
      setError(err.message || 'Failed to fetch session');
      setSession(null);
      setUser(null);
      setToken(null);
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
