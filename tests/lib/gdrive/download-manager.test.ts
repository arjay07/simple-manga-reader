import { describe, it, expect, beforeEach, vi } from 'vitest';

const existsSyncMock = vi.fn<(p: string) => boolean>();
const readFileSyncMock = vi.fn<(p: string) => string>();

vi.mock('fs', () => {
  const api = {
    existsSync: (p: string) => existsSyncMock(p),
    readFileSync: (p: string) => readFileSyncMock(p),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
  return { default: api, ...api };
});

// Import AFTER the fs mock so the module's fs reference is the mock.
import { loadManifest } from '@/lib/gdrive/download-manager';

const MANIFEST = '/manga/Series/.download_manifest.json';

describe('loadManifest', () => {
  beforeEach(() => {
    existsSyncMock.mockReset();
    readFileSyncMock.mockReset();
  });

  it('returns an empty default when the manifest file does not exist', () => {
    existsSyncMock.mockReturnValue(false);

    expect(loadManifest(MANIFEST)).toEqual({});
    expect(readFileSyncMock).not.toHaveBeenCalled();
  });

  it('parses a valid manifest', () => {
    existsSyncMock.mockReturnValue(true);
    readFileSyncMock.mockReturnValue(JSON.stringify({ 'a.cbz': { md5: 'abc' } }));

    expect(loadManifest(MANIFEST)).toEqual({ 'a.cbz': { md5: 'abc' } });
  });

  it('returns an empty default when the manifest is corrupt JSON instead of throwing', () => {
    existsSyncMock.mockReturnValue(true);
    readFileSyncMock.mockReturnValue('{ this is not: valid json');

    expect(() => loadManifest(MANIFEST)).not.toThrow();
    expect(loadManifest(MANIFEST)).toEqual({});
  });
});
