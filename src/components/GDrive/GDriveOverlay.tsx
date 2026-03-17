'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/components/AdminProvider';
import { GDriveDownloadFAB } from './GDriveDownloadFAB';
import { GDriveDownloadModal } from './GDriveDownloadModal';
import { GDriveDownloadIndicator } from './GDriveDownloadIndicator';
import { useGDriveProgress } from './useGDriveProgress';

export function GDriveOverlay() {
  const { isAdmin } = useAdmin();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const { state } = useGDriveProgress(jobId);

  const isDownloading = !!jobId && (state.status === 'downloading' || state.status === 'paused' || state.status === 'listing');

  // Check for active job on mount
  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/gdrive/status')
      .then(res => res.json())
      .then(data => {
        if (data.active && data.job?.id) {
          setJobId(data.job.id);
        }
      })
      .catch(() => {});
  }, [isAdmin]);

  const handleJobStarted = useCallback((newJobId: string) => {
    setJobId(newJobId);
  }, []);

  const handleComplete = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleFabClick = useCallback(() => {
    setModalOpen(true);
  }, []);

  const handleIndicatorClick = useCallback(() => {
    setModalOpen(true);
  }, []);

  if (!isAdmin) return null;

  return (
    <>
      <GDriveDownloadFAB onClick={handleFabClick} isDownloading={isDownloading} />

      {!modalOpen && isDownloading && (
        <GDriveDownloadIndicator state={state} onClick={handleIndicatorClick} />
      )}

      <GDriveDownloadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onJobStarted={handleJobStarted}
        onComplete={handleComplete}
        jobId={jobId}
      />
    </>
  );
}
