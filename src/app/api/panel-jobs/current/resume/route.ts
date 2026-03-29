import { NextResponse } from 'next/server';
import { jobManager } from '@/lib/panel-detect/job-manager';

export async function POST() {
  try {
    jobManager.resume();
    return NextResponse.json(jobManager.getState());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
