import type { RawPanel, Panel, ReadingTreeNode } from './types';

interface PanelWithId extends RawPanel {
  id: string;
}

interface OrderResult {
  panels: Panel[];
  readingTree: ReadingTreeNode | null;
}

/**
 * Assign RTL reading order to raw panels.
 *
 * Strategy: group panels into rows based on vertical overlap, then sort
 * rows top-to-bottom and panels within each row right-to-left.
 *
 * A panel's "anchor" for row assignment is its top edge (p.y).
 * Two panels are in the same row if their Y ranges overlap significantly.
 */
export function assignReadingOrder(rawPanels: RawPanel[]): OrderResult {
  if (rawPanels.length === 0) {
    return { panels: [], readingTree: null };
  }

  const panels: PanelWithId[] = rawPanels.map((p, i) => ({
    ...p,
    id: `p${i + 1}`,
  }));

  if (panels.length === 1) {
    return {
      panels: [{ ...panels[0], readingOrder: 1 }],
      readingTree: { panel: panels[0].id },
    };
  }

  // Sort by top-right priority: sort by top edge (y) first, then by right edge descending (RTL)
  const sorted = sortRTL(panels);

  // Assign reading order
  const result: Panel[] = sorted.map((p, i) => ({
    ...p,
    readingOrder: i + 1,
  }));

  // Build a simple reading tree from the sorted order
  const tree = buildTreeFromSorted(sorted);

  return { panels: result, readingTree: tree };
}

/**
 * Sort panels in RTL manga reading order.
 *
 * 1. Group panels into rows: panels whose Y ranges overlap by at least 30%
 *    of the shorter panel's height are considered the same row.
 * 2. Sort rows by the topmost panel's Y (top-to-bottom).
 * 3. Within each row, sort by right edge descending (right-to-left).
 */
