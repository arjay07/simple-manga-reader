'use client';

import { useAdmin } from '@/components/AdminProvider';

interface GDriveDownloadFABProps {
  onClick: () => void;
  isDownloading: boolean;
}

export function GDriveDownloadFAB({ onClick, isDownloading }: GDriveDownloadFABProps) {
  const { isAdmin } = useAdmin();

  if (!isAdmin) return null;

  return (
    <button
      onClick={onClick}
      className={`fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:scale-110 ${
        isDownloading
          ? 'bg-accent animate-pulse'
          : 'bg-accent hover:bg-accent-hover'
      }`}
      aria-label={isDownloading ? 'View download progress' : 'Add series from Google Drive'}
    >
      {isDownloading ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )}
    </button>
  );
}
