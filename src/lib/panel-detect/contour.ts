import sharp from 'sharp';
import type { RawPanel, PageType } from './types';

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GutterProjectionResult {
  panels: RawPanel[];
  pageType: PageType;
}

// Minimum gutter width as fraction of page dimension
const MIN_GUTTER_FRACTION = 0.01;
// Minimum percentage of a row/column that must be white to qualify as a gutter
const GUTTER_WHITE_THRESHOLD = 0.85;
// Minimum panel area as fraction of page area
const MIN_PANEL_AREA_FRACTION = 0.02;
// Threshold for blank page (fraction of total pixels that are white)
const BLANK_PAGE_THRESHOLD = 0.95;
// Threshold for full-bleed detection (single panel covering this much of the page)
const FULL_BLEED_THRESHOLD = 0.90;

/**
 * Run contour/gutter-based panel detection on an image buffer.
 */
export async function detectPanelsContour(imageBuffer: Buffer): Promise<{
  panels: RawPanel[];
  pageType: PageType;
  imageWidth: number;
  imageHeight: number;
}> {
  // Convert to grayscale and get raw pixel data
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const imgWidth = metadata.width!;
  const imgHeight = metadata.height!;

  // Grayscale → threshold to binary (white = gutter, black = content)
  // Use a threshold that makes panel borders and art dark, gutters white
  const { data: rawPixels } = await image
    .grayscale()
    .threshold(200)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(rawPixels);

  // Check for blank page
  const whitePixelCount = countWhitePixels(pixels);
  const totalPixels = imgWidth * imgHeight;
  if (whitePixelCount / totalPixels > BLANK_PAGE_THRESHOLD) {
    return {
      panels: [],
      pageType: 'blank',
      imageWidth: imgWidth,
      imageHeight: imgHeight,
    };
  }

  // Find panels via recursive gutter splitting
  const fullRegion: Region = { x: 0, y: 0, width: imgWidth, height: imgHeight };
  const panelRegions = findPanels(pixels, imgWidth, imgHeight, fullRegion);

  // Filter out tiny regions
  const minArea = imgWidth * imgHeight * MIN_PANEL_AREA_FRACTION;
  const validPanels = panelRegions.filter(r => r.width * r.height >= minArea);

  // Normalize to 0-1 coordinates
  const rawPanels: RawPanel[] = validPanels.map(r => ({
    x: r.x / imgWidth,
    y: r.y / imgHeight,
    width: r.width / imgWidth,
    height: r.height / imgHeight,
    confidence: computeGutterConfidence(pixels, imgWidth, imgHeight, r),
  }));

  // Classify page type
  const result = classifyPageType(rawPanels);

  return {
    panels: result.panels,
    pageType: result.pageType,
    imageWidth: imgWidth,
    imageHeight: imgHeight,
  };
}

function countWhitePixels(pixels: Uint8Array): number {
  let count = 0;
  for (let i = 0; i < pixels.length; i++) {
    if (pixels[i] === 255) count++;
  }
  return count;
}

/**
 * Compute horizontal projection: for each row, the fraction of white pixels.
 */
function horizontalProjection(
  pixels: Uint8Array,
  imgWidth: number,
  region: Region
): number[] {
  const projection = new Array(region.height);
  for (let row = 0; row < region.height; row++) {
    let whiteCount = 0;
    const y = region.y + row;
    for (let col = 0; col < region.width; col++) {
      const x = region.x + col;
      if (pixels[y * imgWidth + x] === 255) whiteCount++;
    }
    projection[row] = whiteCount / region.width;
  }
  return projection;
}

/**
 * Compute vertical projection: for each column, the fraction of white pixels.
 */
function verticalProjection(
  pixels: Uint8Array,
  imgWidth: number,
  region: Region
): number[] {
  const projection = new Array(region.width);
  for (let col = 0; col < region.width; col++) {
    let whiteCount = 0;
    const x = region.x + col;
    for (let row = 0; row < region.height; row++) {
      const y = region.y + row;
      if (pixels[y * imgWidth + x] === 255) whiteCount++;
    }
    projection[col] = whiteCount / region.height;
  }
  return projection;
}

interface Gutter {
  start: number; // pixel offset within region
  end: number;
  center: number;
  strength: number; // average white fraction
}

/**
 * Find gutters (contiguous runs of high-white rows/columns) in a 1D projection.
 */
