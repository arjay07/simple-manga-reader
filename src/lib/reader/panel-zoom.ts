import type { Panel } from '@/lib/panel-detect/types';

export interface StopGeometry {
  stopCount: number;
  zoom: number;
  px: number;
  py: number;
  pw: number;
  ph: number;
}

/**
 * Single source of truth for panel zoom geometry. Decides single-stop vs multi-stop,
 * the zoom level, and the inset panel rect (px/py/pw/ph after adaptive margins).
 * Callers pass viewport (vW, vH) and canvas (cw, ch) dims so this is pure / refless.
 */
export function computeStopGeometry(
  panel: Panel,
  vW: number,
  vH: number,
  cw: number,
  ch: number,
): StopGeometry {
  const marginX = panel.width * 0.08 * (1 - panel.width);
  const marginY = panel.height * 0.08 * (1 - panel.height);
  const px = Math.max(0, panel.x - marginX);
  const py = Math.max(0, panel.y - marginY);
  const pw = Math.min(1 - px, panel.width + marginX * 2);
  const ph = Math.min(1 - py, panel.height + marginY * 2);

  const pad = 0.95;
  const scaleX = (vW * pad) / (pw * cw);
  const scaleY = (vH * pad) / (ph * ch);
  const fitZoom = Math.min(scaleX, scaleY, 5);
  const heightZoom = Math.min(scaleY, 5);

  // Single-stop iff the panel renders tall enough at fitZoom to be readable;
  // otherwise it's a wide/short strip that reads better split into horizontal stops at heightZoom.
  const MIN_SINGLE_STOP_HEIGHT_RATIO = 2 / 7;
  const panelHeightAtFit = ph * ch * fitZoom;
  if (panelHeightAtFit >= vH * MIN_SINGLE_STOP_HEIGHT_RATIO) {
    return { stopCount: 1, zoom: fitZoom, px, py, pw, ph };
  }

  // Cap multi-stop zoom at 3.5x — full height-fit can be 7-8x for thin strips,
  // which over-zooms past readability and creates too many stops.
  const multiStopZoom = Math.min(heightZoom, 3.5);
  const overlapFactor = 0.85;
  const stride = vW * overlapFactor;
  const panelWidthAtZoom = pw * cw * multiStopZoom;
  // The first stop covers a full viewport width; each additional stop advances
  // by stride. So stops = ceil((panelWidth - vW) / stride) + 1.
  const rawStops = Math.max(1, Math.ceil((panelWidthAtZoom - vW) / stride) + 1);
  // Ensure each stop moves at least 35% of viewport width — otherwise the
  // movement feels negligible and the extra stop is wasted.
  const minStride = vW * 0.35;
  let effectiveStops = rawStops;
  while (effectiveStops > 1 && (panelWidthAtZoom - vW) / (effectiveStops - 1) < minStride) {
    effectiveStops--;
  }
  if (effectiveStops <= 1) {
    return { stopCount: 1, zoom: fitZoom, px, py, pw, ph };
  }
  // Allow up to 4 stops for panels where fitZoom is too low (< 1.5x),
  // otherwise cap at 3 to avoid excessive panning on moderately wide panels.
  const maxStops = fitZoom < 1.5 ? 4 : 3;
  if (rawStops > maxStops) {
    // N stops cover (N-1)*stride + vW pixels total
    const reducedZoom = ((maxStops - 1) * stride + vW) / (pw * cw);
    return { stopCount: maxStops, zoom: Math.min(reducedZoom, 3.5), px, py, pw, ph };
  }
  return { stopCount: Math.min(effectiveStops, maxStops), zoom: multiStopZoom, px, py, pw, ph };
}
