import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CoverMenu } from '@/components/Library/CoverMenu';

const SERIES_ID = 7;
const VOLUME_ID = 42;
const MANGADEX_ID = 'abc-123';

let fetchMock: ReturnType<typeof vi.fn>;

function okResponse(): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true }),
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(okResponse());
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

function openMenu() {
  fireEvent.click(screen.getByLabelText('Cover options'));
}

describe('CoverMenu', () => {
  describe('rendering', () => {
    it('renders all four menu items when admin clicks the 3-dot trigger', () => {
      render(
        <CoverMenu
          target="series"
          seriesId={SERIES_ID}
          mangadexId={MANGADEX_ID}
          onUpdated={() => {}}
        />,
      );

      openMenu();

      expect(screen.getByText('Upload Cover')).toBeTruthy();
      expect(screen.getByText('Set from URL')).toBeTruthy();
      expect(screen.getByText('Auto-generate')).toBeTruthy();
      expect(screen.getByText('Auto-generate from web')).toBeTruthy();
    });

    it('disables "Auto-generate from web" with the expected tooltip when mangadexId is null', () => {
      render(
        <CoverMenu target="series" seriesId={SERIES_ID} mangadexId={null} onUpdated={() => {}} />,
      );

      openMenu();

      const webBtn = screen.getByText('Auto-generate from web').closest('button');
      expect(webBtn).not.toBeNull();
      expect(webBtn!.hasAttribute('disabled')).toBe(true);
      expect(webBtn!.getAttribute('title')).toBe(
        'Link this series to MangaDex via Fetch Metadata first.',
      );
    });

    it('enables "Auto-generate from web" when mangadexId is provided', () => {
      render(
        <CoverMenu
          target="series"
          seriesId={SERIES_ID}
          mangadexId={MANGADEX_ID}
          onUpdated={() => {}}
        />,
      );

      openMenu();

      const webBtn = screen.getByText('Auto-generate from web').closest('button')!;
      expect(webBtn.hasAttribute('disabled')).toBe(false);
    });
  });

  describe('series target — fetch URLs', () => {
    it('Auto-generate POSTs to /api/manga/<id>/cover/generate', async () => {
      render(
        <CoverMenu
          target="series"
          seriesId={SERIES_ID}
          mangadexId={MANGADEX_ID}
          onUpdated={() => {}}
        />,
      );
      openMenu();

      fireEvent.click(screen.getByText('Auto-generate'));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`/api/manga/${SERIES_ID}/cover/generate`);
      expect(init.method).toBe('POST');
    });

    it('Auto-generate from web POSTs to /api/manga/<id>/cover/generate-web', async () => {
      render(
        <CoverMenu
          target="series"
          seriesId={SERIES_ID}
          mangadexId={MANGADEX_ID}
          onUpdated={() => {}}
        />,
      );
      openMenu();

      fireEvent.click(screen.getByText('Auto-generate from web'));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`/api/manga/${SERIES_ID}/cover/generate-web`);
      expect(init.method).toBe('POST');
    });

    it('does not fire fetch when "Auto-generate from web" is disabled (mangadexId null)', () => {
      render(
        <CoverMenu target="series" seriesId={SERIES_ID} mangadexId={null} onUpdated={() => {}} />,
      );
      openMenu();

      fireEvent.click(screen.getByText('Auto-generate from web'));

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('volume target — fetch URLs', () => {
    it('Auto-generate POSTs to /api/manga/<sid>/<vid>/cover/generate', async () => {
      render(
        <CoverMenu
          target="volume"
          seriesId={SERIES_ID}
          volumeId={VOLUME_ID}
          mangadexId={MANGADEX_ID}
          onUpdated={() => {}}
        />,
      );
      openMenu();

      fireEvent.click(screen.getByText('Auto-generate'));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`/api/manga/${SERIES_ID}/${VOLUME_ID}/cover/generate`);
      expect(init.method).toBe('POST');
    });

    it('Auto-generate from web POSTs to /api/manga/<sid>/<vid>/cover/generate-web', async () => {
      render(
        <CoverMenu
          target="volume"
          seriesId={SERIES_ID}
          volumeId={VOLUME_ID}
          mangadexId={MANGADEX_ID}
          onUpdated={() => {}}
        />,
      );
      openMenu();

      fireEvent.click(screen.getByText('Auto-generate from web'));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`/api/manga/${SERIES_ID}/${VOLUME_ID}/cover/generate-web`);
      expect(init.method).toBe('POST');
    });
  });
});
