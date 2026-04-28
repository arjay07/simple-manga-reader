'use client';

import { useEffect, useState, useCallback } from 'react';

type Setter<T> = T | ((prev: T) => T);

/**
 * SSR-safe two-way sync with localStorage.
 *
 * Stores values as raw strings — pass serialize/parse for non-string types.
 * Returns the third boolean as `mounted` so callers can defer side effects
 * until the localStorage read has happened.
 */
export function useLocalStorage<T extends string>(
  key: string,
  initial: T,
): [T, (value: Setter<T>) => void, boolean];
export function useLocalStorage<T>(
  key: string,
  initial: T,
  options: {
    serialize: (v: T) => string;
    parse: (raw: string) => T;
  },
): [T, (value: Setter<T>) => void, boolean];
export function useLocalStorage<T>(
  key: string,
  initial: T,
  options?: {
    serialize: (v: T) => string;
    parse: (raw: string) => T;
  },
): [T, (value: Setter<T>) => void, boolean] {
  const serialize = options?.serialize ?? ((v: T) => v as unknown as string);
  const parse = options?.parse ?? ((raw: string) => raw as unknown as T);

  const [value, setValue] = useState<T>(initial);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) {
        setValue(parse(stored));
      }
    } catch {
      // ignore
    }
    setMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(key, serialize(value));
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value, mounted]);

  const update = useCallback((next: Setter<T>) => {
    setValue((prev) => (typeof next === 'function' ? (next as (p: T) => T)(prev) : next));
  }, []);

  return [value, update, mounted];
}
