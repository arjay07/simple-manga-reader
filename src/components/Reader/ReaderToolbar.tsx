'use client';

import { useRouter } from 'next/navigation';

interface ReaderToolbarProps {
  visible: boolean;
  seriesId: string;
  title: string;
  onSettingsOpen: () => void;
}

export default function ReaderToolbar({ visible, seriesId, title, onSettingsOpen }: ReaderToolbarProps) {
  const router = useRouter();

  return (
    <div
      className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm text-white transition-transform duration-300 ease-in-out ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => router.push(`/library/${seriesId}`)}
        className="flex items-center gap-1 text-sm hover:text-white/80 transition-colors cursor-pointer"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back
      </button>

      <span className="text-sm font-medium truncate max-w-[60%] text-center">{title}</span>

      <button
        onClick={onSettingsOpen}
        className="p-1 hover:text-white/80 transition-colors cursor-pointer"
        title="Reader settings"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  );
}
