import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { searchManga } from '@/lib/mangadex';

interface Relationship {
  id: string;
  type: string;
  attributes?: { name?: string };
}

interface MangaStub {
  id: string;
  attributes: { title: Record<string, string>; description: Record<string, string> };
  relationships: Relationship[];
}

function makeManga(overrides: Partial<MangaStub> = {}): MangaStub {
  return {
    id: 'manga-1',
    attributes: {
      title: { en: 'English Title', ja: '日本語タイトル' },
      description: { en: 'A description' },
    },
    relationships: [],
    ...overrides,
  };
}

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  const ok = init.ok ?? true;
  const status = init.status ?? (ok ? 200 : 500);
  return { ok, status, json: async () => body } as unknown as Response;
}

describe('searchManga', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('selects the English title and falls back to first available', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          makeManga({ id: 'm-en', attributes: { title: { en: 'Eng', ja: 'JA' }, description: {} } }),
          makeManga({ id: 'm-ja', attributes: { title: { ja: 'OnlyJa' }, description: {} } }),
        ],
      }),
    );

    const results = await searchManga('query');

    expect(results[0].title).toBe('Eng');
    expect(results[1].title).toBe('OnlyJa');
  });

  it('de-duplicates a person listed as both author and artist', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          makeManga({
            relationships: [
              { id: 'p1', type: 'author', attributes: { name: 'Akira' } },
              { id: 'p1', type: 'artist', attributes: { name: 'Akira' } },
            ],
          }),
        ],
      }),
    );

    const results = await searchManga('query');

    expect(results[0].author).toBe('Akira');
  });

  it('joins distinct author and artist names', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          makeManga({
            relationships: [
              { id: 'p1', type: 'author', attributes: { name: 'Writer' } },
              { id: 'p2', type: 'artist', attributes: { name: 'Drawer' } },
            ],
          }),
        ],
      }),
    );

    const results = await searchManga('query');

    expect(results[0].author).toBe('Writer, Drawer');
  });

  it('ignores author/artist relationships without a name', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          makeManga({
            relationships: [
              { id: 'p1', type: 'author', attributes: {} },
              { id: 'p2', type: 'artist', attributes: { name: 'Named' } },
              { id: 'cover', type: 'cover_art', attributes: { name: 'ignored' } },
            ],
          }),
        ],
      }),
    );

    const results = await searchManga('query');

    expect(results[0].author).toBe('Named');
  });

  it('requests relevance ordering so the ranking fix cannot regress', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));

    await searchManga('query');

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('order%5Brelevance%5D=desc');
  });

  it('throws on a non-OK response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 503 }));

    await expect(searchManga('query')).rejects.toThrow('MangaDex API error: 503');
  });
});
