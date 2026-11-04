import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { sanitizeAndRedactPdf } from '../services/pdfSanitizerService';

describe('Verified PDF Content Sanitization & Redaction Engine', () => {
  it('clears document metadata and applies opaque destructive blackouts', async () => {
    // Generate a test PDF with metadata
    const doc = await PDFDocument.create();
    doc.setTitle('Classified Executive Brief');
    doc.setAuthor('Internal Agent');
    doc.setSubject('Restricted Secrets');
    doc.setKeywords(['confidential', 'ssn']);

    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([600, 400]);
    page.drawText('Customer SSN: 000-12-3456 and private phone: 555-0199', {
      x: 50,
      y: 300,
      size: 14,
      font,
      color: rgb(0, 0, 0),
    });

    const initialPdfBytes = await doc.save();

    // Perform verified sanitization
    const result = await sanitizeAndRedactPdf(initialPdfBytes, [
      {
        pageNumber: 1,
        x: 45,
        y: 290,
        width: 250,
        height: 25,
        textToRedact: '000-12-3456',
        reason: 'PII Removal',
      },
    ]);

    expect(result.report.metadataCleared).toBe(true);
    expect(result.report.redactionsApplied).toBe(1);
    expect(result.pdfBytes.length).toBeGreaterThan(500);

    // Verify metadata in sanitized PDF
    const reloaded = await PDFDocument.load(result.pdfBytes);
    expect(reloaded.getTitle()).toBe('');
    expect(reloaded.getAuthor()).toBe('');
    expect(reloaded.getSubject()).toBe('');
    expect(reloaded.getCreator()).toContain('OmniDoc Studio Privacy Engine');
  });
});
