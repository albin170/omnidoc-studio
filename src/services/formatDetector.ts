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
    allowedConversions: ['docx', 'txt', 'png', 'jpg', 'pptx'],
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
    allowedConversions: ['pdf', 'png'],
  },
  xlsx: {
    format: 'xlsx',
    label: 'Excel Spreadsheet',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    category: 'spreadsheet',
    color: '#16a34a',
    allowedConversions: ['csv', 'pdf', 'html'],
  },
  csv: {
    format: 'csv',
    label: 'CSV Data',
    mimeType: 'text/csv',
    category: 'spreadsheet',
    color: '#059669',
    allowedConversions: ['xlsx', 'pdf', 'txt'],
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
    color: '#6366f1',
    allowedConversions: ['pdf', 'docx', 'html', 'txt'],
  },
};

/**
 * Detect format from file name and inspect header bytes
 */
export async function detectFileFormat(file: File): Promise<FileFormat | null> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  
  // Try extension mapping first
  const extMap: Record<string, FileFormat> = {
    pdf: 'pdf',
    docx: 'docx',
    doc: 'docx',
    pptx: 'pptx',
    ppt: 'pptx',
    xlsx: 'xlsx',
    xls: 'xlsx',
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

  const extensionMatch = ext ? extMap[ext] : null;

  // Verify magic bytes if possible
  try {
    const slice = await file.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(slice);

    // PDF magic bytes: %PDF (0x25 0x50 0x44 0x46)
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return 'pdf';
    }

    // PNG magic bytes: 0x89 0x50 0x4E 0x47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return 'png';
    }

    // JPEG magic bytes: 0xFF 0xD8 0xFF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'jpg';
    }

    // WEBP: RIFF...WEBP
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      return 'webp';
    }

    // ZIP based (DOCX / PPTX / XLSX): 0x50 0x4B 0x03 0x04
    if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
      return extensionMatch || 'docx';
    }
  } catch (err) {
    console.warn('Magic byte inspection skipped:', err);
  }

  return extensionMatch || null;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
