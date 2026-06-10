/**
 * Real-page reading-order regression fixtures.
 *
 * Each fixture freezes the actual ML-detected panel boxes (normalised AABBs) from a real manga page,
 * paired with the correct RTL reading order. Panels are listed in p1..pN order, matching the ids
 * `assignReadingOrder` assigns by input position, so `expectedOrder` references them by id.
 *
 * 'verified: true' = the order is human-confirmed (user, 2026-06-09). All fixtures currently pass;
 * a fixture for a newly found bug should set 'knownFailing: true' until a fix lands.
 *
 * Provenance: real ML-detected panel geometry captured from library pages (not committed).
 */

import type { RawPanel } from '@/lib/panel-detect/types';

export interface ReadingOrderFixture {
  name: string;
  description: string;
  /** True when the expected order is human-confirmed (not just a snapshot of current behaviour). */
  verified: boolean;
  /** Panel AABBs in p1..pN order (index i -> id `p${i+1}`). */
  panels: RawPanel[];
  /** Correct RTL reading order, by panel id. */
  expectedOrder: string[];
  /** True when the CURRENT assignReadingOrder gets this wrong (test uses it.fails). */
  knownFailing?: boolean;
}

const box = (x: number, y: number, width: number, height: number): RawPanel => ({
  x,
  y,
  width,
  height,
  confidence: 1,
});

