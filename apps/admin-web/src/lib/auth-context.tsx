'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Shop, Branch } from '@saas/types';
import { api } from './api-client';

interface AuthContextType {
  user: User | null;
  shop: Shop | null;
  defaultBranch: Branch | null;
  branches: Branch[];
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User, shop?: Shop | null, defaultBranch?: Branch | null) => void;
  logout: (reason?: string | React.MouseEvent | any) => void;
  refreshUser: () => Promise<void>;
  hasPermission: (module: string, action?: 'view' | 'create' | 'edit' | 'delete') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [defaultBranch, setDefaultBranch] = useState<Branch | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = (newToken: string, newUser: User, newShop?: Shop | null, newBranch?: Branch | null) => {
    setToken(newToken);
    setUser(newUser);
    if (newShop) setShop(newShop);
    if (newBranch) setDefaultBranch(newBranch);
    localStorage.setItem('saas_token', newToken);
    if (newBranch) {
      localStorage.setItem('saas_active_branch_id', newBranch.id);
    }
  };

  const logout = (reason?: string | React.MouseEvent | any) => {
    const reasonStr = typeof reason === 'string' ? reason : undefined;
    setToken(null);
    setUser(null);
    setShop(null);
    setDefaultBranch(null);
    setBranches([]);
    localStorage.removeItem('saas_token');
    localStorage.removeItem('saas_active_branch_id');
    localStorage.removeItem('saas_last_activity');
    window.location.href = reasonStr ? `/login?reason=${encodeURIComponent(reasonStr)}` : '/login';
  };

  const hasPermission = (module: string, action?: 'view' | 'create' | 'edit' | 'delete'): boolean => {
    if (!user) return false;
    // Super admin has unrestricted permission across all modules
    if (user.role === 'super_admin' || user.roles?.includes('super_admin') || user.roles?.includes('role_super_admin')) {
      return true;
    }

    const perms = user.permissions || [];
    if (perms.includes('*')) return true;

    if (!action) {
      return perms.some(p => p.startsWith(`${module}:`) || p === module || p === `${module}:view`);
    }

    return perms.includes(`${module}:${action}`) || perms.includes(`${module}:*`) || perms.includes(module);
  };

  const refreshUser = async () => {
    const savedToken = localStorage.getItem('saas_token');
    if (!savedToken) {
      setIsLoading(false);
      return;
    }

    try {
      setToken(savedToken);
      const res = await api.get<{ user: User; shop: Shop | null; defaultBranch: Branch | null; branches: Branch[] }>('/auth/me');
      setUser(res.data.user);
      setShop(res.data.shop);
      setDefaultBranch(res.data.defaultBranch);
      setBranches(res.data.branches || []);

      if (res.data.defaultBranch && !localStorage.getItem('saas_active_branch_id')) {
        localStorage.setItem('saas_active_branch_id', res.data.defaultBranch.id);
      }
    } catch (err) {
      console.warn('Session expired or invalid:', err);
      logout('session_expired');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  // Inactivity tracking (30 minutes of idle time)
  useEffect(() => {
    if (!token) return;

    const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    localStorage.setItem('saas_last_activity', Date.now().toString());

    let throttleTimer: any = null;
    const updateActivity = () => {
      if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          localStorage.setItem('saas_last_activity', Date.now().toString());
          throttleTimer = null;
        }, 3000); // Throttle activity updates to once every 3s
      }
    };

    const checkInactivity = () => {
      const last = localStorage.getItem('saas_last_activity');
      if (last) {
        const diff = Date.now() - parseInt(last, 10);
        if (diff > INACTIVITY_TIMEOUT_MS) {
          logout('session_timeout');
        }
      }
    };

    const interval = setInterval(checkInactivity, 30000); // Check every 30s
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(evt => window.addEventListener(evt, updateActivity, { passive: true }));

    return () => {
      clearInterval(interval);
      if (throttleTimer) clearTimeout(throttleTimer);
      events.forEach(evt => window.removeEventListener(evt, updateActivity));
    };
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, shop, defaultBranch, branches, token, isLoading, login, logout, refreshUser, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
