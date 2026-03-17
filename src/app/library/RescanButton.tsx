'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RescanButton() {
  const [scanning, setScanning] = useState(false);
  const router = useRouter();

  async function handleRescan() {
    setScanning(true);
    try {
      const res = await fetch('/api/manga/scan', { method: 'POST' });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setScanning(false);
    }
  }

  return (
    <button
      onClick={handleRescan}
      disabled={scanning}
      className="rounded-lg px-3 py-2 text-sm font-medium transition-colors bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
    >
      {scanning ? 'Scanning...' : 'Rescan'}
    </button>
  );
}
