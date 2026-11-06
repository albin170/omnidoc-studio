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
  | 'autonomous'
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
  | 'admin'
  | 'workflow'
  | 'pricing';

export type ProcessingMode = 'local' | 'hybrid' | 'cloud';

export interface AutonomousPlanNode {
  id: string;
  toolName: string;
  description: string;
  arguments: Record<string, any>;
  dependsOn: string[];
  status: 'pending' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'skipped';
  requiresApproval: boolean;
  result?: Record<string, any>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface AutonomousExecutionPlan {
  planId: string;
  objective: string;
  nodes: AutonomousPlanNode[];
  estimatedDurationSeconds: number;
  isValidDag: boolean;
}

export interface ExtractedEvidenceField {
  fieldName: string;
  value: any;
  status: 'confirmed' | 'inferred' | 'missing';
  confidence: number;
  pageNumber: number;
  bbox?: { x: number; y: number; width: number; height: number };
  validationFlags?: string[];
}

export interface AutonomousJob {
  id: string;
  title: string;
  objective: string;
  status: 'pending' | 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';
  mode: ProcessingMode;
  plan: AutonomousExecutionPlan;
  currentStepIndex: number;
  totalSteps: number;
  uploadedFiles?: File[];
  remoteJobId?: string;
  extractedFields?: Record<string, ExtractedEvidenceField>;
  generatedArtifacts?: { name: string; type: string; downloadUrl?: string; blob?: Blob }[];
  verificationReport?: {
    verified: boolean;
    checksumMatched: boolean;
    reopenedCleanly: boolean;
    pageCountMatched: boolean;
    notes: string;
  };
  createdAt: string;
}

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
  signal?: AbortSignal;
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
export interface PdfTextItem {
  id: string;
  str: string;
  pdfX: number;
  pdfY: number;
  viewportX: number;
  viewportY: number;
  width: number;
  height: number;
  fontSize: number;
  fontName?: string;
}

export interface PdfTextEdit {
  id: string;
  pageIndex: number; // 0-based
  originalText: string;
  newText: string;
  pdfX: number;
  pdfY: number;
  width: number;
  height: number;
  fontSize?: number;
  fontColor?: string;
  fontFamily?: 'Helvetica' | 'TimesRoman' | 'Courier';
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  isRedaction?: boolean;
  isDeleted?: boolean;
}

export interface PDFAnnotation {
  id: string;
  pageIndex: number;
  type: 'text' | 'watermark' | 'redact' | 'signature' | 'highlight' | 'underline' | 'strikethrough' | 'rectangle' | 'line' | 'comment' | 'image';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  color?: string;
  opacity?: number;
  rotation?: number;
  dataUrl?: string; // for drawn signatures / stamps / images
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

// OmniDoc Studio v2.0 Platform & Advanced Intelligence Types
export type StorageMode = 'local' | 'cloud';

export interface ProjectVersion {
  versionId: string;
  projectId: string;
  timestamp: number;
  title: string;
  note?: string;
  data: any;
  authorEmail?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  action: string;
  userEmail: string;
  details: string;
  severity: 'info' | 'warn' | 'critical';
}

export interface DiffToken {
  type: 'add' | 'del' | 'same';
  text: string;
}

export interface DiffResult {
  oldTitle: string;
  newTitle: string;
  tokens: DiffToken[];
  stats: {
    additions: number;
    deletions: number;
    unchanged: number;
  };
}

export interface AiCitation {
  pageNumber?: number;
  paragraphIndex?: number;
  sectionLabel?: string;
  snippet: string;
}

export interface AiAssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  citations?: AiCitation[];
  suggestedActions?: string[];
}

export interface BatchJobItem {
  file: File;
  targetFormat: FileFormat;
  status: 'pending' | 'processing' | 'done' | 'failed';
  error?: string;
  resultBlob?: Blob;
  outputName?: string;
}

// -------------------------------------------------------------
// OmniDoc Studio Engineering Platform Types (v2.1 Innovation)
// -------------------------------------------------------------

// Feature 1: Document DNA
export interface DocumentDnaProfile {
  fileName: string;
  format: FileFormat;
  sha256: string;
  sizeBytes: number;
  wordCount: number;
  characterCount: number;
  pageOrSheetCount: number;
  headingCount: number;
  tableCount: number;
  tableDimensions: { rows: number; cols: number }[];
  imageCount: number;
  formulaCount: number;
  headings: string[];
  metadata: {
    title?: string;
    author?: string;
    creator?: string;
    createdAt?: string;
  };
}

export interface DnaFinding {
  severity: 'error' | 'warning' | 'info';
  category: 'content' | 'table' | 'formula' | 'layout' | 'image' | 'metadata';
  message: string;
  expected?: string | number;
  actual?: string | number;
}

export interface DnaComparisonResult {
  sourceDna: DocumentDnaProfile;
  targetDna: DocumentDnaProfile;
  integrityScore: number; // 0 - 100 heuristic fidelity metric
  fidelityScore: number;
  summary?: string;
  errors: DnaFinding[];
  warnings: DnaFinding[];
  unverifiedProperties: string[];
  fidelityRating: 'PRISTINE' | 'HIGH' | 'MODERATE' | 'DEGRADED';
}

// Feature 2: Self-Healing Conversion
export interface SelfHealingResult {
  primarySuccess: boolean;
  recoveryAttempted: boolean;
  recovered?: boolean;
  strategyUsed: 'primary' | 'structured_fallback' | 'compact_table_scaling' | 'none';
  proposedRepairDescription?: string;
  beforeScore?: number;
  afterScore?: number;
  outputBlob: Blob;
  outputFileName: string;
  receiptId?: string;
  primaryBlob?: Blob;
  healedBlob?: Blob;
  scoreDifference?: number;
}

// Feature 3: Visual Workflow Engine
export type WorkflowNodeType = 
  | 'upload' 
  | 'detect' 
  | 'dna' 
  | 'validate' 
  | 'forensics' 
  | 'convert' 
  | 'verify' 
  | 'receipt' 
  | 'export';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  title: string;
  config: Record<string, any>;
  x: number;
  y: number;
  status: 'idle' | 'running' | 'completed' | 'error' | 'skipped';
  error?: string;
}

