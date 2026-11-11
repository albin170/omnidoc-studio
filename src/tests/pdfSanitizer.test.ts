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
    expect(result.report.isSanitized).toBe(true);
    expect(result.report.residualTextFound).toBe(false);
    expect(result.pdfBytes.length).toBeGreaterThan(500);

    // Verify metadata in sanitized PDF
    const reloaded = await PDFDocument.load(result.pdfBytes);
    expect(reloaded.getTitle()).toBe('');
    expect(reloaded.getAuthor()).toBe('');
    expect(reloaded.getSubject()).toBe('');
    expect(reloaded.getCreator()).toContain('OmniDoc Studio Privacy Engine');

    // Binary check: verify target SSN is not present anywhere in raw bytes
    const textRepr = new TextDecoder('latin1').decode(result.pdfBytes);
    expect(textRepr.includes('000-12-3456')).toBe(false);
  });

  it('accurately reports residual text detection when verification encounters unredacted targets', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([600, 400]);
    page.drawText('Unredacted Secret: TOP_SECRET_KEY_99', {
      x: 50,
      y: 300,
      size: 14,
      font,
      color: rgb(0, 0, 0),
    });
    const bytes = await doc.save();

    // Redaction target specifies a different page (page 2) that does not scrub page 1
    const result = await sanitizeAndRedactPdf(bytes, [
      {
        pageNumber: 2, // invalid page, page 1 text will not be scrubbed
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        textToRedact: 'TOP_SECRET_KEY_99',
      },
    ]);

    expect(result.report.residualTextFound).toBe(true);
    expect(result.report.isSanitized).toBe(false);
    expect(result.report.residualMatches.length).toBeGreaterThan(0);
  });

  it('purges original text from underlying content stream during text replacement', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([600, 400]);
    page.drawText('Account record: My password is ABC123 in private vault.', {
      x: 50,
      y: 300,
      size: 14,
      font,
      color: rgb(0, 0, 0),
    });
    const bytes = await doc.save();

    // Import applyPdfModifications
    const { applyPdfModifications } = await import('../services/pdfService');

    // Perform text replacement: "ABC123" -> "[REDACTED]"
    const modifiedBytes = await applyPdfModifications(bytes, [], {
      textEdits: [
        {
          id: 'edit-1',
          pageIndex: 0,
          originalText: 'ABC123',
          newText: '[REDACTED]',
          pdfX: 200,
          pdfY: 300,
          width: 60,
          height: 16,
          isDeleted: false,
          isRedaction: false,
        },
      ],
    });

    // Verify binary content does not contain the original sensitive string ABC123
    const textRepr = new TextDecoder('latin1').decode(modifiedBytes);
    expect(textRepr.includes('ABC123')).toBe(false);

    // Verify with sanitizeAndRedactPdf dual-stage verification
    const sanitizationCheck = await sanitizeAndRedactPdf(modifiedBytes, [
      {
        pageNumber: 1,
        x: 200,
        y: 300,
        width: 60,
        height: 16,
        textToRedact: 'ABC123',
      },
    ]);

    expect(sanitizationCheck.report.residualTextFound).toBe(false);
    expect(sanitizationCheck.report.isSanitized).toBe(true);
  });

  it('purges original text from content stream during text deletion', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([600, 400]);
    page.drawText('Confidential Salary: 175000 USD Annual', {
      x: 50,
      y: 300,
      size: 14,
      font,
      color: rgb(0, 0, 0),
    });
    const bytes = await doc.save();

    const { applyPdfModifications } = await import('../services/pdfService');

    const modifiedBytes = await applyPdfModifications(bytes, [], {
      textEdits: [
        {
          id: 'del-1',
          pageIndex: 0,
          originalText: '175000',
          newText: '',
          pdfX: 180,
          pdfY: 300,
          width: 50,
          height: 16,
          isDeleted: true,
        },
      ],
    });

    const textRepr = new TextDecoder('latin1').decode(modifiedBytes);
    expect(textRepr.includes('175000')).toBe(false);
  });
});
