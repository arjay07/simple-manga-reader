import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchSeriesCoverUrl, fetchVolumeCoverUrl } from '@/lib/mangadex-covers';

const MANGADEX_ID = '11111111-2222-3333-4444-555555555555';

interface CoverEntry {
  id: string;
  type: string;
  attributes: { fileName: string; volume: string | null; locale: string | null };
}

function makeCover(fileName: string, locale: string | null, volume: string | null = null): CoverEntry {
  return { id: `cov-${fileName}`, type: 'cover_art', attributes: { fileName, volume, locale } };
}

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  const ok = init.ok ?? true;
  const status = init.status ?? (ok ? 200 : 500);
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('mangadex-covers', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('fetchSeriesCoverUrl', () => {
    it('returns the .512.jpg URL built from the first entry fileName', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: [makeCover('first-cover.jpg', 'en')] }));

      const url = await fetchSeriesCoverUrl(MANGADEX_ID);

      expect(url).toBe(
        `https://uploads.mangadex.org/covers/${MANGADEX_ID}/first-cover.jpg.512.jpg`,
      );
      // Validate request URL contains expected query params
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain('https://api.mangadex.org/cover');
      expect(calledUrl).toContain(`manga%5B%5D=${MANGADEX_ID}`);
      expect(calledUrl).toContain('order%5Bvolume%5D=asc');
      expect(calledUrl).toContain('limit=1');
    });

    it('returns null when the response data array is empty', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));

      const url = await fetchSeriesCoverUrl(MANGADEX_ID);

      expect(url).toBeNull();
    });

    it('throws an error matching mangadex.ts style on a non-OK response', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 503 }));

      await expect(fetchSeriesCoverUrl(MANGADEX_ID)).rejects.toThrow('MangaDex API error: 503');
    });
  });

  describe('fetchVolumeCoverUrl', () => {
    it('picks the en locale entry when both en and ja are present', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          data: [
            makeCover('jp-cover.jpg', 'ja', '1'),
            makeCover('en-cover.jpg', 'en', '1'),
          ],
        }),
      );

      const url = await fetchVolumeCoverUrl(MANGADEX_ID, 1);

      expect(url).toBe(`https://uploads.mangadex.org/covers/${MANGADEX_ID}/en-cover.jpg.512.jpg`);

      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain(`manga%5B%5D=${MANGADEX_ID}`);
      expect(calledUrl).toContain('volume%5B%5D=1');
      expect(calledUrl).toContain('limit=10');
    });

    it('falls back to ja when en is absent', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          data: [
            makeCover('fr-cover.jpg', 'fr', '2'),
            makeCover('jp-cover.jpg', 'ja', '2'),
          ],
        }),
      );

      const url = await fetchVolumeCoverUrl(MANGADEX_ID, 2);

      expect(url).toBe(`https://uploads.mangadex.org/covers/${MANGADEX_ID}/jp-cover.jpg.512.jpg`);
    });

    it('returns the first entry of any locale when neither en nor ja is present', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          data: [
            makeCover('first-other.jpg', 'fr', '3'),
            makeCover('second-other.jpg', 'de', '3'),
          ],
        }),
      );

      const url = await fetchVolumeCoverUrl(MANGADEX_ID, 3);

      expect(url).toBe(
        `https://uploads.mangadex.org/covers/${MANGADEX_ID}/first-other.jpg.512.jpg`,
      );
    });

    it('returns null on empty data array', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));

      const url = await fetchVolumeCoverUrl(MANGADEX_ID, 4);

      expect(url).toBeNull();
    });

    it('uses the volume number in the query', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: [makeCover('x.jpg', 'en', '7')] }));

      await fetchVolumeCoverUrl(MANGADEX_ID, 7);

      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain('volume%5B%5D=7');
    });
  });
});
