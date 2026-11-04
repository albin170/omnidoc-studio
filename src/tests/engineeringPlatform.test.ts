import { describe, it, expect, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { 
  computeFileHash, 
  generateDocumentDna, 
  compareDocumentDna 
} from '../services/documentDnaService';
import { inspectDocumentForensics } from '../services/forensicsService';
import { 
  createTransformationReceipt, 
  saveReceipt, 
  getStoredReceipts, 
  formatReceiptMarkdown,
  verifyTransformationReceipt
} from '../services/receiptService';
import { 
  convertWithSelfHealing 
} from '../services/selfHealingService';
import { 
  extractDocumentLineage, 
  exportLineageManifestJson, 
  exportLineageCsv 
} from '../services/lineageService';
import { 
  executeWorkflow, 
  PRESET_WORKFLOWS,
  validateWorkflowDAG 
} from '../services/workflowEngine';

const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, value: string) => storageMap.set(key, String(value)),
  removeItem: (key: string) => { storageMap.delete(key); },
  clear: () => { storageMap.clear(); },
};
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('Intelligent Document Engineering Platform (v2.1)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Feature 1: Document DNA & Structural Fingerprinting', () => {
    it('computes consistent cryptographic SHA-256 hash', async () => {
      const content = 'OmniDoc Studio Structural Fingerprint Test String 2026';
      const blob = new Blob([content], { type: 'text/plain' });
      const hash1 = await computeFileHash(blob);
      const hash2 = await computeFileHash(blob);

      expect(hash1).toBeDefined();
      expect(hash1.length).toBeGreaterThan(10);
      expect(hash1).toBe(hash2);
    });

    it('extracts DNA profile from structured plain text', async () => {
      const textContent = `
# Annual Strategy Overview
This is the executive summary paragraph containing exactly fourteen distinct words for counting.

## Financial Target Summary
Revenue targets are projected to increase by 25 percent year over year.
      `.trim();

      const blob = new Blob([textContent], { type: 'text/plain' });
      const profile = await generateDocumentDna(blob, 'strategy.txt');

      expect(profile.fileName).toBe('strategy.txt');
      expect(profile.format).toBe('txt');
      expect(profile.wordCount).toBeGreaterThan(20);
      expect(profile.headingCount).toBe(2);
      expect(profile.headings).toContain('Annual Strategy Overview');
      expect(profile.headings).toContain('Financial Target Summary');
    });

    it('computes high fidelity score for identical DNA profiles', async () => {
      const content = 'Heading One\nParagraph text for document fidelity verification.';
      const blob = new Blob([content], { type: 'text/plain' });
      const dnaSource = await generateDocumentDna(blob, 'doc1.txt');
      const dnaTarget = await generateDocumentDna(blob, 'doc2.txt');

      const comparison = compareDocumentDna(dnaSource, dnaTarget);
      expect(comparison.fidelityScore).toBe(100);
      expect(comparison.errors.length).toBe(0);
      expect(comparison.warnings.length).toBe(0);
    });

    it('penalizes fidelity score when tables or formulas are missing in target', () => {
      const sourceDna = {
        fileName: 'source.docx',
        format: 'docx' as const,
        sha256: 'abc123source',
        sizeBytes: 15000,
        wordCount: 500,
        characterCount: 3000,
        pageOrSheetCount: 2,
        headingCount: 4,
        tableCount: 3,
        tableDimensions: [{ rows: 5, cols: 4 }],
        imageCount: 2,
        formulaCount: 5,
        headings: ['Overview', 'Data', 'Projections', 'Appendix'],
        metadata: {},
      };

      const targetDna = {
        fileName: 'target.pdf',
        format: 'pdf' as const,
        sha256: 'def456target',
        sizeBytes: 14000,
        wordCount: 490,
        characterCount: 2950,
        pageOrSheetCount: 2,
        headingCount: 4,
        tableCount: 0, // Lost all 3 tables!
        tableDimensions: [],
        imageCount: 2,
        formulaCount: 0, // Lost all formulas!
        headings: ['Overview', 'Data', 'Projections', 'Appendix'],
        metadata: {},
      };

      const comparison = compareDocumentDna(sourceDna, targetDna);
      expect(comparison.fidelityScore).toBeLessThan(75);
      expect(comparison.errors.length).toBeGreaterThanOrEqual(1);
      expect(comparison.errors.some((e) => e.message.toLowerCase().includes('table') || e.category === 'table')).toBe(true);
    });
  });

  describe('Feature 2: Conversion Verification & Self-Healing Engine', () => {
    it('executes self-healing conversion and produces valid output and receipt', async () => {
      const content = 'Test Document for Self-Healing Engine';
      const blob = new Blob([content], { type: 'text/plain' });

      const healingResult = await convertWithSelfHealing(blob, 'txt', 'html');
      expect(healingResult.outputBlob).toBeDefined();
      expect(healingResult.outputBlob.size).toBeGreaterThan(0);
      expect(healingResult.strategyUsed).toBeDefined();
      expect(healingResult.afterScore).toBeGreaterThanOrEqual(60);
      expect(healingResult.receiptId).toBeDefined();
    });
  });

  describe('Feature 4: Data Lineage & Provenance Extraction', () => {
    it('extracts monetary amounts, dates, IDs and emails with confidence scores', async () => {
      const documentText = `
OmniDoc Enterprise Services
Invoice Reference: INV-2026-9021
Effective Date: 2026-11-03
Contact Email: billing@omnidoc.io
Subtotal Due: $1,450.00
Tax Rate: 8.5%
Unanchored Total Units: 450
      `.trim();

      const blob = new Blob([documentText], { type: 'text/plain' });
      const manifest = await extractDocumentLineage(blob, 'invoice.txt');

      expect(manifest.documentTitle).toBe('invoice.txt');
      expect(manifest.documentHash).toBeDefined();
      expect(manifest.fields.length).toBeGreaterThan(3);

      const emailField = manifest.fields.find((f) => f.fieldName.includes('Email'));
      expect(emailField).toBeDefined();
      expect(emailField?.extractedValue).toBe('billing@omnidoc.io');
      expect(emailField?.confidence).toBeGreaterThanOrEqual(0.90);

      const invoiceIdField = manifest.fields.find((f) => f.fieldName.includes('Reference'));
      expect(invoiceIdField).toBeDefined();
      expect(invoiceIdField?.extractedValue).toBe('INV-2026-9021');

      const moneyField = manifest.fields.find((f) => f.fieldName.includes('Monetary'));
      expect(moneyField).toBeDefined();
      expect(moneyField?.extractedValue).toBe('$1,450.00');

      // Export functions
      const jsonExport = exportLineageManifestJson(manifest);
      expect(JSON.parse(jsonExport).documentTitle).toBe('invoice.txt');

      const csvExport = exportLineageCsv(manifest);
      expect(csvExport).toContain('Field Name,Extracted Value');
      expect(csvExport).toContain('billing@omnidoc.io');
    });

    it('flags low-confidence ambiguous tokens for manual review', async () => {
      const text = 'Items count: 12345';
      const blob = new Blob([text], { type: 'text/plain' });
      const manifest = await extractDocumentLineage(blob, 'counts.txt');

      const unverified = manifest.fields.find((f) => f.confidence < 0.70);
      if (unverified) {
        expect(unverified.isFlaggedForReview).toBe(true);
      }
    });
  });

  describe('Feature 5: Document Forensics Lab', () => {
    it('flags MIME extension spoofing when extension does not match bytes', async () => {
      // Craft a file called invoice.pdf that actually contains PK zip header
      const zip = new JSZip();
      zip.file('hidden.txt', 'secret payload');
      const zipBytes = await zip.generateAsync({ type: 'uint8array' });

      const spoofedFile = new File([zipBytes as any], 'invoice.pdf', { type: 'application/pdf' });
      const report = await inspectDocumentForensics(spoofedFile);

      expect(report.fileName).toBe('invoice.pdf');
      expect(report.declaredExtension).toBe('pdf');
      expect(report.actualFormat).toBe('zip'); // Accurately identified as zip, not falsely docx (BUG-09 Fix)
      expect(report.findings.some((f) => f.rule === 'FORMAT_EXTENSION_MISMATCH')).toBe(true);
      expect(report.overallRisk).toBe('HIGH');
    });

    it('detects embedded VBA macros (vbaProject.bin) in Office packages', async () => {
      const zip = new JSZip();
      zip.file('word/document.xml', '<w:document><w:body><w:p><w:r><w:t>Macro Doc</w:t></w:r></w:p></w:body></w:document>');
      zip.file('word/vbaProject.bin', new Uint8Array([0x50, 0x4B, 0x03, 0x04])); // Dummy binary macro file

      const macroBytes = await zip.generateAsync({ type: 'uint8array' });
      const macroDoc = new File([macroBytes as any], 'financial_report.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      const report = await inspectDocumentForensics(macroDoc);
      expect(report.findings.some((f) => f.rule === 'EMBEDDED_VBA_MACRO')).toBe(true);
      expect(report.overallRisk).toBe('HIGH');
    });

    it('detects external relationship targets and leaks', async () => {
      const zip = new JSZip();
      zip.file('word/document.xml', '<w:document><w:body></w:body></w:document>');
      zip.file(
        'word/_rels/document.xml.rels',
        '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="http://malicious-external-server.com/payload.exe" TargetMode="External"/></Relationships>'
      );

      const docBytes = await zip.generateAsync({ type: 'uint8array' });
      const extRelDoc = new File([docBytes as any], 'external_link.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      const report = await inspectDocumentForensics(extRelDoc);
      expect(report.findings.some((f) => f.rule === 'EXTERNAL_NETWORK_TARGET')).toBe(true);
    });
  });

  describe('Feature 6: Cryptographic Transformation Receipts', () => {
    it('generates, signs, and stores non-repudiable transformation receipts', async () => {
      const sourceBlob = new Blob(['Source Original'], { type: 'text/plain' });
      const targetBlob = new Blob(['<html><body>Source Original</body></html>'], { type: 'text/html' });

      const receipt = await createTransformationReceipt(
        sourceBlob,
        targetBlob,
        'source.txt',
        'target.html',
        'txt',
        'html',
        98,
        0,
        0,
        120
      );

      expect(receipt.receiptId).toBeDefined();
      expect(receipt.digitalSignature).toBeDefined();
      expect(receipt.source.sha256).toBeDefined();
      expect(receipt.target.sha256).toBeDefined();
      expect(receipt.integrityScore).toBe(98);

      // Persist in localStorage
      saveReceipt(receipt);
      const stored = getStoredReceipts();
      expect(stored.some((r) => r.receiptId === receipt.receiptId)).toBe(true);

      // Verify HMAC-SHA256 signature mathematically
      const isValid = await verifyTransformationReceipt(receipt);
      expect(isValid).toBe(true);

      // Verify tampered receipt fails validation
      const tamperedReceipt = { ...receipt, integrityScore: 40 };
      const isTamperedValid = await verifyTransformationReceipt(tamperedReceipt);
      expect(isTamperedValid).toBe(false);

      // Verify Markdown Certificate Output
      const markdown = formatReceiptMarkdown(receipt);
      expect(markdown).toContain('# OmniDoc Studio — Verifiable Transformation Certificate');
      expect(markdown).toContain(receipt.receiptId);
      expect(markdown).toContain('HMAC-SHA256 Signature');
    });
  });

  describe('Feature 3: Visual Workflow Execution Engine', () => {
    it('executes the Enterprise Verified Pipeline preset cleanly', async () => {
      const workflow = PRESET_WORKFLOWS[0]; // enterprise-verified-pipeline
      const content = 'Executive Briefing on Document Pipelines\nKey Points: High speed, zero trust.';
      const blob = new Blob([content], { type: 'text/plain' });

      const logsCollected: string[] = [];
      const context = await executeWorkflow(workflow, blob, 'briefing.txt', {
        targetFormat: 'html',
        onLog: (l) => logsCollected.push(l.message),
      });

      expect(context.success).toBe(true);
      expect(context.logs.length).toBeGreaterThan(4);
      expect(context.sourceDna).toBeDefined();
      expect(context.convertedBlob).toBeDefined();
      expect(context.receipt).toBeDefined();
      expect(logsCollected.some((m) => m.includes('Self-healing conversion completed'))).toBe(true);
    });

    it('executes Security Screening workflow and collects forensics', async () => {
      const workflow = PRESET_WORKFLOWS[1]; // forensic-security-screening
      const blob = new Blob(['Plain Document Body'], { type: 'text/plain' });

      const context = await executeWorkflow(workflow, blob, 'clean_doc.txt');
      expect(context.success).toBe(true);
      expect(context.forensicsReport).toBeDefined();
      expect(context.forensicsReport?.overallRisk).toBe('LOW');
    });

    it('detects and rejects cyclic workflow definitions with descriptive DAG error', async () => {
      const cyclicWorkflow = {
        id: 'cyclic-test',
        name: 'Cyclic Loop',
        description: 'Invalid cycle',
        nodes: [
          { id: 'node-a', type: 'upload' as const, title: 'Node A', config: {}, x: 0, y: 0, status: 'idle' as const },
          { id: 'node-b', type: 'detect' as const, title: 'Node B', config: {}, x: 100, y: 0, status: 'idle' as const },
        ],
        edges: [
          { id: 'e1', fromNodeId: 'node-a', toNodeId: 'node-b' },
          { id: 'e2', fromNodeId: 'node-b', toNodeId: 'node-a' }, // Direct loop!
        ],
        updatedAt: Date.now(),
      };

      const val = validateWorkflowDAG(cyclicWorkflow);
      expect(val.isValid).toBe(false);
      expect(val.error).toContain('Cyclic dependency detected');

      await expect(
        executeWorkflow(cyclicWorkflow, new Blob(['test']), 'doc.txt')
      ).rejects.toThrow('Cyclic dependency detected');
    });

    it('halts execution on corrupt package and marks downstream nodes as skipped', async () => {
      const statuses: Record<string, string> = {};
      const workflow = PRESET_WORKFLOWS[1]; // includes validate node
      // Pass an empty file or corrupt file to trigger validation failure
      const corruptFile = new Blob([]);

      const context = await executeWorkflow(workflow, corruptFile, 'corrupt.docx', {
        onNodeStatusChange: (nodeId, status) => {
          statuses[nodeId] = status;
        },
      });

      expect(context.success).toBe(false);
      expect(context.haltedAtNodeId).toBeDefined();
      // Downstream nodes must be skipped
      expect(Object.values(statuses)).toContain('skipped');
    });
  });
});
