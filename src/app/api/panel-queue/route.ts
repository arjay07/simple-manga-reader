import { NextRequest, NextResponse } from 'next/server';
import { queueProcessor } from '@/lib/panel-detect/queue-processor';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { seriesId, volumeIds, confidenceThreshold = 0.25, force = false } = body;

    if (!seriesId) {
      return NextResponse.json({ error: 'seriesId is required' }, { status: 400 });
    }

    if (!Array.isArray(volumeIds) || volumeIds.length === 0) {
      return NextResponse.json({ error: 'volumeIds must be a non-empty array' }, { status: 400 });
    }

    const state = await queueProcessor.create(
      Number(seriesId),
      volumeIds.map(Number),
      confidenceThreshold,
      force
    );

    return NextResponse.json(state, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('already active') ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