function sortRTL(panels: PanelWithId[]): PanelWithId[] {
  // Sort panels by top edge first to process top-to-bottom
  const byTop = [...panels].sort((a, b) => a.y - b.y);

  // Group into rows: panels share a row if their top edges are close
  // relative to their heights. We use the SHORTEST panel in the comparison
  // to decide if tops are "close enough" — this prevents tall panels from
  // absorbing panels at completely different vertical positions.
  const rows: PanelWithId[][] = [];
  const assigned = new Set<string>();

  for (const panel of byTop) {
    if (assigned.has(panel.id)) continue;

    const row: PanelWithId[] = [panel];
    assigned.add(panel.id);

    // The row's "anchor" top is defined by non-tall panels in the row.
    // A panel is "tall" if it's >2x the height of the shortest panel seen so far.
    const anchorTop = panel.y;
    let minHeight = panel.height;

    for (const candidate of byTop) {
      if (assigned.has(candidate.id)) continue;

      // Same-row criteria: a candidate joins the anchor's row if EITHER
      // its top edge is close to the anchor's top (50% of the shorter
      // height) OR it shares >= 40% of the shorter panel's vertical
      // extent with the anchor. The vertical-overlap fallback handles
      // the "short anchor + taller candidate that starts slightly lower"
      // case where the top-edge rule fails by a hair (anchor too short
      // to allow even a small Y offset).
      const topDiff = Math.abs(candidate.y - anchorTop);
      const refHeight = Math.min(minHeight, candidate.height);
      const topDiffOK = topDiff <= refHeight * 0.5;

      const vertOverlapAnchor =
        Math.min(panel.y + panel.height, candidate.y + candidate.height) -
        Math.max(panel.y, candidate.y);
      const vertFractionShorter =
        Math.max(0, vertOverlapAnchor) / Math.min(panel.height, candidate.height);
      const vertOverlapOK = vertFractionShorter >= 0.4;

      if (topDiffOK || vertOverlapOK) {
        // Reject candidates that substantially overlap a row member
        // horizontally AND have weak vertical alignment with that
        // member — that combination indicates the pair is stacked
        // vertically (e.g. a full-width bottom strip near a right-side
        // panel above it). Loose bounding boxes can produce >50%
        // horizontal overlap on genuine side-by-side panels too, so
        // the vertical-alignment guard distinguishes the two.
        let horizConflict = false;
        for (const member of row) {
          const horizOverlap =
            Math.min(candidate.x + candidate.width, member.x + member.width) -
            Math.max(candidate.x, member.x);
          const horizFraction = Math.max(0, horizOverlap) / Math.min(candidate.width, member.width);
          if (horizFraction > 0.5) {
            const memberVertOverlap =
              Math.min(candidate.y + candidate.height, member.y + member.height) -
              Math.max(candidate.y, member.y);
            const memberVertFractionTaller =
              Math.max(0, memberVertOverlap) / Math.max(candidate.height, member.height);
            if (memberVertFractionTaller <= 0.7) {
              horizConflict = true;
              break;
            }
          }
        }
        if (!horizConflict) {
          row.push(candidate);
          assigned.add(candidate.id);
          minHeight = Math.min(minHeight, candidate.height);
        }
      }
    }

    rows.push(row);
  }

  // Sort each row RTL (right edge descending)
  for (const row of rows) {
    row.sort((a, b) => b.x + b.width - (a.x + a.width));
  }

  // Defer panels that span into later rows where right-side panels exist
  // in a genuine side-by-side layout. In RTL manga, when a tall panel on
  // the LEFT sits beside stacked shorter panels on the RIGHT, the right
  // panels are read first (top-to-bottom), then the tall left panel.
  //
  // We iterate until stable because deferring one panel (e.g. the leftmost)
  // can leave another panel (e.g. center-left) that also needs deferring.
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].length === 0) continue;

      // Walk RTL-sorted row from last (leftmost) to first (rightmost)
      for (let k = rows[i].length - 1; k >= 0; k--) {
        const panel = rows[i][k];
        const panelBottom = panel.y + panel.height;
        const panelCenterX = panel.x + panel.width / 2;

        // Find the last later row this panel spans into that has panels
        // to its right in a genuine side-by-side (non-overlapping) layout.
        let targetRow = -1;
        for (let j = i + 1; j < rows.length; j++) {
          for (const laterPanel of rows[j]) {
            // Require the deferred panel to span at least 60% of the
            // laterPanel's vertical range. A weaker threshold (e.g. 30%)
            // wrongly defers shorter top panels past taller right-column
            // panels they don't actually frame — the deferred panel must
            // visually "frame" the laterPanel for the deferral to make
            // sense as a manga reading-order rearrangement.
            if (panelBottom > laterPanel.y + laterPanel.height * 0.6) {
              const laterCenterX = laterPanel.x + laterPanel.width / 2;
              // Horizontal overlap: if high, panels are stacked vertically,
              // not side-by-side — skip deferral.
              const horizOverlap =
                Math.min(panel.x + panel.width, laterPanel.x + laterPanel.width) -
                Math.max(panel.x, laterPanel.x);
              const overlapFraction =
                Math.max(0, horizOverlap) / Math.min(panel.width, laterPanel.width);

              if (overlapFraction < 0.5 && laterCenterX > panelCenterX) {
                targetRow = j;
              }
            }
          }
        }

        if (targetRow > i) {
          rows[i].splice(k, 1);
          rows.splice(targetRow + 1, 0, [panel]);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  // Remove rows emptied by deferral
  const filtered = rows.filter((r) => r.length > 0);

  // Flatten rows into final order
  return filtered.flat();
}

/**
 * Build a simple reading tree from sorted panels.
 * Groups consecutive panels that share a row into vertical cuts,
 * and separates rows with horizontal cuts.
 */
function buildTreeFromSorted(panels: PanelWithId[]): ReadingTreeNode {
  if (panels.length === 1) {
    return { panel: panels[0].id };
  }

  if (panels.length === 2) {
    const [a, b] = panels;
    const sameRow =
      Math.abs(a.y + a.height / 2 - (b.y + b.height / 2)) < Math.min(a.height, b.height) * 0.5;

    if (sameRow) {
      return {
        cut: 'vertical',
        at: (a.x + a.width + b.x) / 2,
        right: { panel: a.id },
        left: { panel: b.id },
      };
    }
    return {
      cut: 'horizontal',
      at: (a.y + a.height + b.y) / 2,
      top: { panel: a.id },
      bottom: { panel: b.id },
    };
  }

  // Split at midpoint
  const mid = Math.floor(panels.length / 2);
  const top = panels.slice(0, mid);
  const bottom = panels.slice(mid);
  const cutY = (top[top.length - 1].y + top[top.length - 1].height + bottom[0].y) / 2;

  return {
    cut: 'horizontal',
    at: cutY,
    top: buildTreeFromSorted(top),
    bottom: buildTreeFromSorted(bottom),
  };
}
