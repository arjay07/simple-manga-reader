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
}

const EMOJI_OPTIONS = ['😊', '📚', '🐉', '⚡', '🌟', '🎮', '🦊', '🌙', '🔥', '🌊', '👾', '🍜'];

interface ProfileFormProps {
  onCreated: (profile: Profile) => void;
  onCancel?: () => void;
}

export default function ProfileForm({ onCreated, onCancel }: ProfileFormProps) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      const res = await fetch(apiUrl('/api/profiles'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, avatar }),
      });

      if (!res.ok) {
        throw new Error('Failed to create profile');
      }

      const profile: Profile = await res.json();
      onCreated(profile);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md rounded-xl bg-surface p-6 space-y-6"
    >
      <h2 className="text-xl font-semibold text-foreground">Create Profile</h2>

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
        {error && <p className="text-sm text-red-500">{error}</p>}
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

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create Profile'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2.5 font-medium text-muted transition-colors hover:bg-surface-elevated"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
