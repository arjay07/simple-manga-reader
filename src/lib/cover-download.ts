export const MAX_URL_DOWNLOAD_SIZE = 10 * 1024 * 1024;

export type DownloadResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; error: string; status: number };

export async function downloadImageFromUrl(url: string): Promise<DownloadResult> {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { ok: false, error: 'Only http and https URLs are allowed', status: 400 };
  }

  const response = await fetch(url);
  if (!response.ok) {
    return { ok: false, error: `Failed to download image: ${response.status}`, status: 400 };
  }

  const remoteContentType = response.headers.get('content-type') ?? '';
  if (!remoteContentType.startsWith('image/')) {
    return { ok: false, error: 'URL does not point to an image', status: 400 };
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > MAX_URL_DOWNLOAD_SIZE) {
    return { ok: false, error: 'Image exceeds 10MB size limit', status: 400 };
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_URL_DOWNLOAD_SIZE) {
    return { ok: false, error: 'Image exceeds 10MB size limit', status: 400 };
  }

  return { ok: true, buffer: Buffer.from(arrayBuffer) };
}
