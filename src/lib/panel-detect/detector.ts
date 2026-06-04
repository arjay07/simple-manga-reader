import type { RawPanel } from './types';
import type { PanelDetectConfig } from './config';
import { detectPanelsMl } from './ml';
import { detectPanelsContour } from './contour';

export type DetectorName = 'ml' | 'contour';

export interface DetectorOptions {
  /** Frame-class confidence threshold (ML only; contour ignores it). */
  confidence?: number;
  /** Threshold overrides; defaults to {@link DEFAULT_PANEL_DETECT_CONFIG} when omitted. */
  config?: PanelDetectConfig;
}

/**
 * A pluggable panel-detection strategy. `detect` returns raw, unordered panels
 * in normalized 0–1 coordinates; reading order and page classification are the
 * caller's concern (see `assignReadingOrder` and `classifyPageType`).
 */
export interface PanelDetector {
  name: DetectorName;
  detect(buf: Buffer, opts?: DetectorOptions): Promise<RawPanel[]>;
}

/** YOLO ONNX detector — the default strategy. */
export const MlDetector: PanelDetector = {
  name: 'ml',
  async detect(buf, opts = {}) {
    const result = await detectPanelsMl(buf, opts.confidence, opts.config);
    return result.panels;
  },
};

/** Gutter/contour detector — a model-free fallback. */
export const ContourDetector: PanelDetector = {
  name: 'contour',
  async detect(buf, opts = {}) {
    const result = await detectPanelsContour(buf, opts.config);
    return result.panels;
  },
};

const DETECTORS: Record<DetectorName, PanelDetector> = {
  ml: MlDetector,
  contour: ContourDetector,
};

/**
 * Resolve a detection strategy by name. Defaults to `'ml'`.
 */
export function getDetector(name: DetectorName = 'ml'): PanelDetector {
  return DETECTORS[name] ?? MlDetector;
}
