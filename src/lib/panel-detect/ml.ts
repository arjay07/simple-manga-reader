import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import { getModelPath, isModelDownloaded, downloadModel } from './model-downloader';
import type { RawPanel, PageType } from './types';

// manga109_yolo classes: body=0, face=1, frame=2, text=3
const CLASS_NAMES = ['body', 'face', 'frame', 'text'];
const FRAME_CLASS_INDEX = 2;
const MODEL_INPUT_SIZE = 640;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.25;
const NMS_IOU_THRESHOLD = 0.45;

let session: ort.InferenceSession | null = null;

async function getSession(): Promise<ort.InferenceSession> {
  if (session) return session;

  if (!isModelDownloaded()) {
    await downloadModel();
  }

  session = await ort.InferenceSession.create(getModelPath(), {
    executionProviders: ['cpu'],
  });
  return session;
}

/**
 * Run ML-based panel detection using the YOLO ONNX model.
 */
export async function detectPanelsMl(
  imageBuffer: Buffer,
  confidenceThreshold: number = DEFAULT_CONFIDENCE_THRESHOLD
): Promise<{
  panels: RawPanel[];
  pageType: PageType;
  imageWidth: number;
  imageHeight: number;
  debug?: { allDetections: unknown[] };
}> {
  const sess = await getSession();

  // Get original image dimensions
  const metadata = await sharp(imageBuffer).metadata();
  const origWidth = metadata.width!;
  const origHeight = metadata.height!;

  // Preprocess: letterbox resize to 640x640
  const { tensor, scale, padX, padY } = await preprocessImage(imageBuffer, origWidth, origHeight);

  // Run inference
  const feeds: Record<string, ort.Tensor> = { images: tensor };
  const results = await sess.run(feeds);

  // Parse YOLO output
  const outputTensor = results[Object.keys(results)[0]];
  const debugDetections: DebugDetection[] = [];
  const rawBoxes = parseYoloOutput(
    outputTensor.data as Float32Array,
    outputTensor.dims as number[],
    confidenceThreshold,
    debugDetections
  );

  // Apply NMS
  const nmsBoxes = nonMaximumSuppression(rawBoxes, NMS_IOU_THRESHOLD);

  // Convert from model coordinates back to normalized 0-1 image coordinates
  const panels: RawPanel[] = nmsBoxes.map(box => {
    // Remove letterbox padding and scale back to original image
    const x1 = (box.x1 - padX) / scale;
    const y1 = (box.y1 - padY) / scale;
    const x2 = (box.x2 - padX) / scale;
    const y2 = (box.y2 - padY) / scale;

    // Clamp and normalize to 0-1
    const nx = Math.max(0, x1) / origWidth;
    const ny = Math.max(0, y1) / origHeight;
    const nx2 = Math.min(origWidth, x2) / origWidth;
    const ny2 = Math.min(origHeight, y2) / origHeight;

    return {
      x: nx,
      y: ny,
      width: nx2 - nx,
      height: ny2 - ny,
      confidence: Math.round(box.confidence * 100) / 100,
    };
  });

  // Infer missing panels from uncovered page regions
  const allPanels = inferMissingPanels(panels);

  // Classify page type
  const pageType = classifyPage(allPanels);

  return { panels: allPanels, pageType, imageWidth: origWidth, imageHeight: origHeight, debug: { allDetections: debugDetections } };
}

interface YoloBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
}

/**
 * Preprocess image: letterbox resize to MODEL_INPUT_SIZE x MODEL_INPUT_SIZE,
 * normalize to float32, convert to CHW format.
 */
