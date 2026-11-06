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

// Pure TypeScript FIPS 180-4 standard compliant SHA-256 implementation
function sha256Fallback(buffer: ArrayBuffer): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));
  const ch = (x: number, y: number, z: number) => (x & y) ^ (~x & z);
  const maj = (x: number, y: number, z: number) => (x & y) ^ (x & z) ^ (y & z);
  const sigma0 = (x: number) => rotr(2, x) ^ rotr(13, x) ^ rotr(22, x);
  const sigma1 = (x: number) => rotr(6, x) ^ rotr(11, x) ^ rotr(25, x);
  const gamma0 = (x: number) => rotr(7, x) ^ rotr(18, x) ^ (x >>> 3);
  const gamma1 = (x: number) => rotr(17, x) ^ rotr(19, x) ^ (x >>> 10);

  const uint8 = new Uint8Array(buffer);
  const len = uint8.length;
  const bitLen = len * 8;
  const padLen = (len % 64 < 56) ? 56 - (len % 64) : 120 - (len % 64);
  const totalLen = len + padLen + 8;
  const padded = new Uint8Array(totalLen);
  padded.set(uint8, 0);
  padded[len] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(totalLen - 4, bitLen >>> 0, false);
  view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let i = 0; i < totalLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = view.getUint32(i + (t * 4), false);
    }
    for (let t = 16; t < 64; t++) {
      w[t] = (gamma1(w[t - 2]) + w[t - 7] + gamma0(w[t - 15]) + w[t - 16]) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let t = 0; t < 64; t++) {
      const t1 = (h + sigma1(e) + ch(e, f, g) + K[t] + w[t]) >>> 0;
      const t2 = (sigma0(a) + maj(a, b, c)) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const hex = [h0, h1, h2, h3, h4, h5, h6, h7]
    .map(val => val.toString(16).padStart(8, '0'))
    .join('');
  return hex;
}

/**
 * Compute SHA-256 checksum of File or Blob bytes
 */
export async function computeFileHash(blob: Blob | File): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback if subtle.digest is unavailable in certain contexts
    }
  }

  return sha256Fallback(arrayBuffer);
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

  // Unverified properties (BUG-08 Fix: Honest disclosure of heuristic limits)
  unverifiedProperties.push('Font kerning and typographic rendering');
  unverifiedProperties.push('Color space chromatic fidelity');
  unverifiedProperties.push('Inline formatting (bold/italic/underline character spans)');
  unverifiedProperties.push('Exact visual paragraph flow and line wrap boundaries');
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
    summary: `Heuristic structural comparison: ${fidelityRating} (${finalScore}/100) · Visual typography unverified`,
    errors,
    warnings,
    unverifiedProperties,
    fidelityRating,
  };
}
