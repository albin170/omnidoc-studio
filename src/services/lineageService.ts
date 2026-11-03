import JSZip from 'jszip';
import { LineageFieldNode, LineageManifest } from '../types';
import { computeFileHash } from './documentDnaService';
import { validateFileFormat } from './formatDetector';

/**
 * Extracts plain text chunks with line or approximate page attribution
 */
async function extractTextChunks(
  file: Blob | File,
  format: string
): Promise<Array<{ text: string; pageNumber: number }>> {
  const chunks: Array<{ text: string; pageNumber: number }> = [];

  try {
    if (format === 'docx') {
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const docXml = zip.file('word/document.xml');
      if (docXml) {
        const rawXml = await docXml.async('text');
        // Extract paragraph texts
        const paragraphs = rawXml.match(/<w:p[\s>].*?<\/w:p>/gs) || [rawXml];
        let currentChunk = '';
        let page = 1;
        let pCount = 0;

        for (const p of paragraphs) {
          const stripped = p.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (stripped) {
            currentChunk += stripped + '\n';
            pCount++;
            // Approximate 5-6 paragraphs per page
            if (pCount >= 5) {
              chunks.push({ text: currentChunk, pageNumber: page });
              currentChunk = '';
              page++;
              pCount = 0;
            }
          }
        }
        if (currentChunk.trim()) {
          chunks.push({ text: currentChunk, pageNumber: page });
        }
      }
    } else if (format === 'pdf') {
      // Basic text extraction from PDF stream if available
      const rawText = await file.text();
      const textMatches = rawText.match(/\(([^()]{3,})\)[\s]*Tj/g) || [];
      if (textMatches.length > 0) {
        const parsed = textMatches.map((m) => m.replace(/^\(/, '').replace(/\)[\s]*Tj$/, '')).join(' ');
        chunks.push({ text: parsed, pageNumber: 1 });
      } else {
        chunks.push({ text: rawText.slice(0, 15000), pageNumber: 1 });
      }
    } else {
      // Plain text, CSV, or other formats
      const fullText = await file.text();
      const lines = fullText.split(/\r?\n/);
      const linesPerPage = 35;
      for (let i = 0; i < lines.length; i += linesPerPage) {
        const slice = lines.slice(i, i + linesPerPage).join('\n');
        chunks.push({ text: slice, pageNumber: Math.floor(i / linesPerPage) + 1 });
      }
    }
  } catch (err) {
    console.warn('Text extraction fallback for lineage:', err);
    try {
      const raw = await file.text();
      chunks.push({ text: raw.slice(0, 5000), pageNumber: 1 });
    } catch {
      chunks.push({ text: '', pageNumber: 1 });
    }
  }

  if (chunks.length === 0) {
    chunks.push({ text: '', pageNumber: 1 });
  }

  return chunks;
}

/**
 * Extract data lineage and provenance from a document
 */
