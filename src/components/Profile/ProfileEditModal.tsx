'use client';

import { useEffect } from 'react';
import ProfileForm from './ProfileForm';
import type { Profile } from '@/types';

interface ProfileEditModalProps {
  profile: Profile;
  onClose: () => void;
  onUpdated: (profile: Profile) => void;
  onDeleted: (profileId: number) => void;
}

export default function ProfileEditModal({
  profile,
  onClose,
  onUpdated,
  onDeleted,
}: ProfileEditModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit profile"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <ProfileForm
          profile={profile}
          onUpdated={onUpdated}
          onDeleted={onDeleted}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