export const READING_ORDER_FIXTURES: ReadingOrderFixture[] = [
  {
    name: 'verified: 017-bw.png (current algorithm confirmed correct)',
    description:
      'Real ML-detected panels; current assignReadingOrder output confirmed correct by the user (2026-06-09).',
    verified: true,
    panels: [
      box(0.058482, 0.000613, 0.515484, 0.372359), // p1
      box(0.465058, 0.731567, 0.22127, 0.267415), // p2
      box(0.702395, 0.733406, 0.212366, 0.266354), // p3
      box(0.592004, 0, 0.152126, 0.317242), // p4
      box(0.219596, 0.730822, 0.231386, 0.268827), // p5
      box(0.759537, 0, 0.154809, 0.300821), // p6
      box(0.000125, 0.732108, 0.203773, 0.267892), // p7
      box(0.284885, 0.316043, 0.630736, 0.392394), // p8
      box(0.000517, 0.370939, 0.346839, 0.332455), // p9
    ],
    expectedOrder: ['p6', 'p4', 'p1', 'p8', 'p9', 'p3', 'p2', 'p5', 'p7'],
  },
  {
    name: 'verified: 017.png (current algorithm confirmed correct)',
    description:
      'Real ML-detected panels; current assignReadingOrder output confirmed correct by the user (2026-06-09).',
    verified: true,
    panels: [
      box(0.058482, 0.000613, 0.515484, 0.372359), // p1
      box(0.465058, 0.731567, 0.22127, 0.267415), // p2
      box(0.702395, 0.733406, 0.212366, 0.266354), // p3
      box(0.592004, 0, 0.152126, 0.317242), // p4
      box(0.219596, 0.730822, 0.231386, 0.268827), // p5
      box(0.759537, 0, 0.154809, 0.300821), // p6
      box(0.000125, 0.732108, 0.203773, 0.267892), // p7
      box(0.284885, 0.316043, 0.630736, 0.392394), // p8
      box(0.000517, 0.370939, 0.346839, 0.332455), // p9
    ],
    expectedOrder: ['p6', 'p4', 'p1', 'p8', 'p9', 'p3', 'p2', 'p5', 'p7'],
  },
  {
    name: 'verified: 018-bw.png (current algorithm confirmed correct)',
    description:
      'Real ML-detected panels; current assignReadingOrder output confirmed correct by the user (2026-06-09).',
    verified: true,
    panels: [
      box(0.392875, 0.567789, 0.55065, 0.431856), // p1
      box(0.08657, 0.000185, 0.349386, 0.191883), // p2
      box(0.084883, 0.220621, 0.419686, 0.315883), // p3
      box(0.085851, 0.568289, 0.290163, 0.368545), // p4
      box(0.331384, 0.730953, 0.182103, 0.267081), // p5
      box(0.386544, 0.000664, 0.613456, 0.54265), // p6
    ],
    expectedOrder: ['p6', 'p2', 'p3', 'p1', 'p5', 'p4'],
  },
  {
    name: 'verified: 018.png (current algorithm confirmed correct)',
    description:
      'Real ML-detected panels; current assignReadingOrder output confirmed correct by the user (2026-06-09).',
    verified: true,
    panels: [
      box(0.507203, 0.00048, 0.491745, 0.553466), // p1
      box(0.046689, 0.0003, 0.452086, 0.149997), // p2
      box(0.047754, 0.172231, 0.452234, 0.300058), // p3
      box(0.587505, 0.754602, 0.349459, 0.245398), // p4
      box(0.046585, 0.415127, 0.534719, 0.584873), // p5
      box(0.590113, 0.507962, 0.407934, 0.222985), // p6
    ],
    expectedOrder: ['p1', 'p2', 'p3', 'p6', 'p4', 'p5'],
  },
  {
    name: 'verified: 019-bw.png (current algorithm confirmed correct)',
    description:
      'Real ML-detected panels; current assignReadingOrder output confirmed correct by the user (2026-06-09).',
    verified: true,
    panels: [
      box(0.361789, 0, 0.548059, 0.300823), // p1
      box(0.000182, 0.53965, 0.911646, 0.401082), // p2
      box(0.056657, 0, 0.28557, 0.301867), // p3
      box(0.629538, 0.332251, 0.279497, 0.176365), // p4
      box(0.000106, 0.332926, 0.199213, 0.175558), // p5
      box(0.207365, 0.332829, 0.221646, 0.174666), // p6
      box(0.42708, 0.332987, 0.182172, 0.17476), // p7
    ],
    expectedOrder: ['p1', 'p3', 'p4', 'p7', 'p6', 'p5', 'p2'],
  },
  {
    name: 'verified: 019.png (current algorithm confirmed correct)',
    description:
      'Real ML-detected panels; current assignReadingOrder output confirmed correct by the user (2026-06-09).',
    verified: true,
    panels: [
      box(0.688077, 0.377007, 0.272034, 0.549364), // p1
      box(0, 0.655457, 0.680499, 0.175608), // p2
      box(0.348537, 0.422051, 0.334099, 0.209721), // p3
      box(0.002431, 0.85299, 0.675297, 0.14701), // p4
      box(0, 0.244666, 0.843283, 0.266851), // p5
      box(0, 0.465061, 0.344731, 0.166762), // p6
      box(0.577124, 0.089843, 0.382597, 0.290207), // p7
      box(0, 0, 0.95013, 0.222939), // p8
    ],
    expectedOrder: ['p8', 'p7', 'p5', 'p1', 'p3', 'p6', 'p2', 'p4'],
  },
  {
    name: 'verified: 022.png (current algorithm confirmed correct)',
    description:
      'Real ML-detected panels; current assignReadingOrder output confirmed correct by the user (2026-06-09).',
    verified: true,
    panels: [
      box(0.55812, 0.388317, 0.440652, 0.508345), // p1
      box(0.057078, 0.387653, 0.493175, 0.123672), // p2
      box(0.056922, 0.534398, 0.494989, 0.093898), // p3
      box(0.056869, 0.651524, 0.496202, 0.175963), // p4
      box(0.446636, 0.089959, 0.489878, 0.274447), // p5
      box(0.058703, 0, 0.655843, 0.364318), // p6
      box(0.057163, 0.772318, 0.880516, 0.227509), // p7
    ],
    expectedOrder: ['p6', 'p5', 'p2', 'p1', 'p3', 'p4', 'p7'],
  },
  {
    name: 'verified: 025.png (current algorithm confirmed correct)',
    description:
      'Real ML-detected panels; current assignReadingOrder output confirmed correct by the user (2026-06-09).',
    verified: true,
    panels: [
      box(0.059404, 0, 0.665476, 0.220182), // p1
      box(0.056857, 0.506675, 0.882172, 0.187913), // p2
      box(0.057264, 0.241873, 0.325645, 0.241879), // p3
      box(0.73465, 0.090193, 0.203127, 0.393493), // p4
      box(0.391457, 0.241617, 0.335865, 0.242309), // p5
      box(0.05759, 0.610107, 0.939608, 0.389721), // p6
    ],
    expectedOrder: ['p4', 'p1', 'p5', 'p3', 'p2', 'p6'],
  },
  {
    name: 'verified: 037.png (current algorithm confirmed correct)',
    description:
      'Real ML-detected panels; current assignReadingOrder output confirmed correct by the user (2026-06-09).',
    verified: true,
    panels: [
      box(0.038958, 0.720856, 0.327853, 0.277443), // p1
      box(0.376842, 0.720229, 0.372857, 0.279499), // p2
      box(0.75993, 0.719664, 0.238788, 0.205911), // p3
      box(0.039139, 0.410808, 0.959564, 0.285217), // p4
      box(0.040126, 0.270226, 0.741786, 0.307824), // p5
      box(0.038704, 0.000205, 0.584482, 0.24936), // p6
      box(0.404181, 0.000084, 0.595819, 0.441835), // p7
    ],
    expectedOrder: ['p7', 'p6', 'p5', 'p4', 'p3', 'p2', 'p1'],
  },
  {
    name: 'dbs ch68 p008 — slanted full-width top panel (fixed by centroid fallback)',
    description:
      'Full-width top panel (p2) with a slanted bottom edge whose box overlaps the middle row. ' +
      'XY-cut used to scramble the middle row; the X-overlap inseparable fallback now reads it ' +
      'correctly. Correct RTL: top -> right -> centre -> left -> bottom.',
    verified: true,
    panels: [
      box(0.059729, 0.646916, 0.879669, 0.353084), // p1
      box(0.061269, 0, 0.878388, 0.325601), // p2
      box(0.059782, 0.220978, 0.301033, 0.402747), // p3
      box(0.620269, 0.302587, 0.37808, 0.319525), // p4
      box(0.370912, 0.265855, 0.241642, 0.357646), // p5
    ],
    expectedOrder: ['p2', 'p4', 'p5', 'p3', 'p1'],
  },
  {
    name: 'dbs-color v157 p45 — slanted 3-tier fight (fixed by Y-overlap row rule)',
    description:
      'Slanted/diagonal panels over three tiers. User-confirmed RTL order (2026-06-09): ' +
      'p1 "PREPARE TO DIE" (top-right) -> p2 "DAAAHH" (top-left) -> p4 Beerus-only (sits higher, ' +
      'mid-left) -> p3 Vegeta punch/miss (mid-centre, lower than p4) -> p6 Beerus punches Vegeta ' +
      '(bottom-right) -> p5 reverse shot, knocked back (bottom-left). No valid cut exists anywhere ' +
      'on this page; the inseparable fallback’s vertical-overlap row rule orders it.',
    verified: true,
    panels: [
      box(0.740851, 0.001328, 0.239149, 0.493215), // p1
      box(0.052665, 0.001328, 0.688185, 0.493215), // p2
      box(0.517569, 0.444751, 0.481157, 0.212603), // p3
      box(0.057041, 0.365774, 0.502989, 0.178509), // p4
      box(0.054759, 0.500833, 0.521023, 0.496898), // p5
      box(0.296087, 0.65484, 0.643882, 0.344923), // p6
    ],
    expectedOrder: ['p1', 'p2', 'p4', 'p3', 'p6', 'p5'],
  },
  {
    name: 'dbs-color v157 p176 — tall right-hand column read first (fixed by tall-column pre-pass)',
    description:
      'Top block has a tall right-hand column (p2) that the user confirmed reads FIRST (2026-06-09), ' +
      'then the left sub-block top-to-bottom (p1, p3, then row p4 right of p5), then two lower tiers ' +
      'right-to-left (p6,p7,p8 / p9,p10,p11). A clean vertical cut isolating the effectively ' +
      'full-height p2 now takes precedence over the horizontal cut that peeled the top strip first.',
    verified: true,
    panels: [
      box(0.06107, 0.000278, 0.527794, 0.141956), // p1
      box(0.597656, 0.090948, 0.343351, 0.375186), // p2
      box(0.061922, 0.165851, 0.525155, 0.105508), // p3
      box(0.33958, 0.294396, 0.248638, 0.170272), // p4
      box(0.062574, 0.294834, 0.266265, 0.170588), // p5
      box(0.448167, 0.489405, 0.494917, 0.230743), // p6
      box(0.214895, 0.490007, 0.222417, 0.230454), // p7
      box(0.062222, 0.490045, 0.14197, 0.22915), // p8
      box(0.489382, 0.742623, 0.453484, 0.257177), // p9
      box(0.266979, 0.743551, 0.211399, 0.256449), // p10
      box(0.060923, 0.744036, 0.197501, 0.255964), // p11
    ],
    expectedOrder: ['p2', 'p1', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11'],
  },
];
