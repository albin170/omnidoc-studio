export type FileFormat = 
  | 'pdf' 
  | 'docx' 
  | 'pptx' 
  | 'xlsx' 
  | 'csv' 
  | 'png' 
  | 'jpg' 
  | 'webp' 
  | 'txt' 
  | 'html' 
  | 'md';

export type WorkspaceTab = 
  | 'dashboard' 
  | 'converter' 
  | 'pdf' 
  | 'docx' 
  | 'slides' 
  | 'sheets' 
  | 'image' 
  | 'ocr' 
  | 'templates' 
  | 'projects' 
  | 'settings'
  | 'admin';

export type JobStatus = 
  | 'queued' 
  | 'validating' 
  | 'processing' 
  | 'verifying' 
  | 'completed' 
  | 'error' 
  | 'cancelled';

export interface ConversionJob {
  id: string;
  sourceFile: File;
  sourceFormat: FileFormat;
  targetFormat: FileFormat;
  status: JobStatus;
  progress: number;
  resultBlob?: Blob;
  resultFileName?: string;
  errorMessage?: string;
  options?: ConversionOptions;
  createdAt: number;
}

export interface ConversionOptions {
  quality?: number; // 0.1 to 1.0
  pageOrientation?: 'portrait' | 'landscape';
  ocrLanguage?: string;
  includeStyles?: boolean;
  slideTheme?: string;
  sheetDelimiter?: string;
  compressionLevel?: 'low' | 'medium' | 'high';
}

export interface StoredProject {
  id: string;
  title: string;
  type: 'pdf' | 'docx' | 'slides' | 'sheets' | 'image' | 'ocr';
  updatedAt: number;
  createdAt: number;
  sizeBytes: number;
  tags?: string[];
  thumbnail?: string;
  data: any;
}

export interface ConversionHistoryItem {
  id: string;
  sourceName: string;
  sourceFormat: FileFormat;
  targetFormat: FileFormat;
  sizeBytes: number;
  completedAt: number;
  downloadUrl?: string;
  status: 'completed' | 'failed';
}

export interface TemplateItem {
  id: string;
  title: string;
  category: 'Documents' | 'Presentations' | 'Spreadsheets' | 'Graphics' | 'PDFs';
  description: string;
  targetWorkspace: WorkspaceTab;
  badge: string;
  previewGradient: string;
  iconName: string;
  payload: any;
}

// PDF Workspace Types
export interface PDFAnnotation {
  id: string;
  pageIndex: number;
  type: 'text' | 'watermark' | 'redact' | 'signature' | 'highlight';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  color?: string;
  opacity?: number;
  rotation?: number;
  dataUrl?: string; // for drawn signatures / stamps
}

// Slide Workspace Types
export interface SlideElement {
  id: string;
  type: 'title' | 'text' | 'shape' | 'image' | 'badge';
  content?: string;
  shapeType?: 'rect' | 'circle' | 'pill' | 'callout';
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontColor?: string;
  bgColor?: string;
  src?: string;
}

export interface SlideItem {
  id: string;
  title: string;
  elements: SlideElement[];
  bgColor: string;
  layout: 'title' | 'content' | 'split' | 'blank';
}

// Spreadsheet Types
export interface SheetCell {
  value: string | number;
  formula?: string;
  style?: {
    bold?: boolean;
    italic?: boolean;
    align?: 'left' | 'center' | 'right';
    bgColor?: string;
    textColor?: string;
  };
}

export type SheetGrid = Record<string, SheetCell>; // e.g. "A1": { value: 10 }

// Image Studio Types
export interface ImageAdjustments {
  brightness: number; // 0 to 200 (100 is normal)
  contrast: number;   // 0 to 200 (100 is normal)
  saturation: number; // 0 to 200 (100 is normal)
  blur: number;       // 0 to 20 px
  grayscale: number;  // 0 to 100%
  sepia: number;      // 0 to 100%
  invert: number;     // 0 to 100%
}

export interface ImageLayer {
  id: string;
  type: 'text' | 'shape' | 'sticker' | 'watermark';
  text?: string;
  fontSize?: number;
  fontColor?: string;
  bgColor?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  stickerType?: string;
}

// OCR Extraction
export interface OCRResult {
  text: string;
  confidence: number;
  language: string;
  processingTimeMs: number;
  wordsCount: number;
  lines: string[];
}
