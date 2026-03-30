import { NextResponse } from 'next/server';
import { queueProcessor } from '@/lib/panel-detect/queue-processor';

export async function GET() {
  return NextResponse.json(queueProcessor.getState());
}
