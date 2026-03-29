import { NextResponse } from 'next/server';
import { jobManager } from '@/lib/panel-detect/job-manager';

export async function GET() {
  return NextResponse.json(jobManager.getState());
}
