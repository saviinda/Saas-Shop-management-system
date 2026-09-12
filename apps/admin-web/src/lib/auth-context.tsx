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
  logout: () => void;
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

  const logout = () => {
    setToken(null);
    setUser(null);
    setShop(null);
    setDefaultBranch(null);
    setBranches([]);
    localStorage.removeItem('saas_token');
    localStorage.removeItem('saas_active_branch_id');
    window.location.href = '/login';
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
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

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
