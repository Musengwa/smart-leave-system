import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface EmployeeRow {
  id: string;
  name: string;
  email: string;
  gender: 'male' | 'female' | 'other';
  job_title: string | null;
  department: string | null;
  hire_date: string;
  balance_annual: number;
  balance_sick: number;
  balance_maternity: number;
  balance_paternity: number;
  balance_compassionate: number;
  balance_study: number;
}

export interface User {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  gender: 'male' | 'female' | 'other';
  jobTitle: string | null;
  department: string | null;
  hireDate: string;
  balances: {
    annual: number;
    sick: number;
    maternity: number;
    paternity: number;
    compassionate: number;
    study: number;
  };
}

interface LoginResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  login: (name: string, email: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const STORAGE_KEY = 'hr_leave_current_user';

const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

const mapEmployee = (employee: EmployeeRow): User => ({
  id: employee.id,
  employeeId: employee.id,
  name: employee.name,
  email: employee.email,
  gender: employee.gender,
  jobTitle: employee.job_title,
  department: employee.department,
  hireDate: employee.hire_date,
  balances: {
    annual: employee.balance_annual,
    sick: employee.balance_sick,
    maternity: employee.balance_maternity,
    paternity: employee.balance_paternity,
    compassionate: employee.balance_compassionate,
    study: employee.balance_study,
  },
});

const getEmployeeByEmail = async (email: string) =>
  supabase
    .from('employees')
    .select(
      `
      id,
      name,
      email,
      gender,
      job_title,
      department,
      hire_date,
      balance_annual,
      balance_sick,
      balance_maternity,
      balance_paternity,
      balance_compassionate,
      balance_study
      `,
    )
    .eq('email', email)
    .maybeSingle<EmployeeRow>();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          if (isMounted) setIsLoading(false);
          return;
        }

        const persistedUser = JSON.parse(stored) as User;
        if (!persistedUser.email || !persistedUser.name) {
          localStorage.removeItem(STORAGE_KEY);
          if (isMounted) setIsLoading(false);
          return;
        }

        const { data, error } = await getEmployeeByEmail(persistedUser.email.toLowerCase());

        if (error || !data || normalizeName(data.name) !== normalizeName(persistedUser.name)) {
          localStorage.removeItem(STORAGE_KEY);
          if (isMounted) setUser(null);
        } else if (isMounted) {
          setUser(mapEmployee(data));
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (name: string, email: string): Promise<LoginResult> => {
    const normalizedName = name.trim().replace(/\s+/g, ' ');
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName || !normalizedEmail) {
      return {
        success: false,
        error: 'Name and email are required.',
      };
    }

    const { data, error } = await getEmployeeByEmail(normalizedEmail);

    if (error) {
      return {
        success: false,
        error: 'Unable to sign in right now. Please try again.',
      };
    }

    if (!data) {
      return {
        success: false,
        error: 'No employee record found for this email.',
      };
    }

    if (normalizeName(data.name) !== normalizeName(normalizedName)) {
      return {
        success: false,
        error: 'Name does not match this email address.',
      };
    }

    const mappedUser = mapEmployee(data);
    setUser(mappedUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mappedUser));

    return { success: true };
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
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
