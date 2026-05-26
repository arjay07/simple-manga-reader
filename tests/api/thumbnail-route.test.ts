import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// All mocks must be declared before importing the route.
const overrideBytes = Buffer.from('OVERRIDE-BYTES');
const page1Bytes = Buffer.from('PAGE1-BYTES');
const generatedBytes = Buffer.from('GENERATED-BYTES');

const existsSyncMock = vi.fn<(p: string) => boolean>();
const readFileSyncMock = vi.fn<(p: string) => Buffer>();
const mkdirSyncMock = vi.fn();

vi.mock('fs', () => ({
  default: {
    existsSync: (p: string) => existsSyncMock(p),
    readFileSync: (p: string) => readFileSyncMock(p),
    mkdirSync: (...args: unknown[]) => mkdirSyncMock(...args),
  },
  existsSync: (p: string) => existsSyncMock(p),
  readFileSync: (p: string) => readFileSyncMock(p),
  mkdirSync: (...args: unknown[]) => mkdirSyncMock(...args),
}));

const dbGetMock = vi.fn();
vi.mock('@/lib/db', () => ({
  getDb: () => ({
    prepare: () => ({
      get: (...args: unknown[]) => dbGetMock(...args),
    }),
  }),
}));

vi.mock('@/lib/settings', () => ({
  getMangaDir: () => '/test/manga',
}));

const extractPageMock = vi.fn();
const closeMock = vi.fn();
const openPageSourceMock = vi.fn(() => ({
  countPages: vi.fn(),
  extractPage: extractPageMock,
  close: closeMock,
}));
vi.mock('@/lib/page-source', () => ({
  openPageSource: (...args: unknown[]) => openPageSourceMock(...args),
}));

// sharp returns a chainable object whose terminal `.toFile()` writes generatedBytes.
const sharpToFileMock = vi.fn(async (cachedPath: string) => {
  // Simulate the file appearing on disk for the subsequent readFileSync.
  cachedPaths.add(cachedPath);
});
const sharpMock = vi.fn(() => ({
  resize: () => ({
    jpeg: () => ({
      toFile: (p: string) => sharpToFileMock(p),
    }),
  }),
}));
const cachedPaths = new Set<string>();
vi.mock('sharp', () => ({
  default: (...args: unknown[]) => sharpMock(...args),
}));

// Import AFTER mocks.
import { GET } from '@/app/api/manga/[seriesId]/[volumeId]/thumbnail/route';

const VOLUME_ROW = {
  id: 42,
  series_id: 7,
  filename: 'Vol01.pdf',
  folder_name: 'My Series',
  format: 'pdf' as const,
};

function makeRequest(): Request {
  // Route doesn't use the request beyond passing it to NextResponse, so a minimal stub is fine.
  return new Request('http://localhost/api/manga/7/42/thumbnail');
}

function makeParams() {
  return Promise.resolve({ seriesId: '7', volumeId: '42' });
}

describe('GET /api/manga/[seriesId]/[volumeId]/thumbnail — resolution order', () => {
  beforeEach(() => {
    existsSyncMock.mockReset();
    readFileSyncMock.mockReset();
    mkdirSyncMock.mockReset();
    dbGetMock.mockReset();
    extractPageMock.mockReset();
    closeMock.mockReset();
    openPageSourceMock.mockClear();
    sharpMock.mockClear();
    sharpToFileMock.mockClear();
    cachedPaths.clear();

    dbGetMock.mockReturnValue(VOLUME_ROW);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('serves the override file with no-store cache when present', async () => {
    existsSyncMock.mockImplementation((p: string) => p.endsWith('.cover.jpg'));
    readFileSyncMock.mockImplementation((p: string) => {
      if (p.endsWith('.cover.jpg')) return overrideBytes;
      throw new Error(`Unexpected read: ${p}`);
    });

    // @ts-expect-error -- minimal NextRequest shim
    const res = await GET(makeRequest(), { params: makeParams() });

    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.equals(overrideBytes)).toBe(true);
    expect(openPageSourceMock).not.toHaveBeenCalled();
  });

  it('serves the page-1 cache with public cache when override is absent but cache exists', async () => {
    existsSyncMock.mockImplementation((p: string) => {
      if (p.endsWith('.cover.jpg')) return false;
      // The page-1 thumb path ends in `_pdf.jpg` (sanitized) — match any non-cover .jpg in .covers/
      return p.includes('.covers') && p.endsWith('.jpg');
    });
    readFileSyncMock.mockImplementation((p: string) => {
      if (p.endsWith('.jpg')) return page1Bytes;
      throw new Error(`Unexpected read: ${p}`);
    });

    // @ts-expect-error -- minimal NextRequest shim
    const res = await GET(makeRequest(), { params: makeParams() });

    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.equals(page1Bytes)).toBe(true);
    expect(openPageSourceMock).not.toHaveBeenCalled();
  });

  it('generates page-1 via openPageSource when both caches absent and volume file exists', async () => {
    // Override missing, page-1 thumb missing initially, but the underlying volume file IS present.
    // After sharp.toFile completes, readFileSync should pull bytes from the cache path.
    existsSyncMock.mockImplementation((p: string) => {
      if (p.endsWith('.cover.jpg')) return false;
      // The page-1 thumb does not exist on first probe, but the volume file does.
      // After sharp generates it, it appears in cachedPaths.
      if (p.endsWith('.jpg')) return cachedPaths.has(p);
      // Volume file path (no .jpg/.cover.jpg suffix).
      return true;
    });
    readFileSyncMock.mockImplementation((p: string) => {
      if (p.endsWith('.jpg')) return generatedBytes;
      throw new Error(`Unexpected read: ${p}`);
    });
    extractPageMock.mockResolvedValue(Buffer.from('RAW-PAGE-PIXELS'));
    closeMock.mockResolvedValue(undefined);

    // @ts-expect-error -- minimal NextRequest shim
    const res = await GET(makeRequest(), { params: makeParams() });

    expect(openPageSourceMock).toHaveBeenCalledTimes(1);
    expect(extractPageMock).toHaveBeenCalledWith(1, { dpi: 150 });
    expect(sharpMock).toHaveBeenCalledTimes(1);
    expect(sharpToFileMock).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);

    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.equals(generatedBytes)).toBe(true);
  });

  it('returns 404 when the volume row is not found in the DB', async () => {
    dbGetMock.mockReturnValue(undefined);

    // @ts-expect-error -- minimal NextRequest shim
    const res = await GET(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(404);
  });
});
