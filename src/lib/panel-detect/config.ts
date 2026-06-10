/**
 * Centralised tuning surface for panel detection.
 *
 * Every threshold that was previously inlined as a magic number in `ml.ts`,
 * `reading-order.ts`, and `contour.ts` lives here with a name and a JSDoc
 * note explaining what it controls and why the default is what it is. The
 * defaults in {@link DEFAULT_PANEL_DETECT_CONFIG} reproduce the historical
 * behaviour byte-for-byte; passing a partial/overridden config is how A/B
 * tuning (and, later, per-series tuning) happens without a code change.
 *
 * Each consumer reads its own sub-object (`config.ml`, `config.readingOrder`,
 * `config.contour`). Functions accept `config?: PanelDetectConfig` and fall
 * back to the default when omitted, so existing call sites need no change.
 */

export interface MlConfig {
  /** Letterbox input square the YOLO model expects, in pixels. Default 640. */
  inputSize: number;
  /** Minimum frame-class confidence for a detection to be kept. Lower =
   * more (and noisier) panels. Default 0.25. */
  confidence: number;
  /** IoU above which two overlapping boxes are merged by non-maximum
   * suppression. Default 0.45. */
  nmsIouThreshold: number;
  /** During containment suppression, a larger lower-confidence box is dropped
   * when this fraction of a smaller higher-confidence box sits inside it.
   * Default 0.6. */
  containmentThreshold: number;
  /** When inferring panels from uncovered regions, a region must overlap an
   * existing panel by less than this fraction (of either area) to be kept as
   * a distinct panel. Default 0.3. */
  overlapThreshold: number;
  /** Minimum side-gap width (as a fraction of page width) before a left/right
   * uncovered strip is considered a candidate inferred panel. Default 0.2. */
  sideGapMinWidthFraction: number;
  /** Minimum gap size, as a fraction of the page dimension, to treat an
   * uncovered region as a possible missing panel. Default 0.1. */
  minGapFraction: number;
  /** Pixel brightness (0–255) at or above which a pixel counts as "white"
   * for blank-region detection. Default 230. */
  blankBrightnessThreshold: number;
  /** Fraction of white pixels above which a region is judged blank. Default 0.9. */
  blankPixelFraction: number;
}

export interface ReadingOrderConfig {
  /** Recursive XY-cut straddle budget, measured **relative to each panel's own
   * extent on the cut axis** (not as an absolute page fraction). A candidate
   * cut line is valid only when no panel is clipped by more than this fraction
   * of its own width/height; among the valid cuts the ordering picks the one
   * that straddles the least. A panel the cut does clip is assigned to the side
   * holding the majority of its area (majority-snap), so a slightly-offset panel
   * still sits in the correct row/column. Because the budget scales with each
   * box, a small clip of a large panel no longer kills an otherwise-clean cut,
   * and a large clip of a small panel is still rejected. Larger = more eager to
   * slice through overlapping boxes; too small reverts to brittle clean-gutter
   * behaviour. When no valid cut exists on either axis the region is emitted in
   * deterministic geometric order. Default 0.25. */
  maxStraddleRatio: number;
  /** A clean (zero-straddle) vertical cut that isolates a SINGLE panel on the
   * right is taken before any horizontal row split when that panel spans at
   * least this fraction of the region's height — an effectively full-height
   * right-hand column reads first under RTL, even when a shorter top strip
   * sits to its left. Larger = fewer layouts qualify as a column. 0.75 sits
   * between the tallest verified non-column (≤0.55 of region height) and the
   * confirmed column page (0.81). Default 0.75. */
  tallColumnMinHeightRatio: number;
  /** In the no-valid-cut fallback, two panels read as a ROW (right-to-left)
   * when their vertical overlap exceeds this fraction of the shorter panel's
   * height; otherwise they read stacked (higher first). Smaller = more pairs
   * treated as rows. 0.75 sits between confirmed stacked pairs (≤0.60) and
   * confirmed row pairs (≥0.99) across the verified real pages. Default 0.75. */
  rowOverlapMinRatio: number;
}

export interface ContourConfig {
  /** Grayscale binary threshold (0–255): pixels brighter than this become
   * "white" (gutter), darker become content. Default 200. */
  grayscaleThreshold: number;
  /** Minimum fraction of a row/column that must be white to qualify as a
   * gutter. Default 0.85. */
  gutterWhiteThreshold: number;
  /** Page is judged blank when this fraction of pixels are white. Default 0.95. */
  blankPageThreshold: number;
  /** Maximum recursion depth of the gutter-splitting search, guarding against
   * pathological inputs. Default 10. */
  recursionMaxDepth: number;
  /** Minimum gutter width as a fraction of the region dimension. Default 0.01. */
  minGutterFraction: number;
}

export interface PanelDetectConfig {
  ml: MlConfig;
  readingOrder: ReadingOrderConfig;
  contour: ContourConfig;
  /** Idle window (milliseconds) after which the ONNX inference session is
   * released when no panel-detect jobs are running. Default 300000 (5 min). */
  sessionIdleMs: number;
}

export const DEFAULT_PANEL_DETECT_CONFIG: PanelDetectConfig = {
  ml: {
    inputSize: 640,
    confidence: 0.25,
    nmsIouThreshold: 0.45,
    containmentThreshold: 0.6,
    overlapThreshold: 0.3,
    sideGapMinWidthFraction: 0.2,
    minGapFraction: 0.1,
    blankBrightnessThreshold: 230,
    blankPixelFraction: 0.9,
  },
  readingOrder: {
    maxStraddleRatio: 0.25,
    tallColumnMinHeightRatio: 0.75,
    rowOverlapMinRatio: 0.75,
  },
  contour: {
    grayscaleThreshold: 200,
    gutterWhiteThreshold: 0.85,
    blankPageThreshold: 0.95,
    recursionMaxDepth: 10,
    minGutterFraction: 0.01,
  },
  sessionIdleMs: 5 * 60 * 1000,
};
