import { NextRequest, NextResponse } from 'next/server';
import { downloadManager } from '@/lib/gdrive/download-manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, seriesName } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Google Drive URL is required' }, { status: 400 });
    }
    if (!seriesName || typeof seriesName !== 'string') {
      return NextResponse.json({ error: 'Series name is required' }, { status: 400 });
    }

    const active = downloadManager.getActiveJob();
    if (active) {
      return NextResponse.json(
        { error: 'A download is already in progress', activeJobId: active.id },
        { status: 409 }
      );
    }

    const { jobId, files } = await downloadManager.startJob(url, seriesName.trim());

    return NextResponse.json({
      jobId,
      files: files.map(f => ({ name: f.name, size: f.size, status: f.status })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('not configured') ? 500
      : message.includes('Invalid') || message.includes('No PDF') ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