async function preprocessImage(
  imageBuffer: Buffer,
  origWidth: number,
  origHeight: number
): Promise<{ tensor: ort.Tensor; scale: number; padX: number; padY: number }> {
  // Calculate scale to fit within MODEL_INPUT_SIZE while maintaining aspect ratio
  const scale = Math.min(MODEL_INPUT_SIZE / origWidth, MODEL_INPUT_SIZE / origHeight);
  const newWidth = Math.round(origWidth * scale);
  const newHeight = Math.round(origHeight * scale);

  // Padding to center the image
  const padX = Math.round((MODEL_INPUT_SIZE - newWidth) / 2);
  const padY = Math.round((MODEL_INPUT_SIZE - newHeight) / 2);

  // Resize and pad with gray (114/255 is YOLO convention)
  const { data: rgbData } = await sharp(imageBuffer)
    .resize(newWidth, newHeight)
    .extend({
      top: padY,
      bottom: MODEL_INPUT_SIZE - newHeight - padY,
      left: padX,
      right: MODEL_INPUT_SIZE - newWidth - padX,
      background: { r: 114, g: 114, b: 114 },
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(rgbData);

  // Convert HWC RGB to CHW float32 normalized to 0-1
  const floatData = new Float32Array(3 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE);
  const pixelCount = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;

  for (let i = 0; i < pixelCount; i++) {
    floatData[i] = pixels[i * 3] / 255;                    // R channel
    floatData[pixelCount + i] = pixels[i * 3 + 1] / 255;   // G channel
    floatData[2 * pixelCount + i] = pixels[i * 3 + 2] / 255; // B channel
  }

  const tensor = new ort.Tensor('float32', floatData, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
  return { tensor, scale, padX, padY };
}

/**
 * Parse YOLOv8/v11 output tensor.
 * Output shape is [1, numAttributes, numDetections] where numAttributes = 4 (bbox) + numClasses.
 * The bbox format is center_x, center_y, width, height.
 */
interface DebugDetection {
  cx: number;
  cy: number;
  w: number;
  h: number;
  bestClass: string;
  bestConf: number;
  frameConf: number;
  allClasses: Record<string, number>;
}

function parseYoloOutput(
  data: Float32Array,
  dims: number[],
  confidenceThreshold: number,
  debugDetections?: DebugDetection[]
): YoloBox[] {
  const boxes: YoloBox[] = [];

  // YOLOv8/v11 output: [1, 4+numClasses, numDetections]
  const numAttributes = dims[1];
  const numDetections = dims[2];

  for (let i = 0; i < numDetections; i++) {
    // Extract bbox: cx, cy, w, h
    const cx = data[0 * numDetections + i];
    const cy = data[1 * numDetections + i];
    const w = data[2 * numDetections + i];
    const h = data[3 * numDetections + i];

    // Get all class confidences
    let maxConf = 0;
    let maxClass = 0;
    const allClasses: Record<string, number> = {};
    for (let c = 4; c < numAttributes; c++) {
      const conf = data[c * numDetections + i];
      const className = CLASS_NAMES[c - 4] ?? `class${c - 4}`;
      allClasses[className] = Math.round(conf * 1000) / 1000;
      if (conf > maxConf) {
        maxConf = conf;
        maxClass = c - 4;
      }
    }

    const frameConf = data[(4 + FRAME_CLASS_INDEX) * numDetections + i] ?? 0;

    // Debug: capture large detections (covering significant area)
    if (debugDetections && maxConf > 0.05 && w > 50 && h > 50) {
      debugDetections.push({
        cx: Math.round(cx),
        cy: Math.round(cy),
        w: Math.round(w),
        h: Math.round(h),
        bestClass: CLASS_NAMES[maxClass] ?? `class${maxClass}`,
        bestConf: Math.round(maxConf * 1000) / 1000,
        frameConf: Math.round(frameConf * 1000) / 1000,
        allClasses,
      });
    }

    // Only keep frame class detections above threshold
    if (frameConf < confidenceThreshold) continue;
    if (maxClass !== FRAME_CLASS_INDEX) continue;

    // Convert center format to corner format
    boxes.push({
      x1: cx - w / 2,
      y1: cy - h / 2,
      x2: cx + w / 2,
      y2: cy + h / 2,
      confidence: frameConf,
    });
  }

  return boxes;
}

/**
 * Non-maximum suppression + containment suppression.
 * Standard NMS removes overlapping boxes by IoU.
 * Containment suppression removes large low-confidence boxes that contain
 * smaller higher-confidence boxes inside them.
 */
function nonMaximumSuppression(boxes: YoloBox[], iouThreshold: number): YoloBox[] {
  if (boxes.length === 0) return [];

  // Sort by confidence descending
  const sorted = [...boxes].sort((a, b) => b.confidence - a.confidence);
  const keep: YoloBox[] = [];

  const suppressed = new Set<number>();

  // Standard NMS pass
  for (let i = 0; i < sorted.length; i++) {
    if (suppressed.has(i)) continue;
    keep.push(sorted[i]);

    for (let j = i + 1; j < sorted.length; j++) {
      if (suppressed.has(j)) continue;
      if (computeIoU(sorted[i], sorted[j]) > iouThreshold) {
        suppressed.add(j);
      }
    }
  }

  // Containment suppression pass:
  // If a lower-confidence box contains a higher-confidence box (>60% of the
  // smaller box is inside the larger one), suppress the larger box.
  const final: YoloBox[] = [];
  for (let i = 0; i < keep.length; i++) {
    let shouldSuppress = false;
    const outer = keep[i];
    const outerArea = (outer.x2 - outer.x1) * (outer.y2 - outer.y1);

    for (let j = 0; j < keep.length; j++) {
      if (i === j) continue;
      const inner = keep[j];
      const innerArea = (inner.x2 - inner.x1) * (inner.y2 - inner.y1);

      // Only suppress outer if it's larger and lower confidence
      if (outerArea <= innerArea) continue;
      if (outer.confidence > inner.confidence) continue;

      // Check how much of the inner box is contained within the outer box
      const overlapX = Math.max(0, Math.min(outer.x2, inner.x2) - Math.max(outer.x1, inner.x1));
      const overlapY = Math.max(0, Math.min(outer.y2, inner.y2) - Math.max(outer.y1, inner.y1));
      const overlapArea = overlapX * overlapY;
      const containment = innerArea > 0 ? overlapArea / innerArea : 0;

      if (containment > 0.6) {
        shouldSuppress = true;
        break;
      }
    }

    if (!shouldSuppress) {
      final.push(outer);
    }
  }

  return final;
}

function computeIoU(a: YoloBox, b: YoloBox): number {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
  const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
  const union = areaA + areaB - intersection;

  return union > 0 ? intersection / union : 0;
}

// Minimum gap size as fraction of page dimension to be considered a missing panel
const MIN_GAP_FRACTION = 0.10;
// Minimum area of an inferred panel as fraction of page area
const MIN_INFERRED_AREA = 0.05;
// Page margin to ignore (panels at edges may not reach 0.0/1.0 exactly)
const PAGE_MARGIN = 0.02;

/**
 * Infer missing panels from uncovered page regions.
 *
 * Strategy: scan for large rectangular gaps not covered by any detected panel.
 * Check top, bottom, left, right gaps, and gaps between panels.
 */
function inferMissingPanels(detected: RawPanel[]): RawPanel[] {
  if (detected.length === 0) return detected;

  const panels = [...detected];

  // Find the bounding box of all detected panels
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of panels) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + p.width);
    maxY = Math.max(maxY, p.y + p.height);
  }

  const inferred: RawPanel[] = [];

  // Check top gap: space above all detected panels
  if (minY > MIN_GAP_FRACTION) {
    const gap: RawPanel = {
      x: PAGE_MARGIN,
      y: PAGE_MARGIN,
      width: 1.0 - PAGE_MARGIN * 2,
      height: minY - PAGE_MARGIN,
      confidence: 0.5, // inferred panels get moderate confidence
    };
    if (gap.width * gap.height >= MIN_INFERRED_AREA) {
      inferred.push(gap);
    }
  }

  // Check bottom gap: space below all detected panels
  if (maxY < 1.0 - MIN_GAP_FRACTION) {
    const gap: RawPanel = {
      x: PAGE_MARGIN,
      y: maxY,
      width: 1.0 - PAGE_MARGIN * 2,
      height: 1.0 - PAGE_MARGIN - maxY,
      confidence: 0.5,
    };
    if (gap.width * gap.height >= MIN_INFERRED_AREA) {
      inferred.push(gap);
    }
  }

  // Check left gap: only if wide enough to be a real panel (>20% page width)
  if (minX > 0.20) {
    const gap: RawPanel = {
      x: PAGE_MARGIN,
      y: minY,
      width: minX - PAGE_MARGIN,
      height: maxY - minY,
      confidence: 0.5,
    };
    if (gap.width * gap.height >= MIN_INFERRED_AREA) {
      inferred.push(gap);
    }
  }

  // Check right gap: only if wide enough to be a real panel (>20% page width)
  if (maxX < 0.80) {
    const gap: RawPanel = {
      x: maxX,
      y: minY,
      width: 1.0 - PAGE_MARGIN - maxX,
      height: maxY - minY,
      confidence: 0.5,
    };
    if (gap.width * gap.height >= MIN_INFERRED_AREA) {
      inferred.push(gap);
    }
  }

  // Check for horizontal gaps between panel rows
  // Sort panels by Y position and look for gaps between rows
  const sortedByY = [...panels].sort((a, b) => a.y - b.y);
  for (let i = 0; i < sortedByY.length; i++) {
    const bottom = sortedByY[i].y + sortedByY[i].height;
    // Find the next panel that starts below this one
    let nextTop = 1.0;
    for (let j = 0; j < sortedByY.length; j++) {
      if (sortedByY[j].y > bottom + 0.01) {
        nextTop = Math.min(nextTop, sortedByY[j].y);
      }
    }
    const gapHeight = nextTop - bottom;
    if (gapHeight > MIN_GAP_FRACTION) {
      const gap: RawPanel = {
        x: PAGE_MARGIN,
        y: bottom,
        width: 1.0 - PAGE_MARGIN * 2,
        height: gapHeight,
        confidence: 0.5,
      };
      if (gap.width * gap.height >= MIN_INFERRED_AREA && !overlapsAny(gap, panels)) {
        inferred.push(gap);
      }
    }
  }

  // Check for side gaps next to individual panels.
  // For each panel, if there's a large uncovered region to its right or left
  // at the same Y range, infer a missing panel there.
  for (const panel of panels) {
    const pRight = panel.x + panel.width;
    const pBottom = panel.y + panel.height;

    // Check right side: is there uncovered space to the right of this panel?
    if (pRight < 0.75) {
      const gap: RawPanel = {
        x: pRight,
        y: panel.y,
        width: (1.0 - PAGE_MARGIN) - pRight,
        height: panel.height,
        confidence: 0.5,
      };
      if (gap.width > 0.15 && gap.width * gap.height >= MIN_INFERRED_AREA &&
          !overlapsAny(gap, panels)) {
        inferred.push(gap);
      }
    }

    // Check left side: is there uncovered space to the left of this panel?
    if (panel.x > 0.25) {
      const gap: RawPanel = {
        x: PAGE_MARGIN,
        y: panel.y,
        width: panel.x - PAGE_MARGIN,
        height: panel.height,
        confidence: 0.5,
      };
      if (gap.width > 0.15 && gap.width * gap.height >= MIN_INFERRED_AREA &&
          !overlapsAny(gap, panels)) {
        inferred.push(gap);
      }
    }
  }

  // Merge vertically adjacent inferred panels that share similar X ranges.
  // This handles cases where a single borderless panel spans multiple rows.
  const merged = mergeAdjacentGaps(inferred);

  // Deduplicate merged panels against detected panels
  const unique: RawPanel[] = [];
  for (const gap of merged) {
    if (!overlapsAny(gap, [...panels, ...unique])) {
      unique.push(gap);
    }
  }

  return [...panels, ...unique];
}

