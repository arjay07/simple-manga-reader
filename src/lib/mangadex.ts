export interface MangaDexCandidate {
  mangadexId: string;
  title: string;
  description: string;
  author: string;
}

interface MangaDexRelationship {
  id: string;
  type: string;
  attributes?: { name?: string };
}

interface MangaDexManga {
  id: string;
  attributes: {
    title: Record<string, string>;
    description: Record<string, string>;
    relationships?: MangaDexRelationship[];
  };
  relationships: MangaDexRelationship[];
}

function getEnglishOrFirst(record: Record<string, string>): string {
  return record['en'] ?? Object.values(record)[0] ?? '';
}

function getMangaAuthors(relationships: MangaDexRelationship[]): string {
  const authors = relationships
    .filter((r) => r.type === 'author' || r.type === 'artist')
    .map((r) => r.attributes?.name)
    .filter((name): name is string => Boolean(name));

  // Deduplicate (author and artist may be the same person)
  return [...new Set(authors)].join(', ');
}

export async function searchManga(title: string): Promise<MangaDexCandidate[]> {
  const params = new URLSearchParams({
    title,
    limit: '5',
    'includes[]': 'author',
    'availableTranslatedLanguage[]': 'en',
  });

  const res = await fetch(`https://api.mangadex.org/manga?${params}`, {
    headers: { 'User-Agent': 'simple-manga-reader/1.0' },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`MangaDex API error: ${res.status}`);
  }

  const data = (await res.json()) as { data: MangaDexManga[] };

  return data.data.map((manga) => ({
    mangadexId: manga.id,
    title: getEnglishOrFirst(manga.attributes.title),
    description: getEnglishOrFirst(manga.attributes.description),
    author: getMangaAuthors(manga.relationships),
  }));
}
