import type { RawPanel, PageType } from './types';

/**
 * Area (as a fraction of the page) at or above which a lone panel is treated
 * as a full-bleed page rather than a cover. Shared by every detector so the
 * `pageType` written to `panel_data` is independent of detection strategy.
 */
export const FULL_BLEED_AREA_THRESHOLD = 0.9;

/**
 * Classify a page from its detected panels.
 *
 * - no panels → `blank`
 * - one panel → `full-bleed` if it covers most of the page, else `cover`
 * - many panels → `panels`
 */
export function classifyPageType(panels: RawPanel[]): PageType {
  if (panels.length === 0) return 'blank';
  if (panels.length === 1) {
    const area = panels[0].width * panels[0].height;
    return area >= FULL_BLEED_AREA_THRESHOLD ? 'full-bleed' : 'cover';
  }
  return 'panels';
}
