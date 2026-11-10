import { FileFormat } from '../types';

export interface FormatMetadata {
  format: FileFormat;
  label: string;
  mimeType: string;
  category: 'document' | 'presentation' | 'spreadsheet' | 'image' | 'text';
  color: string;
  allowedConversions: FileFormat[];
}

export const FORMAT_REGISTRY: Record<FileFormat, FormatMetadata> = {
  pdf: {
    format: 'pdf',
    label: 'Adobe PDF',
    mimeType: 'application/pdf',
    category: 'document',
    color: '#ef4444',
    allowedConversions: ['docx', 'txt', 'png', 'jpg', 'pptx', 'pdf'],
  },
  docx: {
    format: 'docx',
    label: 'Word Document',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    category: 'document',
    color: '#2563eb',
    allowedConversions: ['pdf', 'txt', 'html'],
  },
  pptx: {
    format: 'pptx',
    label: 'PowerPoint Presentation',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    category: 'presentation',
    color: '#ea580c',
    allowedConversions: ['pdf', 'png', 'jpg', 'docx', 'txt'],
  },
  xlsx: {
    format: 'xlsx',
    label: 'Excel Spreadsheet',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    category: 'spreadsheet',
    color: '#16a34a',
    allowedConversions: ['csv', 'pdf', 'html', 'txt'],
  },
  csv: {
    format: 'csv',
    label: 'CSV Data',
    mimeType: 'text/csv',
    category: 'spreadsheet',
    color: '#059669',
    allowedConversions: ['xlsx', 'pdf', 'txt', 'html'],
  },
  png: {
    format: 'png',
    label: 'PNG Image',
    mimeType: 'image/png',
    category: 'image',
    color: '#06b6d4',
    allowedConversions: ['pdf', 'jpg', 'webp'],
  },
  jpg: {
    format: 'jpg',
    label: 'JPEG Image',
    mimeType: 'image/jpeg',
    category: 'image',
    color: '#3b82f6',
    allowedConversions: ['pdf', 'png', 'webp'],
  },
  webp: {
    format: 'webp',
    label: 'WebP Image',
    mimeType: 'image/webp',
    category: 'image',
    color: '#8b5cf6',
    allowedConversions: ['pdf', 'png', 'jpg'],
  },
  txt: {
    format: 'txt',
    label: 'Plain Text',
    mimeType: 'text/plain',
    category: 'text',
    color: '#64748b',
    allowedConversions: ['pdf', 'docx', 'html'],
  },
  html: {
    format: 'html',
    label: 'HTML Document',
    mimeType: 'text/html',
    category: 'text',
    color: '#f59e0b',
    allowedConversions: ['pdf', 'docx', 'txt'],
  },
  md: {
    format: 'md',
    label: 'Markdown Note',
    mimeType: 'text/markdown',
    category: 'text',
    color: '#FF3366',
    allowedConversions: ['pdf', 'docx', 'html', 'txt'],
  },
};

export interface FileValidationResult {
  valid: boolean;
  format: FileFormat | null;
  error?: string;
  isLegacyOffice?: boolean;
}

/**
 * Modern supported extensions mapping (Strictly modern OpenXML, standard media, text)
 */
const EXT_MAP: Record<string, FileFormat> = {
  pdf: 'pdf',
  docx: 'docx',
  pptx: 'pptx',
  xlsx: 'xlsx',
  csv: 'csv',
  png: 'png',
  jpg: 'jpg',
  jpeg: 'jpg',
  webp: 'webp',
  txt: 'txt',
  html: 'html',
  htm: 'html',
  md: 'md',
  markdown: 'md',
};

const LEGACY_OFFICE_EXTENSIONS = ['doc', 'ppt', 'xls', 'dot', 'pot', 'xlt'];

/**
 * Validate file content against its claimed extension using magic header bytes.
 * Detects legacy binary formats, content mismatches, and malformed files.
 */