export async function extractDocumentLineage(
  file: File | Blob,
  fileName: string = 'document'
): Promise<LineageManifest> {
  const fileObj = file instanceof File ? file : new File([file], fileName);
  const detected = await validateFileFormat(fileObj);
  const format = detected.format || 'txt';
  const sha256 = await computeFileHash(file);

  const chunks = await extractTextChunks(file, format);
  const fields: LineageFieldNode[] = [];
  let fieldSeq = 1;

  // Extraction Patterns & Heuristics
  const patterns: Array<{
    category: string;
    regex: RegExp;
    baseConfidence: number;
    anchorRegex?: RegExp;
    transform: string;
  }> = [
    {
      category: 'Monetary Value',
      regex: /([$€£¥]\s?\d+(?:,\d{3})*(?:\.\d{2})?|\b\d+(?:,\d{3})*\.\d{2}\s?(?:USD|EUR|GBP))/gi,
      baseConfidence: 0.82,
      anchorRegex: /(?:total|amount|invoice|balance|subtotal|due|price|fee|cost)/i,
      transform: 'currency_standardized',
    },
    {
      category: 'Date Stamp',
      regex: /\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})\b/gi,
      baseConfidence: 0.85,
      anchorRegex: /(?:date|effective|issued|due|created|period)/i,
      transform: 'iso_date_parse',
    },
    {
      category: 'Contact Email',
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g,
      baseConfidence: 0.95,
      transform: 'email_normalized',
    },
    {
      category: 'Reference Identifier',
      regex: /\b(?:INV|PO|REF|DOC|ORDER|ID)[-#:\s][A-Za-z0-9_-]{3,20}\b/gi,
      baseConfidence: 0.92,
      anchorRegex: /(?:reference|number|invoice|order|code)/i,
      transform: 'id_token_normalized',
    },
    {
      category: 'Tax / Percentage Rate',
      regex: /\b\d+(?:\.\d{1,3})?%\b/g,
      baseConfidence: 0.88,
      anchorRegex: /(?:rate|tax|vat|discount|interest|margin)/i,
      transform: 'percentage_scaled',
    },
    {
      category: 'Ambiguous Numeric Total',
      regex: /\b\d{3,6}\b/g,
      baseConfidence: 0.58, // Low confidence -> flags for review
      anchorRegex: /(?:sum|count|quantity|qty|total|units)/i,
      transform: 'unverified_numeric_heuristic',
    },
  ];

  const seenValues = new Set<string>();

  for (const chunk of chunks) {
    const pageText = chunk.text;
    if (!pageText) continue;

    for (const pat of patterns) {
      const matches = Array.from(pageText.matchAll(pat.regex));

      for (const match of matches) {
        if (!match[0] || match.index === undefined) continue;
        const rawVal = match[0].trim();
        const dedupeKey = `${pat.category}:${rawVal}:${chunk.pageNumber}`;
        if (seenValues.has(dedupeKey)) continue;
        seenValues.add(dedupeKey);

        // Context snippet (+/- 45 characters)
        const startIdx = Math.max(0, match.index - 45);
        const endIdx = Math.min(pageText.length, match.index + rawVal.length + 45);
        const snippet = pageText.substring(startIdx, endIdx).replace(/\s+/g, ' ').trim();

        // Calculate confidence with contextual anchoring
        let confidence = pat.baseConfidence;
        const hasAnchor = pat.anchorRegex ? pat.anchorRegex.test(snippet) : false;
        if (hasAnchor) {
          confidence = Math.min(0.99, confidence + 0.12);
        } else if (pat.category === 'Ambiguous Numeric Total') {
          confidence = 0.55; // Remains low confidence without anchoring
        }

        const isFlaggedForReview = confidence < 0.70;
        const transformations = ['raw_token_extraction', pat.transform];
        if (hasAnchor) {
          transformations.push('context_anchored_validation');
        }

        fields.push({
          id: `lineage-field-${fieldSeq++}`,
          fieldName: hasAnchor ? `${pat.category} (Anchored)` : pat.category,
          extractedValue: rawVal,
          sourceFile: fileName,
          sourceFileHash: sha256,
          pageNumber: chunk.pageNumber,
          contextSnippet: `...${snippet}...`,
          confidence: Math.round(confidence * 100) / 100,
          transformations,
          isFlaggedForReview,
        });

        // Cap to reasonable number of lineage extractions per document
        if (fields.length >= 75) break;
      }
      if (fields.length >= 75) break;
    }
    if (fields.length >= 75) break;
  }

  return {
    documentTitle: fileName,
    documentHash: sha256,
    generatedAt: Date.now(),
    fields,
  };
}

/**
 * Format lineage manifest as downloadable audit JSON
 */
export function exportLineageManifestJson(manifest: LineageManifest): string {
  return JSON.stringify(manifest, null, 2);
}

/**
 * Format lineage manifest as standard CSV
 */
export function exportLineageCsv(manifest: LineageManifest): string {
  const header = ['Field Name', 'Extracted Value', 'Confidence', 'Page', 'Flagged For Review', 'Context Snippet', 'Hash'];
  const rows = manifest.fields.map((f) => [
    `"${f.fieldName.replace(/"/g, '""')}"`,
    `"${String(f.extractedValue).replace(/"/g, '""')}"`,
    f.confidence.toFixed(2),
    f.pageNumber ?? 1,
    f.isFlaggedForReview ? 'YES' : 'NO',
    `"${f.contextSnippet.replace(/"/g, '""')}"`,
    `"${f.sourceFileHash}"`,
  ]);

  return [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
