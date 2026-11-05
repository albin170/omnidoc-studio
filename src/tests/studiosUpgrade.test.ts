import { describe, it, expect } from 'vitest';
import { 
  insertBlankPage, 
  rotatePdfPage, 
  duplicatePdfPage,
  applyPdfModifications,
  verifyPdfIntegrity
} from '../services/pdfService';
import { htmlToDocxItems, createDocxBlob } from '../services/docxService';
import { rotateCanvas, flipCanvas, cropCanvas, resizeCanvas } from '../services/imageService';
import { PDFDocument } from 'pdf-lib';

describe('PDF Studio Page & Vector Manipulation Engine', () => {
  it('creates, rotates, duplicates, and verifies PDF documents', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([600, 400]);
    const bytes = await doc.save();

    // Insert blank page
    const withBlank = await insertBlankPage(bytes, 0);
    const docWithBlank = await PDFDocument.load(withBlank);
    expect(docWithBlank.getPageCount()).toBe(2);

    // Rotate page
    const rotated = await rotatePdfPage(withBlank, 0, 90);
    const docRotated = await PDFDocument.load(rotated);
    expect(docRotated.getPage(0).getRotation().angle).toBe(90);

    // Duplicate page
    const duplicated = await duplicatePdfPage(withBlank, 0);
    const docDuplicated = await PDFDocument.load(duplicated);
    expect(docDuplicated.getPageCount()).toBe(3);

    // Verify integrity
    const verification = await verifyPdfIntegrity(duplicated);
    expect(verification.isValid).toBe(true);
    expect(verification.pageCount).toBe(3);
    expect(verification.sizeBytes).toBeGreaterThan(0);
  });

  it('applies text edits and secure redactions to PDF content stream', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([500, 500]);
    page.drawText('Original Secret Value', { x: 50, y: 400, size: 14 });
    const bytes = await doc.save();

    const modified = await applyPdfModifications(bytes, [], {
      textEdits: [
        {
          id: 'edit-1',
          pageIndex: 0,
          originalText: 'Original Secret Value',
          newText: 'CONFIDENTIAL',
          pdfX: 50,
          pdfY: 400,
          width: 150,
          height: 20,
          fontSize: 14,
          isRedaction: true,
        },
      ],
    });

    expect(modified).toBeInstanceOf(Uint8Array);
    const verify = await verifyPdfIntegrity(modified);
    expect(verify.isValid).toBe(true);
    expect(verify.pageCount).toBe(1);
  });
});

describe('DOCX Rich Text & HTML Document Engine', () => {
  it('parses complex HTML into structured OpenXML DOCX items', () => {
    const html = `
      <h1>Strategic Blueprint</h1>
      <h2>Core Milestones</h2>
      <ul>
        <li>Client-side WASM processing</li>
        <li>Zero-latency operations</li>
      </ul>
      <p>This is a <strong>bold</strong> and <em>italic</em> sentence.</p>
      <table>
        <tr><th>Col 1</th><th>Col 2</th></tr>
        <tr><td>Val 1</td><td>Val 2</td></tr>
      </table>
    `;

    const items = htmlToDocxItems(html);
    expect(items.length).toBeGreaterThan(3);

    const h1 = items.find((i) => i.type === 'h1');
    expect(h1).toBeDefined();
    expect(h1?.text).toBe('Strategic Blueprint');

    const h2 = items.find((i) => i.type === 'h2');
    expect(h2).toBeDefined();
    expect(h2?.text).toBe('Core Milestones');

    const bullets = items.filter((i) => i.type === 'bullet');
    expect(bullets.length).toBe(2);

    const table = items.find((i) => i.type === 'table');
    expect(table).toBeDefined();
    expect(table?.tableData).toHaveLength(2);
  });

  it('generates a valid DOCX blob from parsed rich-text items', async () => {
    const items = htmlToDocxItems('<h1>Executive Summary</h1><p>Test paragraph content</p>');
    const blob = await createDocxBlob('Executive Summary', items);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(100);
  });
});

describe('Image Studio Transformations Engine', () => {
  it('rotates, flips, crops, and resizes HTML canvases', () => {
    if (typeof document === 'undefined') return;

    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 50;

    // Rotate
    const rotated90 = rotateCanvas(canvas, 90);
    expect(rotated90.width).toBe(50);
    expect(rotated90.height).toBe(100);

    const rotated180 = rotateCanvas(canvas, 180);
    expect(rotated180.width).toBe(100);
    expect(rotated180.height).toBe(50);

    // Flip
    const flipped = flipCanvas(canvas, true, false);
    expect(flipped.width).toBe(100);
    expect(flipped.height).toBe(50);

    // Crop
    const cropped = cropCanvas(canvas, 10, 10, 40, 20);
    expect(cropped.width).toBe(40);
    expect(cropped.height).toBe(20);

    // Resize
    const resized = resizeCanvas(canvas, 300, 150);
    expect(resized.width).toBe(300);
    expect(resized.height).toBe(150);
  });
});