export async function validateFileFormat(file: File): Promise<FileValidationResult> {
  if (!file || file.size === 0) {
    return {
      valid: false,
      format: null,
      error: `File "${file?.name || 'unknown'}" is empty (0 bytes).`,
    };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  // 1. Explicitly catch legacy Office extensions
  if (LEGACY_OFFICE_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      format: null,
      isLegacyOffice: true,
      error: `Legacy binary Office format (.${ext}) is not supported. Please convert or resave as modern OpenXML (.docx, .pptx, .xlsx).`,
    };
  }

  let headerBytes: Uint8Array = new Uint8Array(0);
  try {
    const slice = await file.slice(0, 16).arrayBuffer();
    headerBytes = new Uint8Array(slice);
  } catch {
    // If reading slice fails, return error
    return {
      valid: false,
      format: null,
      error: `Could not read header of "${file.name}".`,
    };
  }

  // 2. Check for legacy OLE2 compound binary signature: 0xD0 0xCF 0x11 0xE0 0xA1 0xB1 0x1A 0xE1
  if (
    headerBytes.length >= 4 &&
    headerBytes[0] === 0xd0 &&
    headerBytes[1] === 0xcf &&
    headerBytes[2] === 0x11 &&
    headerBytes[3] === 0xe0
  ) {
    return {
      valid: false,
      format: null,
      isLegacyOffice: true,
      error: `File "${file.name}" is a legacy binary compound document (OLE2). Only modern OpenXML formats (.docx, .pptx, .xlsx) are supported.`,
    };
  }

  // 3. Extension-specific magic byte verification
  if (ext === 'pdf') {
    const isPdf =
      headerBytes.length >= 4 &&
      headerBytes[0] === 0x25 && // %
      headerBytes[1] === 0x50 && // P
      headerBytes[2] === 0x44 && // D
      headerBytes[3] === 0x46;   // F
    if (!isPdf) {
      return {
        valid: false,
        format: null,
        error: `File "${file.name}" has a .pdf extension but lacks the required %PDF- header signature.`,
      };
    }
    return { valid: true, format: 'pdf' };
  }

  if (ext === 'png') {
    const isPng =
      headerBytes.length >= 4 &&
      headerBytes[0] === 0x89 &&
      headerBytes[1] === 0x50 &&
      headerBytes[2] === 0x4e &&
      headerBytes[3] === 0x47;
    if (!isPng) {
      return {
        valid: false,
        format: null,
        error: `File "${file.name}" has a .png extension but lacks the valid PNG magic signature.`,
      };
    }
    return { valid: true, format: 'png' };
  }

  if (ext === 'jpg' || ext === 'jpeg') {
    const isJpg =
      headerBytes.length >= 3 &&
      headerBytes[0] === 0xff &&
      headerBytes[1] === 0xd8 &&
      headerBytes[2] === 0xff;
    if (!isJpg) {
      return {
        valid: false,
        format: null,
        error: `File "${file.name}" has a .${ext} extension but lacks the valid JPEG Start of Image (SOI) signature.`,
      };
    }
    return { valid: true, format: 'jpg' };
  }

  if (ext === 'webp') {
    // WebP must have 'RIFF' at bytes 0..3 AND 'WEBP' at bytes 8..11
    const hasRiff =
      headerBytes.length >= 12 &&
      headerBytes[0] === 0x52 && // R
      headerBytes[1] === 0x49 && // I
      headerBytes[2] === 0x46 && // F
      headerBytes[3] === 0x46;   // F
    const hasWebp =
      headerBytes.length >= 12 &&
      headerBytes[8] === 0x57 && // W
      headerBytes[9] === 0x45 && // E
      headerBytes[10] === 0x42 && // B
      headerBytes[11] === 0x50;  // P

    if (!hasRiff || !hasWebp) {
      return {
        valid: false,
        format: null,
        error: `File "${file.name}" is not a valid WebP image (missing RIFF/WEBP container signature).`,
      };
    }
    return { valid: true, format: 'webp' };
  }

  // OpenXML formats must be standard ZIP archives starting with PK\x03\x04
  if (ext === 'docx' || ext === 'pptx' || ext === 'xlsx') {
    const isZip =
      headerBytes.length >= 4 &&
      headerBytes[0] === 0x50 && // P
      headerBytes[1] === 0x4b && // K
      headerBytes[2] === 0x03 &&
      headerBytes[3] === 0x04;
    if (!isZip) {
      return {
        valid: false,
        format: null,
        error: `File "${file.name}" is claimed to be a .${ext} document but is not a valid OpenXML ZIP package.`,
      };
    }
    return { valid: true, format: ext as FileFormat };
  }

  // Text-based formats (txt, html, csv, md)
  if (EXT_MAP[ext]) {
    return { valid: true, format: EXT_MAP[ext] };
  }

  return {
    valid: false,
    format: null,
    error: `Unsupported file format ".${ext || 'unknown'}". OmniDoc supports PDF, DOCX, PPTX, XLSX, CSV, PNG, JPG, WEBP, TXT, HTML, and MD.`,
  };
}

/**
 * Detect format from file name and inspect header bytes
 */
export async function detectFileFormat(file: File): Promise<FileFormat | null> {
  const validation = await validateFileFormat(file);
  return validation.valid ? validation.format : null;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
