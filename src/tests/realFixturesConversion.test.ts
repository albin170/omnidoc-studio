import { describe, it, expect, beforeEach } from 'vitest';
import { createDocxBlob, DocxContentItem } from '../services/docxService';
import { exportDataToXlsxBlob, exportDataToCsvBlob, evaluateCellFormula } from '../services/sheetService';
import { createPresentationBlob } from '../services/pptxService';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { executeFileConversion } from '../services/converter';
import { validateDocumentStructure } from '../services/fileValidator';
import { computeTextDiff, generateChangeReport } from '../services/diffService';
import { aiAssistantService } from '../services/aiAssistantService';
import { 
  mergePdfFiles, 
  watermarkPdf, 
  rotatePdfPages, 
  addPageNumbersToPdf 
} from '../services/pdfAdvancedService';
import { runBatchConversion } from '../services/batchService';
import { 
  createSecureSession, 
  verifyAndSanitizeSession, 
  authorizeUserAction,
  requestPasswordReset 
} from '../services/authService';
import { persistenceService } from '../services/persistenceService';
import { SlideItem } from '../types';

// Mock localStorage in Node environment
const store = new Map<string, string>();
const mockLocalStorage = {
  getItem: (k: string) => store.get(k) || null,
  setItem: (k: string, v: string) => store.set(k, String(v)),
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
};

if (!globalThis.localStorage || typeof globalThis.localStorage.getItem !== 'function') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
  });
}

