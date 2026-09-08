import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, Role } from '../types';
import { api } from '../services/apiClient';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    role?: Role;
    rollNo?: string;
    room?: string;
    empId?: string;
    hostelId?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on initial load strictly from verified backend session
  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      try {
        const res = await api.getMe();
        if (mounted) {
          if (res.ok && res.user) {
            setUser(res.user);
            localStorage.setItem('hg_cached_user', JSON.stringify(res.user));
          } else {
            setUser(null);
            localStorage.removeItem('hg_cached_user');
          }
        }
      } catch (err) {
        if (mounted) {
          setUser(null);
          localStorage.removeItem('hg_cached_user');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    checkAuth();
    return () => {
      mounted = false;
    };
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    const res = await api.login(email, pass);
    if (res.ok && res.user) {
      setUser(res.user);
      localStorage.setItem('hg_cached_user', JSON.stringify(res.user));
      setLoading(false);
      return { ok: true };
    }
    setLoading(false);
    return { ok: false, error: res.error || 'Invalid email or password.' };
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {}
    setUser(null);
    localStorage.removeItem('hg_cached_user');
  };

  const register = async (data: {
    name: string;
    email: string;
    password: string;
    role?: Role;
    rollNo?: string;
    room?: string;
    empId?: string;
    hostelId?: string;
  }) => {
    setLoading(true);
    const res = await api.register(data);
    if (res.ok && res.user) {
      setUser(res.user);
      localStorage.setItem('hg_cached_user', JSON.stringify(res.user));
      setLoading(false);
      return { ok: true };
    }
    setLoading(false);
    return { ok: false, error: res.error || 'Registration failed.' };
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