/**
 * Merge vertically adjacent inferred gaps that share similar X positions.
 * Two gaps are merged if their X ranges overlap significantly and they are
 * vertically adjacent (gap between them < 5% of page height).
 */
function mergeAdjacentGaps(gaps: RawPanel[]): RawPanel[] {
  if (gaps.length <= 1) return gaps;

  const merged: RawPanel[] = [...gaps];
  let didMerge = true;

  while (didMerge) {
    didMerge = false;
    for (let i = 0; i < merged.length; i++) {
      for (let j = i + 1; j < merged.length; j++) {
        const a = merged[i];
        const b = merged[j];

        // Check X ranges overlap significantly (within 5% tolerance)
        const xOverlap = Math.abs(a.x - b.x) < 0.05 &&
          Math.abs((a.x + a.width) - (b.x + b.width)) < 0.05;

        if (!xOverlap) continue;

        // Check vertically adjacent (small gap or touching)
        const aBottom = a.y + a.height;
        const bBottom = b.y + b.height;
        const vertGap = Math.max(0, Math.max(a.y, b.y) - Math.min(aBottom, bBottom));

        if (vertGap > 0.05) continue;

        // Merge: combine into one panel spanning both
        const newY = Math.min(a.y, b.y);
        const newBottom = Math.max(aBottom, bBottom);
        merged[i] = {
          x: Math.min(a.x, b.x),
          y: newY,
          width: Math.max(a.x + a.width, b.x + b.width) - Math.min(a.x, b.x),
          height: newBottom - newY,
          confidence: 0.5,
        };
        merged.splice(j, 1);
        didMerge = true;
        break;
      }
      if (didMerge) break;
    }
  }

  return merged;
}

