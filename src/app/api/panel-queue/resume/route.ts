import { NextResponse } from 'next/server';
import { queueProcessor } from '@/lib/panel-detect/queue-processor';

export async function POST() {
  try {
    const state = queueProcessor.resume();
    return NextResponse.json(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
