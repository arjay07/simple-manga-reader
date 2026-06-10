/**
 * Real-page regression guard for `assignReadingOrder`.
 *
 * Runs the production reading-order algorithm over frozen real-page panel
 * layouts and asserts the human-confirmed RTL order. Known-good pages use a
 * normal assertion (guarding against regressions); the known-bug page uses
 * `it.fails` — it documents the current failure AND, when a future fix makes it
 * pass, vitest turns that into an error so we remember to promote it to `it()`.
 */

import { describe, it, expect } from 'vitest';
import { assignReadingOrder } from '@/lib/panel-detect/reading-order';
import { READING_ORDER_FIXTURES } from './reading-order-fixtures';

function orderedIds(panels: ReturnType<typeof assignReadingOrder>): string[] {
  return [...panels].sort((a, b) => a.readingOrder - b.readingOrder).map((p) => p.id);
}

describe('assignReadingOrder — real-page regression', () => {
  for (const fx of READING_ORDER_FIXTURES) {
    const assertCorrect = () => {
      const panels = assignReadingOrder(fx.panels);
      expect(orderedIds(panels)).toEqual(fx.expectedOrder);
    };

    if (fx.knownFailing) {
      // Expected to fail today; flip to it() once a fix lands (vitest will nag).
      it.fails(`KNOWN BUG → ${fx.name}`, assertCorrect);
    } else {
      it(fx.name, assertCorrect);
    }
  }
});
