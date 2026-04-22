'use client';

import { useState } from 'react';
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

const EMOJI_OPTIONS = ['😊', '📚', '🐉', '⚡', '🌟', '🎮', '🦊', '🌙', '🔥', '🌊', '👾', '🍜'];

interface ProfileFormProps {
  profile?: Profile;
  onCreated?: (profile: Profile) => void;
  onUpdated?: (profile: Profile) => void;
  onDeleted?: (profileId: number) => void;
  onCancel?: () => void;
}

export default function ProfileForm({
  profile,
  onCreated,
  onUpdated,
  onDeleted,
  onCancel,
}: ProfileFormProps) {
  const isEdit = !!profile;
  const [name, setName] = useState(profile?.name ?? '');
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar ?? null);
  const [isChild, setIsChild] = useState<boolean>(!!profile?.is_child);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit && profile) {
        const res = await fetch(apiUrl(`/api/profiles/${profile.id}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed, avatar, is_child: isChild ? 1 : 0 }),
        });
        if (res.status === 409) {
          setError('A profile with that name already exists');
          return;
        }
        if (!res.ok) throw new Error('Failed to update profile');
        const updated: Profile = await res.json();
        onUpdated?.(updated);
      } else {
        const res = await fetch(apiUrl('/api/profiles'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed, avatar }),
        });
        if (res.status === 409) {
          setError('A profile with that name already exists');
          return;
        }
        if (!res.ok) throw new Error('Failed to create profile');
        const created: Profile = await res.json();
        onCreated?.(created);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!profile) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(apiUrl(`/api/profiles/${profile.id}`), { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete profile');
      onDeleted?.(profile.id);
    } catch {
      setError('Something went wrong. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md rounded-xl bg-surface p-6 space-y-6"
    >
      <h2 className="text-xl font-semibold text-foreground">
        {isEdit ? 'Edit Profile' : 'Create Profile'}
      </h2>

      <div className="space-y-2">
        <label htmlFor="profile-name" className="block text-sm font-medium text-muted">
          Name
        </label>
        <input
          id="profile-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <span className="block text-sm font-medium text-muted">Avatar</span>
        <div className="grid grid-cols-6 gap-2">
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setAvatar(avatar === emoji ? null : emoji)}
              className={`flex h-12 w-12 items-center justify-center rounded-lg text-2xl transition-all ${
                avatar === emoji
                  ? 'bg-accent/20 ring-2 ring-accent scale-110'
                  : 'bg-surface-elevated hover:bg-border'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {isEdit && (
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface-elevated px-4 py-3 min-h-11">
          <div>
            <div className="text-sm font-medium text-foreground">Child profile</div>
            <div className="text-xs text-muted">Used for content restrictions</div>
          </div>
          <span
            role="switch"
            aria-checked={isChild}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
              isChild ? 'bg-accent' : 'bg-border'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                isChild ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </span>
          <input
            type="checkbox"
            className="sr-only"
            checked={isChild}
            onChange={(e) => setIsChild(e.target.checked)}
          />
        </label>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting || deleting}
          className="flex-1 rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting
            ? isEdit
              ? 'Saving...'
              : 'Creating...'
            : isEdit
              ? 'Save Changes'
              : 'Create Profile'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting || deleting}
            className="rounded-lg border border-border px-4 py-2.5 font-medium text-muted transition-colors hover:bg-surface-elevated disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>

      {isEdit && (
        <div className="border-t border-border pt-4">
          {confirmingDelete ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                Delete this profile? This will also remove all reading progress.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete Profile'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-elevated disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={submitting}
              className="text-sm font-medium text-red-500 transition-colors hover:text-red-400 disabled:opacity-50"
            >
              Delete Profile
            </button>
          )}
        </div>
      )}
    </form>
  );
}
