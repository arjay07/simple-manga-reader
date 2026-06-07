import type { SeriesKind } from '@/types';

/**
 * Kind-aware labels for a reading unit (a "volume" row, which models either a
 * volume or a chapter depending on its series' kind).
 *
 * The `'volume'` branch reproduces the exact wording used before chapter support
 * existed — "Vol. N", "Volume", and a bare "#" placeholder — so every existing
 * series renders byte-identically. "Ch." wording only appears for chapter series.
 */

/** The unit noun for a kind, capitalised: "Volume" / "Chapter". */
export function unitNoun(kind: SeriesKind): string {
  return kind === 'chapter' ? 'Chapter' : 'Volume';
}

/** Abbreviated unit noun: "Vol." / "Ch." */
export function unitAbbrev(kind: SeriesKind): string {
  return kind === 'chapter' ? 'Ch.' : 'Vol.';
}

/**
 * Long label for a unit, e.g. "Vol. 3" or "Ch. 10.5". When the number is null
 * (unparseable), falls back to the bare "#" placeholder used historically.
 */
export function unitLabel(kind: SeriesKind, number: number | null | undefined): string {
  if (number == null) return '#';
  return `${unitAbbrev(kind)} ${number}`;
}

/** "End of Volume" / "End of Chapter" overlay wording. */
export function endOfUnitLabel(kind: SeriesKind): string {
  return `End of ${unitNoun(kind)}`;
}
