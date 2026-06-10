import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { assignReadingOrder } from '@/lib/panel-detect/reading-order';
import type { RawPanel } from '@/lib/panel-detect/types';

interface Fixture {
  note: string;
  input: RawPanel[];
  expected: string[];
}

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

function loadFixtures(): Array<{ name: string; fixture: Fixture }> {
  return fs
    .readdirSync(fixturesDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({
      name: f.replace(/\.json$/, ''),
      fixture: JSON.parse(fs.readFileSync(path.join(fixturesDir, f), 'utf-8')) as Fixture,
    }));
}

const fixtures = loadFixtures();

describe('assignReadingOrder — labelled fixtures', () => {
  for (const { name, fixture } of fixtures) {
    it(`${name}: ${fixture.note}`, () => {
      const panels = assignReadingOrder(fixture.input);
      const order = [...panels].sort((a, b) => a.readingOrder - b.readingOrder).map((p) => p.id);
      expect(order).toEqual(fixture.expected);
    });
  }
});

describe('assignReadingOrder — golden snapshot', () => {
  // Captures today's exact output (ordered panels) for every fixture.
  // The snapshot flags *change*, not *correctness*: any algorithm change must
  // re-record deliberately with a stated justification.
  for (const { name, fixture } of fixtures) {
    it(`${name} output is stable`, () => {
      const result = assignReadingOrder(fixture.input);
      expect(result).toMatchSnapshot();
    });
  }
});

// Small seeded PRNG (mulberry32) so the property-based layouts are deterministic
// and reproducible across runs.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomLayout(rng: () => number): RawPanel[] {
  const count = 1 + Math.floor(rng() * 8); // 1..8 panels
  const panels: RawPanel[] = [];
  for (let i = 0; i < count; i++) {
    const x = rng() * 0.8;
    const y = rng() * 0.8;
    panels.push({
      x,
      y,
      width: 0.1 + rng() * (1 - x - 0.1) * 0.9,
      height: 0.1 + rng() * (1 - y - 0.1) * 0.9,
      confidence: 0.25 + rng() * 0.74,
    });
  }
  return panels;
}

// Large boxes confined to start in the top-left region so they mutually
// overlap: most of these layouts defeat the cut search on both axes and
// exercise the inseparable fallback, which the generator above rarely hits.
function overlappingLayout(rng: () => number): RawPanel[] {
  const count = 2 + Math.floor(rng() * 5); // 2..6 panels
  const panels: RawPanel[] = [];
  for (let i = 0; i < count; i++) {
    const x = rng() * 0.4;
    const y = rng() * 0.4;
    panels.push({
      x,
      y,
      width: 0.4 + rng() * (1 - x - 0.4),
      height: 0.4 + rng() * (1 - y - 0.4),
      confidence: 0.25 + rng() * 0.74,
    });
  }
  return panels;
}

describe('assignReadingOrder — structural invariants', () => {
  const rng = mulberry32(0x5eed);
  const layouts = Array.from({ length: 200 }, () => randomLayout(rng));

  it('output length equals input length for every layout', () => {
    for (const layout of layouts) {
      const panels = assignReadingOrder(layout);
      expect(panels.length).toBe(layout.length);
    }
  });

  it('every input id appears exactly once', () => {
    for (const layout of layouts) {
      const panels = assignReadingOrder(layout);
      const ids = panels.map((p) => p.id).sort();
      const expectedIds = layout.map((_, i) => `p${i + 1}`).sort();
      expect(ids).toEqual(expectedIds);
    }
  });

  it('readingOrder is a contiguous 1..N permutation', () => {
    for (const layout of layouts) {
      const panels = assignReadingOrder(layout);
      const orders = panels.map((p) => p.readingOrder).sort((a, b) => a - b);
      expect(orders).toEqual(Array.from({ length: layout.length }, (_, i) => i + 1));
    }
  });
});

describe('assignReadingOrder — permutation invariance', () => {
  // Ids are assigned by input index, so they legitimately differ across
  // permutations; the invariant is the *geometric* reading sequence.
  const geoKey = (p: RawPanel): string => `${p.x},${p.y},${p.width},${p.height}`;
  const geoSequence = (layout: RawPanel[]): string[] => assignReadingOrder(layout).map(geoKey);

  function permutations(layout: RawPanel[], rng: () => number): RawPanel[][] {
    const reversed = [...layout].reverse();
    const k = 1 + Math.floor(rng() * Math.max(1, layout.length - 1));
    const rotated = [...layout.slice(k), ...layout.slice(0, k)];
    const shuffled = [...layout];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return [reversed, rotated, shuffled];
  }

  it('geometric reading sequence is identical across input permutations', () => {
    const rng = mulberry32(0xfeed);
    const layouts = [
      ...Array.from({ length: 100 }, () => randomLayout(rng)),
      ...Array.from({ length: 100 }, () => overlappingLayout(rng)),
    ];
    for (const layout of layouts) {
      const baseline = geoSequence(layout);
      for (const perm of permutations(layout, rng)) {
        expect(geoSequence(perm)).toEqual(baseline);
      }
    }
  });
});
