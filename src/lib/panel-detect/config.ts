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
  /** Two panels share a row when the candidate's top edge is within this
   * fraction of the shorter panel's height of the row anchor's top. Larger =
   * more eager to merge tops into one row. (Audit: "rowOverlapHigh".)
   * Default 0.5. */
  rowTopEdgeFraction: number;
  /** Fallback row-grouping rule: a candidate also joins the anchor's row when
   * it shares at least this fraction of the shorter panel's vertical extent
   * with the anchor. Catches a short anchor beside a taller neighbour that
   * starts slightly lower, where the top-edge rule fails by a hair. (Audit:
   * "rowOverlapLow".) Default 0.4. */
  rowVerticalOverlapFraction: number;
  /** Row-grouping conflict guard: a candidate that overlaps a row member
   * horizontally by more than this fraction of the narrower panel is suspected
   * of being stacked (e.g. a full-width strip), not side-by-side. Default 0.5. */
  horizontalConflictFraction: number;
  /** ...the vertical half of that guard: the suspicion is confirmed (candidate
   * kept out of the row) only when the pair's vertical overlap is at most this
   * fraction of the taller panel. (Audit: "sideDeferralRatio".) Default 0.7. */
  sideAlignmentRatio: number;
  /** Deferral pass: a panel is deferred past a later row only when it spans at
   * least this fraction of the later panel's vertical range — i.e. it visually
   * frames that panel. A weaker value wrongly defers short top panels. Default 0.6. */
  deferralFrameFraction: number;
  /** Deferral pass: the deferred panel and the later panel count as a genuine
   * side-by-side layout (not vertically stacked) only when their horizontal
   * overlap is below this fraction of the narrower panel. Default 0.5. */
  deferralHorizontalOverlap: number;
  /** Reading-tree construction: two panels are treated as one row (a vertical
   * cut) when their vertical centres are within this fraction of the shorter
   * height; otherwise a horizontal cut. Default 0.5. */
  treeSameRowFraction: number;
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
    rowTopEdgeFraction: 0.5,
    rowVerticalOverlapFraction: 0.4,
    horizontalConflictFraction: 0.5,
    sideAlignmentRatio: 0.7,
    deferralFrameFraction: 0.6,
    deferralHorizontalOverlap: 0.5,
    treeSameRowFraction: 0.5,
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
