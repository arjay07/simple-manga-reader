'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiUrl } from '@/lib/basePath';

interface Profile {
  id: number;
  name: string;
  avatar: string | null;
  reading_direction: 'rtl' | 'ltr';
  theme: 'dark' | 'light';
  reader_settings: string;
}

interface ProfileContextType {
  profile: Profile | null;
  loading: boolean;
  setActiveProfile: (profile: Profile) => void;
  clearProfile: () => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

const STORAGE_KEY = 'profileId';

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
    localStorage.setItem('theme', theme);
  };

  useEffect(() => {
    const storedId = localStorage.getItem(STORAGE_KEY);
    if (!storedId) {
      setLoading(false);
      return;
    }

    fetch(apiUrl(`/api/profiles/${storedId}`))
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch profile');
        return res.json();
      })
      .then((data: Profile) => {
        setProfile(data);
        document.cookie = `profileId=${data.id};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
        if (data.theme) {
          applyProfileTheme(data.theme);
        }
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
      })
      .finally(() => {
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
