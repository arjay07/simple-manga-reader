import { NextRequest, NextResponse } from 'next/server';
import { jobManager } from '@/lib/panel-detect/job-manager';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { volumeId, confidenceThreshold = 0.25, force = false } = body;

    if (!volumeId) {
      return NextResponse.json({ error: 'volumeId is required' }, { status: 400 });
    }

    await jobManager.start(Number(volumeId), confidenceThreshold, force);
    return NextResponse.json(jobManager.getState(), { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('already active') ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
