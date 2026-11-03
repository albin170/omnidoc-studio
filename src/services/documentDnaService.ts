import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import * as XLSX from 'xlsx';
import { 
  DocumentDnaProfile, 
  DnaComparisonResult, 
  DnaFinding, 
  FileFormat 
} from '../types';
import { validateFileFormat } from './formatDetector';

/**
 * Compute SHA-256 checksum of File or Blob bytes
 */
export async function computeFileHash(blob: Blob | File): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback hash for environments without SubtleCrypto
  let hash = 0;
  const uint8 = new Uint8Array(arrayBuffer);
  for (let i = 0; i < uint8.length; i++) {
    hash = ((hash << 5) - hash) + uint8[i];
    hash |= 0;
  }
  return `sha256-fallback-${Math.abs(hash).toString(16)}`;
}

/**
 * Generate structural Document DNA fingerprint for any supported document
 */
export async function generateDocumentDna(file: File | Blob, fileName = 'document'): Promise<DocumentDnaProfile> {
  const fileObj = file instanceof File ? file : new File([file], fileName);
  const detected = await validateFileFormat(fileObj);
  const format: FileFormat = detected.format || 'txt';
  const sha256 = await computeFileHash(file);
  const sizeBytes = file.size;

  const profile: DocumentDnaProfile = {
    fileName,
    format,
    sha256,
    sizeBytes,
    wordCount: 0,
    characterCount: 0,
    pageOrSheetCount: 1,
    headingCount: 0,
    tableCount: 0,
    tableDimensions: [],
    imageCount: 0,
    formulaCount: 0,
    headings: [],
    metadata: {},
  };

  try {
    if (format === 'docx') {
      await inspectDocxDna(file, profile);
    } else if (format === 'xlsx' || format === 'csv') {
      await inspectXlsxDna(file, profile, format);
    } else if (format === 'pptx') {
      await inspectPptxDna(file, profile);
    } else if (format === 'pdf') {
      await inspectPdfDna(file, profile);
    } else {
      await inspectTextDna(file, profile);
    }
  } catch (err) {
    console.warn('Error during detailed DNA extraction, using baseline:', err);
  }

  return profile;
}

async function inspectDocxDna(file: Blob, profile: DocumentDnaProfile): Promise<void> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const docXml = zip.file('word/document.xml');

  if (docXml) {
    const text = await docXml.async('text');
    // Count images in DOCX
    const images = Object.keys(zip.files).filter((k) => k.startsWith('word/media/'));
    profile.imageCount = images.length;

    // Count tables in DOCX
    const tableMatches = text.match(/<w:tbl[\s>]/g) || [];
    profile.tableCount = tableMatches.length;

    const rowMatches = text.match(/<w:tr[\s>]/g) || [];
    const cellMatches = text.match(/<w:tc[\s>]/g) || [];
    if (profile.tableCount > 0) {
      const avgRows = Math.max(1, Math.round(rowMatches.length / profile.tableCount));
      const avgCols = Math.max(1, Math.round(cellMatches.length / Math.max(1, rowMatches.length)));
      profile.tableDimensions = [{ rows: avgRows, cols: avgCols }];
    }

    // Extract text runs
    const tMatches = Array.from(text.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/gs)).map((m) => m[1]);
    const plainText = tMatches.join(' ');
    profile.characterCount = plainText.length;
    profile.wordCount = plainText.trim().split(/\s+/).filter(Boolean).length;

    // Extract headings
    const headingMatches = Array.from(
      text.matchAll(/<w:pStyle[^>]*w:val="Heading(\d+)"[^>]*>.*?<w:t[^>]*>(.*?)<\/w:t>/gs)
    ).map((m) => m[2]);
    profile.headings = headingMatches.slice(0, 10);
    profile.headingCount = headingMatches.length;
  }
}

