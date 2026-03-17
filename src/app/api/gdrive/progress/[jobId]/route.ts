import { NextRequest } from 'next/server';
import { downloadManager } from '@/lib/gdrive/download-manager';
import type { DownloadEvent } from '@/lib/gdrive/types';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = downloadManager.getJob(jobId);

  if (!job) {
    return new Response(JSON.stringify({ error: 'Job not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send current state snapshot
      const snapshot = downloadManager.getJobSnapshot(job);
      controller.enqueue(encoder.encode(`event: state\ndata: ${JSON.stringify(snapshot)}\n\n`));

      // Listen for new events
      const listener = (event: DownloadEvent) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));

          // Close stream on terminal events
          if (event.type === 'done' || event.type === 'cancelled' || event.type === 'error') {
            setTimeout(() => {
              try {
                controller.close();
              } catch {
                // already closed
              }
            }, 100);
          }
        } catch {
          // Controller closed, clean up
          downloadManager.removeListener(jobId, listener);
        }
      };

      downloadManager.addListener(jobId, listener);

      // Clean up on cancel/close
      _request.signal.addEventListener('abort', () => {
        downloadManager.removeListener(jobId, listener);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
