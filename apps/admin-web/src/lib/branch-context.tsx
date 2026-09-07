'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Branch } from '@saas/types';
import { useAuth } from './auth-context';
import { api } from './api-client';

interface BranchContextType {
  branches: Branch[];
  activeBranch: Branch | null;
  setActiveBranchId: (branchId: string) => void;
  refreshBranches: () => Promise<void>;
  isLoading: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, defaultBranch } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshBranches = async () => {
    if (!user || user.role === 'super_admin' || !user.shopId) return;

    try {
      setIsLoading(true);
      const res = await api.get<Branch[]>('/branches');
      setBranches(res.data);

      const savedBranchId = localStorage.getItem('saas_active_branch_id');
      const found = res.data.find(b => b.id === savedBranchId);
      if (found) {
        setActiveBranch(found);
      } else if (res.data.length > 0) {
        const def = res.data.find(b => b.isDefault) || res.data[0];
        setActiveBranch(def);
        localStorage.setItem('saas_active_branch_id', def.id);
      }
    } catch (err) {
      console.error('Failed to load branches:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const setActiveBranchId = (branchId: string) => {
    const found = branches.find(b => b.id === branchId);
    if (found) {
      setActiveBranch(found);
      localStorage.setItem('saas_active_branch_id', found.id);
      // Trigger soft refresh of operational widgets
      window.dispatchEvent(new Event('branch_changed'));
    }
  };

  useEffect(() => {
    if (user && user.shopId) {
      refreshBranches();
    }
  }, [user]);

  return (
    <BranchContext.Provider value={{ branches, activeBranch, setActiveBranchId, refreshBranches, isLoading }}>
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
};
