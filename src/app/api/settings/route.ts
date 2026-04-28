import { NextRequest } from 'next/server';
import { setSetting, getMangaDir } from '@/lib/settings';
import { apiError, apiSuccess, parseJsonBody } from '@/lib/api-response';
import fs from 'fs';

export async function GET() {
  return apiSuccess({
    manga_dir: getMangaDir(),
  });
}

export async function PUT(request: NextRequest) {
  const body = await parseJsonBody<{ manga_dir?: string }>(request);
  if (!body) {
    return apiError('Invalid JSON body', 400);
  }

  if (body.manga_dir !== undefined) {
    const dir = String(body.manga_dir).trim();
    if (!dir) {
      return apiError('manga_dir cannot be empty', 400);
    }
    if (!fs.existsSync(dir)) {
      return apiError('Directory does not exist', 400);
    }
    setSetting('manga_dir', dir);
  }

  return apiSuccess({
    manga_dir: getMangaDir(),
  });
}
