import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

interface User {
  id: string;
  name: string;
  email: string;
  employeeId: string;
}

interface LoginResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const formatNameFromEmail = (email?: string) => {
  if (!email) return 'Employee';
  const localPart = email.split('@')[0] ?? '';
  return localPart
    .replace(/[._-]/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Employee';
};

const mapSupabaseUser = (supabaseUser: SupabaseUser): User => {
  const metadata = supabaseUser.user_metadata ?? {};
  const name = metadata.full_name ?? metadata.name ?? formatNameFromEmail(supabaseUser.email);
  const employeeId = metadata.employee_id ?? metadata.employeeId ?? `EMP-${supabaseUser.id.slice(0, 8).toUpperCase()}`;

  return {
    id: supabaseUser.id,
    name,
    email: supabaseUser.email ?? '',
    employeeId,
  };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data.session?.user) {
        setUser(mapSupabaseUser(data.session.user));
      }
      setIsLoading(false);
    };

    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(mapSupabaseUser(session.user));
      } else {
        setUser(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.user) {
      return {
        success: false,
        error: error?.message ?? 'Unable to sign in.',
      };
    }

    setUser(mapSupabaseUser(data.user));
    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
