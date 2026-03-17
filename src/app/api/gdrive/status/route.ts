import { NextResponse } from 'next/server';
import { downloadManager } from '@/lib/gdrive/download-manager';

export const dynamic = 'force-dynamic';

export async function GET() {
  const job = downloadManager.getActiveJob();

  if (!job) {
    return NextResponse.json({ active: false });
  }

  return NextResponse.json({
    active: true,
    job: downloadManager.getJobSnapshot(job),
  });
}