export interface WorkflowEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  updatedAt: number;
}

// Feature 4: Document Data Lineage
export interface LineageFieldNode {
  id: string;
  fieldName: string;
  extractedValue: string | number;
  sourceFile: string;
  sourceFileHash: string;
  pageNumber?: number;
  contextSnippet: string;
  confidence: number; // 0.0 - 1.0 measurable metric
  transformations: string[];
  isFlaggedForReview: boolean;
}

export interface LineageManifest {
  documentTitle: string;
  documentHash: string;
  generatedAt: number;
  fields: LineageFieldNode[];
}

// Feature 5: Document Forensics
export interface ForensicsFinding {
  id: string;
  level: 'INFO' | 'WARNING' | 'HIGH_RISK';
  rule: string;
  description: string;
  technicalDetails?: string;
}

export interface ForensicsReport {
  fileName: string;
  declaredExtension: string;
  actualFormat: string | null;
  fileSizeBytes: number;
  sha256: string;
  findings: ForensicsFinding[];
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  inspectedAt: number;
  metadataSummary: Record<string, string>;
  embeddedResourcesCount: number;
}

// Feature 6: Transformation Receipts
export interface TransformationReceipt {
  receiptId: string;
  timestamp: string; // ISO-8601
  source: {
    fileName: string;
    format: FileFormat;
    sizeBytes: number;
    sha256: string;
  };
  target: {
    fileName: string;
    format: FileFormat;
    sizeBytes: number;
    sha256: string;
  };
  toolchain: {
    engine: string;
    version: string;
    libraries: Record<string, string>;
  };
  integrityScore: number;
  warningCount: number;
  errorCount: number;
  executionDurationMs: number;
  digitalSignature: string;
  signatureAlgorithm?: string;
  verified?: boolean;
}