describe('Real Document Fixtures & Conversion Engine', () => {
  it('creates and parses a valid real DOCX with headings and tables', async () => {
    const items: DocxContentItem[] = [
      { type: 'h1', text: 'Quarterly Strategic Report' },
      { type: 'paragraph', text: 'All revenue objectives were exceeded across regions.' },
      {
        type: 'table',
        tableData: [
          ['Division', 'Revenue', 'Target'],
          ['Cloud Solutions', '$45,000', '$40,000'],
          ['Professional Services', '$22,000', '$20,000'],
        ],
      },
    ];

    const docxBlob = await createDocxBlob('Executive Review', items);
    expect(docxBlob.size).toBeGreaterThan(1000);

    const docxFile = new File([docxBlob], 'quarterly_report.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    // Validate structure
    const validation = await validateDocumentStructure(docxFile);
    expect(validation.valid).toBe(true);
    expect(validation.format).toBe('docx');

    // Convert DOCX to PDF
    const pdfResult = await executeFileConversion(docxFile, 'docx', 'pdf');
    expect(pdfResult.blob.size).toBeGreaterThan(500);
    expect(pdfResult.fileName).toBe('quarterly_report.pdf');

    // Convert DOCX to TXT
    const txtResult = await executeFileConversion(docxFile, 'docx', 'txt');
    const textOut = await txtResult.blob.text();
    expect(textOut).toContain('Quarterly Strategic Report');
  });

  it('creates and parses a real XLSX with spreadsheet formulas', async () => {
    const grid: (string | number)[][] = [
      ['Metric', 'Q1', 'Q2', 'Sum'],
      ['Signups', 100, 250, '=SUM(B2:C2)'],
      ['Conversions', 40, 80, '=SUM(B3:C3)'],
    ];

    expect(evaluateCellFormula('=SUM(B2:C2)', grid)).toBe(350);

    const xlsxBlob = exportDataToXlsxBlob(grid, 'Performance');
    expect(xlsxBlob.size).toBeGreaterThan(1000);

    const xlsxFile = new File([xlsxBlob], 'metrics.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const validation = await validateDocumentStructure(xlsxFile);
    expect(validation.valid).toBe(true);
    expect(validation.format).toBe('xlsx');

    // Convert XLSX to CSV
    const csvResult = await executeFileConversion(xlsxFile, 'xlsx', 'csv');
    const csvContent = await csvResult.blob.text();
    expect(csvContent).toContain('Signups');
  });

  it('creates and parses a real multi-slide PPTX deck', async () => {
    const slides: SlideItem[] = [
      {
        id: 's1',
        title: 'OmniDoc Studio 2.0',
        bgColor: '#0f172a',
        layout: 'title',
        elements: [
          { id: 'el-1', type: 'title', content: 'Enterprise Document Architecture', x: 10, y: 20, width: 80, height: 20 },
        ],
      },
      {
        id: 's2',
        title: 'Platform Capabilities',
        bgColor: '#1e293b',
        layout: 'content',
        elements: [
          { id: 'el-2', type: 'text', content: 'High-speed client-side WASM execution.', x: 10, y: 30, width: 80, height: 40 },
        ],
      },
    ];

    const pptxBlob = await createPresentationBlob('Keynote', slides);
    expect(pptxBlob.size).toBeGreaterThan(1000);

    const pptxFile = new File([pptxBlob], 'deck.pptx');
    const validation = await validateDocumentStructure(pptxFile);
    expect(validation.valid).toBe(true);
    expect(validation.format).toBe('pptx');
  });

  it('detects and rejects password-protected / encrypted PDFs', async () => {
    const encryptedPdfContent = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R /Encrypt 5 0 R >>\nendobj\n%%EOF`;
    const encryptedPdfFile = new File([encryptedPdfContent], 'protected.pdf', { type: 'application/pdf' });

    const validation = await validateDocumentStructure(encryptedPdfFile);
    expect(validation.valid).toBe(false);
    expect(validation.isEncrypted).toBe(true);
    expect(validation.error).toContain('password-protected');
  });

  it('handles unusual Unicode and non-ASCII filenames cleanly', async () => {
    const unicodeText = 'OmniDoc Studio: 报告 (Report), تقرير, 🚀 Document 2.0, Äpfel & Übergrößen';
    const utf8Blob = new Blob([unicodeText], { type: 'text/plain;charset=utf-8' });
    const file = new File([utf8Blob], '报告_rapport_über_2026.txt', { type: 'text/plain' });

    const validation = await validateDocumentStructure(file);
    expect(validation.valid).toBe(true);
    expect(validation.format).toBe('txt');

    const result = await executeFileConversion(file, 'txt', 'html');
    const htmlText = await result.blob.text();
    expect(htmlText).toContain('报告');
    expect(htmlText).toContain('Äpfel');
  });
});

describe('Advanced PDF Engineering Tools', () => {
  async function createSamplePdf(title: string): Promise<File> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([400, 600]);
    page.drawText(title, { x: 50, y: 550, size: 24, font, color: rgb(0.1, 0.2, 0.4) });
    const bytes = await doc.save();
    return new File([bytes.buffer as ArrayBuffer], `${title.toLowerCase().replace(/\s+/g, '_')}.pdf`, {
      type: 'application/pdf',
    });
  }

  it('merges two genuine PDF files into a single unified document', async () => {
    const pdf1 = await createSamplePdf('Chapter One');
    const pdf2 = await createSamplePdf('Chapter Two');

    const mergedBlob = await mergePdfFiles([pdf1, pdf2]);
    const mergedArray = await mergedBlob.arrayBuffer();
    const loaded = await PDFDocument.load(mergedArray);

    expect(loaded.getPageCount()).toBe(2);
  });

  it('applies watermark to PDF pages', async () => {
    const pdf = await createSamplePdf('Contract Draft');
    const watermarked = await watermarkPdf(pdf, { text: 'DRAFT TEST', opacity: 0.3 });
    expect(watermarked.size).toBeGreaterThan(500);
  });

  it('stamps page numbers on PDF pages', async () => {
    const pdf = await createSamplePdf('Paginated Document');
    const numbered = await addPageNumbersToPdf(pdf, { position: 'bottom-center' });
    expect(numbered.size).toBeGreaterThan(500);
  });

  it('rotates pages in a PDF document', async () => {
    const pdf = await createSamplePdf('Landscape Chart');
    const rotated = await rotatePdfPages(pdf, 90);
    const loaded = await PDFDocument.load(await rotated.arrayBuffer());
    expect(loaded.getPage(0).getRotation().angle).toBe(90);
  });
});

describe('Document Text Comparison & Change Analysis', () => {
  it('computes line-level additions, deletions, and unchanged lines', () => {
    const oldText = 'Alpha\nBeta\nGamma\nDelta';
    const newText = 'Alpha\nBeta Modified\nGamma\nEpsilon';

    const diff = computeTextDiff(oldText, newText, 'v1.0', 'v2.0');
    expect(diff.stats.unchanged).toBeGreaterThanOrEqual(2); // Alpha & Gamma
    expect(diff.stats.additions).toBeGreaterThan(0);
    expect(diff.stats.deletions).toBeGreaterThan(0);

    const report = generateChangeReport(diff);
    expect(report).toContain('Document Change Report');
    expect(report).toContain('Comparing: "v1.0" vs "v2.0"');
  });
});

describe('AI Document Intelligence', () => {
  beforeEach(() => {
    aiAssistantService.setConsent(true);
  });

  const sampleDoc = `
Strategic Growth Plan 2026

The enterprise expanded revenue by $150,000 on March 15, 2026.
OmniDoc Technologies finalized client acquisitions.
Next deadline is October 24, 2026.

Action Items:
TODO: Conduct executive audit by Friday.
MUST: Verify GDPR and SOC2 data privacy compliance.
`;

  it('extracts dates, monetary figures, and action items', () => {
    const entities = aiAssistantService.extractEntities(sampleDoc);
    expect(entities.dates.length).toBeGreaterThan(0);
    expect(entities.monetaryAmounts.length).toBeGreaterThan(0);
    expect(entities.actionItems.length).toBeGreaterThan(0);
  });

  it('answers questions with source citations', () => {
    const answer = aiAssistantService.answerQuestion(sampleDoc, 'revenue growth');
    expect(answer.content).toContain('revenue');
    expect(answer.citations?.length).toBeGreaterThan(0);
  });

  it('generates a clean markdown table from text items', () => {
    const table = aiAssistantService.generateTableFromText(sampleDoc);
    expect(table).toContain('| Item # |');
  });
});

describe('Batch Conversion & ZIP Bundling', () => {
  it('converts multiple text documents and bundles into a single ZIP archive', async () => {
    const file1 = new File(['Invoice 101 data'], 'invoice1.txt', { type: 'text/plain' });
    const file2 = new File(['Invoice 102 data'], 'invoice2.txt', { type: 'text/plain' });

    const batchResult = await runBatchConversion([
      { file: file1, targetFormat: 'html' },
      { file: file2, targetFormat: 'html' },
    ]);

    expect(batchResult.zipBlob.size).toBeGreaterThan(200);
    expect(batchResult.report).toContain('Total Files Processed: 2');
    expect(batchResult.jobs.every((j) => j.status === 'done')).toBe(true);
  });
});

describe('Cryptographic Session Security & Anti-Tamper Enforcement', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('signs and verifies genuine user sessions', async () => {
    const session = await createSecureSession('user@omnidoc.io', 'Jane Doe', 'user', 'starter');
    const verified = await verifyAndSanitizeSession(session);

    expect(verified.isAuthenticated).toBe(true);
    expect(verified.role).toBe('user');
    expect(verified.planTier).toBe('starter');
  });

  it('detects browser localStorage tampering and revokes escalated privileges', async () => {
    // 1. Legitimate user logs in as standard 'user' on 'free' tier
    const session = await createSecureSession('attacker@evil.com', 'Mallory', 'user', 'free');

    // 2. Attacker modifies localStorage in browser DevTools to become 'admin' with 'enterprise' plan
    const tamperedSession = {
      ...session,
      role: 'admin' as const,
      planTier: 'enterprise' as const,
    };

    // 3. System checks session against cryptographic signature
    const verified = await verifyAndSanitizeSession(tamperedSession);

    // 4. Verification fails -> privileges instantly revoked and user demoted!
    expect(verified.role).toBe('user'); // Never 'admin'
    expect(verified.planTier).toBe('free'); // Never 'enterprise'
    expect(verified.isAuthenticated).toBe(false);

    // 5. Authorization check blocks admin operations
    const authCheck = await authorizeUserAction(tamperedSession, 'admin');
    expect(authCheck.allowed).toBe(false);
    expect(authCheck.reason).toContain('Authentication required');
  });

  it('handles password reset requests with audit verification', () => {
    const reset = requestPasswordReset('employee@omnidoc.io');
    expect(reset.success).toBe(true);
    expect(reset.message).toContain('dispatched to employee@omnidoc.io');
  });
});

describe('Dual Storage Mode & Version History Snapshots', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('supports toggling storage modes between private local and cloud sync', () => {
    expect(persistenceService.getStorageMode()).toBe('local');

    persistenceService.setStorageMode('cloud', 'user@omnidoc.io');
    expect(persistenceService.getStorageMode()).toBe('cloud');

    persistenceService.setStorageMode('local', 'user@omnidoc.io');
    expect(persistenceService.getStorageMode()).toBe('local');
  });

  it('snapshots versions and restores prior versions reliably', async () => {
    const project = {
      id: 'proj-version-test',
      title: 'Design Specs',
      type: 'docx' as const,
      updatedAt: Date.now(),
      createdAt: Date.now(),
      sizeBytes: 100,
      data: { content: 'Version 1 initial draft.' },
    };

    // Save v1
    await persistenceService.persistProjectWithVersion(project, {
      createSnapshot: true,
      versionNote: 'Initial Release',
    });

    // Update to v2
    const v2Project = {
      ...project,
      data: { content: 'Version 2 breaking edits.' },
    };
    await persistenceService.persistProjectWithVersion(v2Project, {
      createSnapshot: true,
      versionNote: 'Updated Content',
    });

    const versions = persistenceService.getProjectVersions('proj-version-test');
    expect(versions.length).toBe(2);

    // Rollback to v1
    const oldest = versions[versions.length - 1];
    const restored = persistenceService.restoreVersion('proj-version-test', oldest.versionId);
    expect(restored.data.content).toBe('Version 1 initial draft.');
  });
});