/**
 * Check if a candidate panel significantly overlaps any existing panel.
 */
function overlapsAny(candidate: RawPanel, panels: RawPanel[]): boolean {
  for (const p of panels) {
    const overlapX = Math.max(0,
      Math.min(candidate.x + candidate.width, p.x + p.width) - Math.max(candidate.x, p.x)
    );
    const overlapY = Math.max(0,
      Math.min(candidate.y + candidate.height, p.y + p.height) - Math.max(candidate.y, p.y)
    );
    const overlapArea = overlapX * overlapY;
    const candidateArea = candidate.width * candidate.height;
    const existingArea = p.width * p.height;

    // Check overlap from BOTH sides:
    // 1. Does a significant portion of the candidate overlap with an existing panel?
    // 2. Does a significant portion of an existing panel fall inside the candidate?
    if (candidateArea > 0 && overlapArea / candidateArea > 0.3) {
      return true;
    }
    if (existingArea > 0 && overlapArea / existingArea > 0.3) {
      return true;
    }
  }
  return false;
}

function classifyPage(panels: RawPanel[]): PageType {
  if (panels.length === 0) return 'blank';
  if (panels.length === 1) {
    const area = panels[0].width * panels[0].height;
    return area >= 0.9 ? 'full-bleed' : 'cover';
  }
  return 'panels';
}