async function inspectXlsxDna(file: Blob, profile: DocumentDnaProfile, format: FileFormat): Promise<void> {
  const buffer = await file.arrayBuffer();
  if (format === 'csv') {
    const text = new TextDecoder().decode(buffer);
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    profile.pageOrSheetCount = 1;
    profile.tableCount = 1;
    const maxCols = Math.max(...lines.map((l) => l.split(',').length));
    profile.tableDimensions = [{ rows: lines.length, cols: maxCols }];
    profile.characterCount = text.length;
    profile.wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    return;
  }

  const wb = XLSX.read(buffer, { type: 'array' });
  profile.pageOrSheetCount = wb.SheetNames.length;
  profile.tableCount = wb.SheetNames.length;

  let totalFormulas = 0;
  let totalWords = 0;
  let totalChars = 0;

  wb.SheetNames.forEach((name) => {
    const ws = wb.Sheets[name];
    if (ws) {
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      profile.tableDimensions.push({ rows: data.length, cols: data[0]?.length || 0 });
      Object.keys(ws).forEach((cellKey) => {
        if (!cellKey.startsWith('!')) {
          const cell = ws[cellKey];
          if (cell && cell.f) totalFormulas++;
          if (cell && cell.v !== undefined) {
            const strVal = String(cell.v);
            totalChars += strVal.length;
            totalWords += strVal.split(/\s+/).filter(Boolean).length;
          }
        }
      });
    }
  });

  profile.formulaCount = totalFormulas;
  profile.wordCount = totalWords;
  profile.characterCount = totalChars;
}

async function inspectPptxDna(file: Blob, profile: DocumentDnaProfile): Promise<void> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slides = Object.keys(zip.files).filter((k) => k.startsWith('ppt/slides/slide') && k.endsWith('.xml'));
  profile.pageOrSheetCount = slides.length;

  const images = Object.keys(zip.files).filter((k) => k.startsWith('ppt/media/'));
  profile.imageCount = images.length;

  let totalWords = 0;
  let totalChars = 0;

  for (const s of slides) {
    const xml = await zip.files[s].async('text');
    const tMatches = Array.from(xml.matchAll(/<a:t[^>]*>(.*?)<\/a:t>/gs)).map((m) => m[1]);
    const slideText = tMatches.join(' ');
    totalChars += slideText.length;
    totalWords += slideText.trim().split(/\s+/).filter(Boolean).length;
    if (tMatches[0]) {
      profile.headings.push(tMatches[0].slice(0, 60));
    }
  }

  profile.headingCount = profile.headings.length;
  profile.wordCount = totalWords;
  profile.characterCount = totalChars;
}

async function inspectPdfDna(file: Blob, profile: DocumentDnaProfile): Promise<void> {
  const buffer = await file.arrayBuffer();
  try {
    const pdfDoc = await PDFDocument.load(buffer);
    profile.pageOrSheetCount = pdfDoc.getPageCount();
    profile.metadata = {
      title: pdfDoc.getTitle(),
      author: pdfDoc.getAuthor(),
      creator: pdfDoc.getCreator(),
      createdAt: pdfDoc.getCreationDate()?.toISOString(),
    };
  } catch {
    profile.pageOrSheetCount = 1;
  }

  // Scan raw Latin-1 stream for rough text statistics
  const text = new TextDecoder('latin1').decode(buffer);
  const streamMatches = Array.from(text.matchAll(/stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g)).map((m) => m[1]);
  const sample = streamMatches.join(' ').replace(/[^a-zA-Z0-9\s]/g, ' ');
  profile.characterCount = sample.length;
  profile.wordCount = Math.max(10, sample.trim().split(/\s+/).filter(Boolean).length);

  // Approximate image objects
  const imageMatches = text.match(/\/Subtype\s*\/Image/g) || [];
  profile.imageCount = imageMatches.length;
}

