'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { STORAGE_KEYS } from '@/lib/constants';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface AdminContextType {
  isAdmin: boolean;
  toggleAdmin: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useLocalStorage<boolean>(STORAGE_KEYS.adminMode, false, {
    serialize: (v) => String(v),
    parse: (raw) => raw === 'true',
  });

  const toggleAdmin = () => {
    setIsAdmin((prev) => !prev);
  };

  return <AdminContext.Provider value={{ isAdmin, toggleAdmin }}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextType {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
