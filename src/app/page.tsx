'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/components/ProfileProvider';
import ProfileForm from '@/components/Profile/ProfileForm';
import ProfileEditModal from '@/components/Profile/ProfileEditModal';
import { apiUrl } from '@/lib/basePath';

interface Profile {
  id: number;
  name: string;
  avatar: string | null;
  reading_direction: 'rtl' | 'ltr';
  theme: 'dark' | 'light';
  reader_settings: string;
  is_child: number;
}

export default function ProfileSelector() {
  const router = useRouter();
  const { setActiveProfile } = useProfile();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [manageMode, setManageMode] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

  useEffect(() => {
    fetch(apiUrl('/api/profiles'))
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch profiles');
        return res.json();
      })
      .then((data: Profile[]) => {
        setProfiles(data);
      })
      .catch(() => {
        setProfiles([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleProfileTap = (profile: Profile) => {
    if (manageMode) {
      setEditingProfile(profile);
    } else {
      setActiveProfile(profile);
      router.push('/library');
    }
  };

  const handleProfileCreated = (profile: Profile) => {
    setProfiles((prev) => [...prev, profile]);
    setShowForm(false);
  };

  const handleProfileUpdated = (updated: Profile) => {
    setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditingProfile(null);
  };

  const handleProfileDeleted = (id: number) => {
    setProfiles((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (next.length === 0) setManageMode(false);
      return next;
    });
    setEditingProfile(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted text-lg">Loading...</div>
      </div>
    );
  }

  const hasProfiles = profiles.length > 0;
  const showFormDirectly = !hasProfiles && !showForm;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {showForm || showFormDirectly ? (
        <div className="flex flex-col items-center gap-6">
          {!hasProfiles && (
            <div className="text-center space-y-2 mb-2">
              <h1 className="text-3xl font-bold text-foreground">Welcome!</h1>
              <p className="text-muted">Create your first profile to get started.</p>
            </div>
          )}
          {hasProfiles && (
            <h1 className="text-3xl font-bold text-foreground">Add Profile</h1>
          )}
          <ProfileForm
            onCreated={handleProfileCreated}
            onCancel={hasProfiles ? () => setShowForm(false) : undefined}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-10">
          <h1 className="text-3xl font-bold text-foreground md:text-4xl">
            {manageMode ? 'Manage Profiles' : `Who's reading?`}
          </h1>

          <div className="flex flex-wrap items-center justify-center gap-6">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => handleProfileTap(profile)}
                aria-label={manageMode ? `Edit ${profile.name}` : `Select ${profile.name}`}
                className="group flex flex-col items-center gap-3 rounded-lg p-4 transition-transform hover:scale-105"
              >
                <div className="relative flex h-24 w-24 items-center justify-center rounded-lg bg-surface-elevated text-5xl transition-all group-hover:ring-2 group-hover:ring-accent md:h-32 md:w-32 md:text-6xl">
                  <div className={manageMode ? 'opacity-40' : ''}>
                    {profile.avatar ? (
                      <span>{profile.avatar}</span>
                    ) : (
                      <span className="font-bold text-accent">
                        {profile.name
                          .split(' ')
                          .map((w) => w[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </span>
                    )}
                  </div>
                  {manageMode && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 flex items-center justify-center text-3xl md:text-4xl"
                    >
                      ✏️
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium text-muted transition-colors group-hover:text-foreground md:text-base">
                  {profile.name}
                </span>
              </button>
            ))}

            {!manageMode && (
              <button
                onClick={() => setShowForm(true)}
                className="group flex flex-col items-center gap-3 rounded-lg p-4 transition-transform hover:scale-105"
              >
                <div className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-border text-4xl text-muted transition-all group-hover:border-accent group-hover:text-accent md:h-32 md:w-32 md:text-5xl">
                  +
                </div>
                <span className="text-sm font-medium text-muted transition-colors group-hover:text-foreground md:text-base">
                  Add Profile
                </span>
              </button>
            )}
          </div>

          {hasProfiles && (
            <button
              onClick={() => setManageMode((m) => !m)}
              className="min-h-11 rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-foreground"
            >
              {manageMode ? 'Done' : 'Manage Profiles'}
            </button>
          )}
        </div>
      )}

      {editingProfile && (
        <ProfileEditModal
          profile={editingProfile}
          onClose={() => setEditingProfile(null)}
          onUpdated={handleProfileUpdated}
          onDeleted={handleProfileDeleted}
        />
      )}
    </div>
  );
}