function findGutters(
  projection: number[],
  dimension: number,
  minWidth: number
): Gutter[] {
  const gutters: Gutter[] = [];
  let i = 0;

  while (i < projection.length) {
    if (projection[i] >= GUTTER_WHITE_THRESHOLD) {
      const start = i;
      let sum = 0;
      while (i < projection.length && projection[i] >= GUTTER_WHITE_THRESHOLD) {
        sum += projection[i];
        i++;
      }
      const end = i;
      const width = end - start;
      if (width >= minWidth) {
        gutters.push({
          start,
          end,
          center: Math.floor((start + end) / 2),
          strength: sum / width,
        });
      }
    } else {
      i++;
    }
  }

  // Filter out gutters at the very edges (page margins, not inter-panel gutters)
  const edgeMargin = dimension * 0.03;
  return gutters.filter(g =>
    g.center > edgeMargin && g.center < dimension - edgeMargin
  );
}

/**
 * Recursively split a region along detected gutters to find panels.
 */
function findPanels(
  pixels: Uint8Array,
  imgWidth: number,
  imgHeight: number,
  region: Region,
  depth: number = 0
): Region[] {
  // Prevent infinite recursion
  if (depth > 10) return [region];

  const minGutterH = Math.max(3, Math.floor(region.height * MIN_GUTTER_FRACTION));
  const minGutterV = Math.max(3, Math.floor(region.width * MIN_GUTTER_FRACTION));

  // Try horizontal split first (find rows that are mostly white)
  const hProj = horizontalProjection(pixels, imgWidth, region);
  const hGutters = findGutters(hProj, region.height, minGutterH);

  // Try vertical split
  const vProj = verticalProjection(pixels, imgWidth, region);
  const vGutters = findGutters(vProj, region.width, minGutterV);

  // If no gutters found, this region is a single panel
  if (hGutters.length === 0 && vGutters.length === 0) {
    return [region];
  }

  // Pick the strongest gutter direction to split on
  const bestH = hGutters.length > 0
    ? Math.max(...hGutters.map(g => g.strength))
    : 0;
  const bestV = vGutters.length > 0
    ? Math.max(...vGutters.map(g => g.strength))
    : 0;

  const results: Region[] = [];

  if (bestH >= bestV && hGutters.length > 0) {
    // Split horizontally along all detected gutters
    const splits = [0, ...hGutters.map(g => g.center), region.height];
    for (let i = 0; i < splits.length - 1; i++) {
      const subRegion: Region = {
        x: region.x,
        y: region.y + splits[i],
        width: region.width,
        height: splits[i + 1] - splits[i],
      };
      if (subRegion.height > 10) {
        results.push(...findPanels(pixels, imgWidth, imgHeight, subRegion, depth + 1));
      }
    }
  } else if (vGutters.length > 0) {
    // Split vertically along all detected gutters
    const splits = [0, ...vGutters.map(g => g.center), region.width];
    for (let i = 0; i < splits.length - 1; i++) {
      const subRegion: Region = {
        x: region.x + splits[i],
        y: region.y,
        width: splits[i + 1] - splits[i],
        height: region.height,
      };
      if (subRegion.width > 10) {
        results.push(...findPanels(pixels, imgWidth, imgHeight, subRegion, depth + 1));
      }
    }
  }

  return results.length > 0 ? results : [region];
}

/**
 * Compute confidence based on how well-defined the gutters around a panel are.
 */
function computeGutterConfidence(
  pixels: Uint8Array,
  imgWidth: number,
  imgHeight: number,
  region: Region
): number {
  // Check border whiteness as a proxy for confidence
  let borderWhite = 0;
  let borderTotal = 0;

  // Top border
  if (region.y > 0) {
    const y = region.y;
    for (let x = region.x; x < region.x + region.width; x++) {
      if (pixels[y * imgWidth + x] === 255) borderWhite++;
      borderTotal++;
    }
  }
  // Bottom border
  const bottomY = Math.min(region.y + region.height, imgHeight - 1);
  for (let x = region.x; x < region.x + region.width; x++) {
    if (pixels[bottomY * imgWidth + x] === 255) borderWhite++;
    borderTotal++;
  }
  // Left border
  if (region.x > 0) {
    const x = region.x;
    for (let y = region.y; y < region.y + region.height; y++) {
      if (pixels[y * imgWidth + x] === 255) borderWhite++;
      borderTotal++;
    }
  }
  // Right border
  const rightX = Math.min(region.x + region.width, imgWidth - 1);
  for (let y = region.y; y < region.y + region.height; y++) {
    if (pixels[y * imgWidth + rightX] === 255) borderWhite++;
    borderTotal++;
  }

  return borderTotal > 0 ? Math.round((borderWhite / borderTotal) * 100) / 100 : 0.5;
}

function classifyPageType(panels: RawPanel[]): GutterProjectionResult {
  if (panels.length === 0) {
    return { panels: [], pageType: 'blank' };
  }

  if (panels.length === 1) {
    const p = panels[0];
    const area = p.width * p.height;
    if (area >= FULL_BLEED_THRESHOLD) {
      return { panels, pageType: 'full-bleed' };
    }
    return { panels, pageType: 'cover' };
  }

  return { panels, pageType: 'panels' };
}
