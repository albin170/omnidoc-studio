import JSZip from 'jszip';
import { FileFormat } from '../types';
import { validateFileFormat } from './formatDetector';

export interface DetailedValidationResult {
  valid: boolean;
  format: FileFormat | null;
  error?: string;
  isEncrypted?: boolean;
  warnings?: string[];
  metadata?: {
    pageCount?: number;
    sheetCount?: number;
    slideCount?: number;
    wordCount?: number;
  };
}

/**
 * Deep structural validation for documents and archives.
 * Validates beyond file headers by inspecting actual package contents,
 * detecting encrypted files, malformed XML, and truncated documents.
 */
export async function validateDocumentStructure(file: File): Promise<DetailedValidationResult> {
  // Step 1: Base magic byte signature & extension check
  const baseResult = await validateFileFormat(file);
  if (!baseResult.valid || !baseResult.format) {
    return {
      valid: false,
      format: null,
      error: baseResult.error || `File "${file.name}" has an unrecognized or unsupported format.`,
    };
  }

  const format = baseResult.format;

  // Step 2: Format-specific structural integrity verification
  try {
    if (format === 'docx' || format === 'pptx' || format === 'xlsx') {
      return await validateOpenXmlPackage(file, format);
    }

    if (format === 'pdf') {
      return await validatePdfStructure(file);
    }

    if (format === 'txt' || format === 'md' || format === 'html' || format === 'csv') {
      return await validateTextDocument(file, format);
    }

    // Default for validated images
    return { valid: true, format };
  } catch (err: any) {
    return {
      valid: false,
      format,
      error: `Document "${file.name}" is corrupted or cannot be safely parsed: ${err?.message || 'Invalid structure'}`,
    };
  }
}

/**
 * Validates OpenXML Office ZIP packages (DOCX, PPTX, XLSX)
 */
async function validateOpenXmlPackage(file: File, format: FileFormat): Promise<DetailedValidationResult> {
  let zip: JSZip;
  try {
    const arrayBuffer = await file.arrayBuffer();
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch (err: any) {
    return {
      valid: false,
      format,
      error: `File "${file.name}" is not a valid ZIP archive. The file may be truncated or corrupted.`,
    };
  }

  // Detect Password-Protected Office files (EncryptedPackage or EncryptionInfo stream)
  const isEncrypted = Boolean(zip.file('EncryptedPackage') || zip.file('EncryptionInfo'));
  if (isEncrypted) {
    return {
      valid: false,
      format,
      isEncrypted: true,
      error: `File "${file.name}" is password-protected or encrypted. Please remove encryption before converting.`,
    };
  }

  // Check required [Content_Types].xml
  const contentTypes = zip.file('[Content_Types].xml');
  if (!contentTypes) {
    return {
      valid: false,
      format,
      error: `Malformed OpenXML package: missing "[Content_Types].xml".`,
    };
  }

  if (format === 'docx') {
    const docXml = zip.file('word/document.xml');
    if (!docXml) {
      return {
        valid: false,
        format,
        error: `Invalid DOCX document: missing "word/document.xml" entry.`,
      };
    }
    const xmlText = await docXml.async('text');
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const parsedDoc = parser.parseFromString(xmlText, 'text/xml');
      if (parsedDoc.getElementsByTagName('parsererror').length > 0) {
        return {
          valid: false,
          format,
          error: `Malformed DOCX document: internal XML syntax is corrupted.`,
        };
      }
    } else {
      if (!xmlText.includes('<w:document') && !xmlText.includes('<document')) {
        return {
          valid: false,
          format,
          error: `Malformed DOCX document: missing <w:document> root node.`,
        };
      }
    }
    return { valid: true, format: 'docx' };
  }

  if (format === 'pptx') {
    const presXml = zip.file('ppt/presentation.xml');
    if (!presXml) {
      return {
        valid: false,
        format,
        error: `Invalid PPTX presentation: missing "ppt/presentation.xml" entry.`,
      };
    }
    const slides = Object.keys(zip.files).filter((k) => k.startsWith('ppt/slides/slide') && k.endsWith('.xml'));
    return {
      valid: true,
      format: 'pptx',
      metadata: { slideCount: slides.length },
    };
  }

  if (format === 'xlsx') {
    const wbXml = zip.file('xl/workbook.xml');
    if (!wbXml) {
      return {
        valid: false,
        format,
        error: `Invalid XLSX spreadsheet: missing "xl/workbook.xml" entry.`,
      };
    }
    const sheets = Object.keys(zip.files).filter((k) => k.startsWith('xl/worksheets/sheet') && k.endsWith('.xml'));
    return {
      valid: true,
      format: 'xlsx',
      metadata: { sheetCount: sheets.length },
    };
  }

  return { valid: true, format };
}

/**
 * Validates PDF document structure and detects encryption/password protection
 */
async function validatePdfStructure(file: File): Promise<DetailedValidationResult> {
  const buffer = await file.arrayBuffer();
  const text = new TextDecoder('latin1').decode(buffer);

  // Check for encrypted / password protected PDF dictionary
  if (text.includes('/Encrypt')) {
    return {
      valid: false,
      format: 'pdf',
      isEncrypted: true,
      error: `PDF "${file.name}" is password-protected (/Encrypt dictionary detected). Please provide an unlocked document.`,
    };
  }

  // Ensure PDF has catalog root or trailer table
  if (!text.includes('/Root') && !text.includes('trailer') && !text.includes('%%EOF')) {
    return {
      valid: false,
      format: 'pdf',
      error: `PDF "${file.name}" is truncated or lacks a valid trailer table.`,
    };
  }

  return { valid: true, format: 'pdf' };
}

/**
 * Validates text-based files ensuring they don't contain corrupt binary null bytes
 */
async function validateTextDocument(file: File, format: FileFormat): Promise<DetailedValidationResult> {
  const buffer = await file.slice(0, 4096).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Check for binary null-byte sequences which indicate executable or non-text binaries
  let nullCount = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) nullCount++;
  }

  if (nullCount > 2) {
    return {
      valid: false,
      format,
      error: `File "${file.name}" contains binary byte sequences and is not valid plain text.`,
    };
  }

  return { valid: true, format };
}

/**
 * Convenience alias for package-level validation
 */
export async function validateDocumentPackage(file: File): Promise<{ valid: boolean; message?: string }> {
  const result = await validateDocumentStructure(file);
  return {
    valid: result.valid,
    message: result.error || 'Validated successfully',
  };
}
