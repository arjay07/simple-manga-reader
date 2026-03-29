export type DetectionMethod = 'contour' | 'ml';

export type PageType = 'panels' | 'cover' | 'full-bleed' | 'blank';

export interface Panel {
  id: string;
  readingOrder: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface ReadingTreeLeaf {
  panel: string; // panel id
}

export interface ReadingTreeBranch {
  cut: 'horizontal' | 'vertical';
  at: number; // normalized 0-1 position of the cut
  top?: ReadingTreeNode;
  bottom?: ReadingTreeNode;
  left?: ReadingTreeNode;
  right?: ReadingTreeNode;
}

export type ReadingTreeNode = ReadingTreeLeaf | ReadingTreeBranch;

export interface DetectionResult {
  panels: Panel[];
  readingTree: ReadingTreeNode | null;
  pageType: PageType;
  processingTimeMs: number;
  method: DetectionMethod;
}

export interface PanelDetectRequest {
  seriesId: string;
  volumeId: string;
  page: number;
  methods: DetectionMethod[];
}

export interface PanelDetectResponse {
  results: Partial<Record<DetectionMethod, DetectionResult>>;
  pageImage: string; // base64 encoded
  imageWidth: number;
  imageHeight: number;
}

// Raw panel before reading order is assigned
export interface RawPanel {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}
