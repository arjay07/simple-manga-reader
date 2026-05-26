interface MangaDexCoverAttributes {
  fileName: string;
  volume: string | null;
  locale: string | null;
}

interface MangaDexCoverData {
  id: string;
  type: string;
  attributes: MangaDexCoverAttributes;
}

function coverUrl(mangadexId: string, fileName: string): string {
  return `https://uploads.mangadex.org/covers/${mangadexId}/${fileName}.512.jpg`;
}

export async function fetchSeriesCoverUrl(mangadexId: string): Promise<string | null> {
  const params = new URLSearchParams({
    'manga[]': mangadexId,
    'order[volume]': 'asc',
    limit: '1',
  });

  const res = await fetch(`https://api.mangadex.org/cover?${params}`, {
    headers: { 'User-Agent': 'simple-manga-reader/1.0' },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`MangaDex API error: ${res.status}`);
  }

  const data = (await res.json()) as { data: MangaDexCoverData[] };
  const first = data.data[0];
  if (!first) return null;

  return coverUrl(mangadexId, first.attributes.fileName);
}

export async function fetchVolumeCoverUrl(
  mangadexId: string,
  volumeNumber: number,
): Promise<string | null> {
  const params = new URLSearchParams({
    'manga[]': mangadexId,
    'volume[]': String(volumeNumber),
    limit: '10',
  });

  const res = await fetch(`https://api.mangadex.org/cover?${params}`, {
    headers: { 'User-Agent': 'simple-manga-reader/1.0' },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`MangaDex API error: ${res.status}`);
  }

  const data = (await res.json()) as { data: MangaDexCoverData[] };
  if (data.data.length === 0) return null;

  // Prefer the English cover, then Japanese, else fall back to whatever the API returned first.
  const pick =
    data.data.find((c) => c.attributes.locale === 'en') ??
    data.data.find((c) => c.attributes.locale === 'ja') ??
    data.data[0];

  return coverUrl(mangadexId, pick.attributes.fileName);
}
