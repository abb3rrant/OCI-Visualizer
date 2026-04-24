import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('oci-viz-token'));
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('oci-viz-user');
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      localStorage.removeItem('oci-viz-user');
      localStorage.removeItem('oci-viz-token');
      return null;
    }
  });

  const login = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('oci-viz-token', newToken);
    localStorage.setItem('oci-viz-user', JSON.stringify(newUser));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('oci-viz-token');
    localStorage.removeItem('oci-viz-user');
  }, []);

  const isAdmin = user?.role === 'admin';

  const value = useMemo(() => ({
    user, token, login, logout, isAuthenticated: !!token, isAdmin,
  }), [user, token, login, logout, isAdmin]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
