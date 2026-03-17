import { NextRequest, NextResponse } from 'next/server';
import { downloadManager } from '@/lib/gdrive/download-manager';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  try {
    downloadManager.resumeJob(jobId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
