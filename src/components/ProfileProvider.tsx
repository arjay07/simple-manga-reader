'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiUrl } from '@/lib/basePath';
import { STORAGE_KEYS } from '@/lib/constants';
import type { Profile } from '@/types';

interface ProfileContextType {
  profile: Profile | null;
  loading: boolean;
  setActiveProfile: (profile: Profile) => void;
  clearProfile: () => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

const STORAGE_KEY = STORAGE_KEYS.profileId;

export default function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const applyProfileTheme = (theme: 'dark' | 'light') => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEYS.theme, theme);
  };

  useEffect(() => {
    const storedId = localStorage.getItem(STORAGE_KEY);

    const loadProfile = async () => {
      if (!storedId) return;
      try {
        const res = await fetch(apiUrl(`/api/profiles/${storedId}`));
        if (!res.ok) throw new Error('Failed to fetch profile');
        const data: Profile = await res.json();
        setProfile(data);
        document.cookie = `profileId=${data.id};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
        if (data.theme) {
          applyProfileTheme(data.theme);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    };

    loadProfile().finally(() => {
      setLoading(false);
    });
  }, []);

  const setActiveProfile = (newProfile: Profile) => {
    setProfile(newProfile);
    localStorage.setItem(STORAGE_KEY, String(newProfile.id));
    document.cookie = `profileId=${newProfile.id};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
    if (newProfile.theme) {
      applyProfileTheme(newProfile.theme);
    }
  };

  const clearProfile = () => {
    setProfile(null);
    localStorage.removeItem(STORAGE_KEY);
    document.cookie = 'profileId=;path=/;max-age=0';
  };

  return (
    <ProfileContext.Provider value={{ profile, loading, setActiveProfile, clearProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextType {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