async function inspectTextDna(file: Blob, profile: DocumentDnaProfile): Promise<void> {
  const text = await file.text();
  profile.characterCount = text.length;
  profile.wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const lines = text.split('\n');
  const headers = lines.filter((l) => l.startsWith('#') || (l.trim().length > 3 && l.trim().length < 50 && l.endsWith(':')));
  profile.headingCount = headers.length;
  profile.headings = headers.slice(0, 10).map((h) => h.replace(/^#+\s*/, ''));
}

/**
 * Compare Source and Target Document DNA to detect integrity degradation,
 * lost tables, missing formulas, or truncated text.
 */
export function compareDocumentDna(
  sourceDna: DocumentDnaProfile,
  targetDna: DocumentDnaProfile
): DnaComparisonResult {
  const errors: DnaFinding[] = [];
  const warnings: DnaFinding[] = [];
  const unverifiedProperties: string[] = [];

  let score = 100;

  // 1. Content & Word Count Check
  if (sourceDna.wordCount > 0 && targetDna.wordCount === 0) {
    errors.push({
      severity: 'error',
      category: 'content',
      message: 'Output document contains 0 extracted words! Conversion produced an empty file.',
      expected: sourceDna.wordCount,
      actual: 0,
    });
    score -= 50;
  } else if (sourceDna.wordCount > 20) {
    const ratio = targetDna.wordCount / sourceDna.wordCount;
    if (ratio < 0.6) {
      warnings.push({
        severity: 'warning',
        category: 'content',
        message: `Significant content reduction detected: Output word count is ${Math.round(ratio * 100)}% of source document.`,
        expected: sourceDna.wordCount,
        actual: targetDna.wordCount,
      });
      score -= 20;
    }
  }

  // 2. Table Integrity Check
  if (sourceDna.tableCount > 0 && targetDna.tableCount === 0) {
    // If converted to text/csv, tables might be flattened
    if (targetDna.format === 'txt') {
      warnings.push({
        severity: 'warning',
        category: 'table',
        message: 'Source contained structured tables which were flattened to plain text.',
        expected: sourceDna.tableCount,
        actual: 0,
      });
      score -= 10;
    } else if (targetDna.format !== 'csv') {
      errors.push({
        severity: 'error',
        category: 'table',
        message: `Missing tables: Source contained ${sourceDna.tableCount} table(s) not preserved in output.`,
        expected: sourceDna.tableCount,
        actual: 0,
      });
      score -= 25;
    }
  }

  // 3. Formula Check
  if (sourceDna.formulaCount > 0 && targetDna.formulaCount === 0) {
    warnings.push({
      severity: 'warning',
      category: 'formula',
      message: `${sourceDna.formulaCount} dynamic spreadsheet formula(s) were calculated and frozen to static values in target format.`,
      expected: sourceDna.formulaCount,
      actual: 0,
    });
    score -= 5;
  }

  // 4. Image Retention Check
  if (sourceDna.imageCount > 0 && targetDna.imageCount === 0 && (targetDna.format === 'docx' || targetDna.format === 'pdf')) {
    warnings.push({
      severity: 'warning',
      category: 'image',
      message: `Source document had ${sourceDna.imageCount} image(s) that were omitted during conversion.`,
      expected: sourceDna.imageCount,
      actual: 0,
    });
    score -= 15;
  }

  // Unverified properties
  unverifiedProperties.push('Font kerning and typographic rendering');
  unverifiedProperties.push('Color space chromatic fidelity');
  if (targetDna.format === 'pdf') {
    unverifiedProperties.push('Screen reader accessibility tagging structure');
  }

  const finalScore = Math.max(0, Math.min(100, score));

  let fidelityRating: DnaComparisonResult['fidelityRating'] = 'PRISTINE';
  if (finalScore < 50) fidelityRating = 'DEGRADED';
  else if (finalScore < 75) fidelityRating = 'MODERATE';
  else if (finalScore < 95) fidelityRating = 'HIGH';

  return {
    sourceDna,
    targetDna,
    integrityScore: finalScore,
    fidelityScore: finalScore,
    summary: `${fidelityRating} fidelity (${finalScore}/100)`,
    errors,
    warnings,
    unverifiedProperties,
    fidelityRating,
  };
}
