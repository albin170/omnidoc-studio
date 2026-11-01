import { describe, it, expect } from 'vitest';
import { executeFileConversion } from '../services/converter';

describe('Document Conversion Engine Routes', () => {
  it('converts markdown text to HTML format', async () => {
    const mdContent = '# Project Scope\n\n- Feature A\n- Feature B\n\nDirect client-side conversion.';
    const mdFile = new File([mdContent], 'notes.md', { type: 'text/markdown' });

    const result = await executeFileConversion(mdFile, 'md', 'html');
    expect(result.fileName).toBe('notes.html');
    expect(result.mimeType).toBe('text/html');
    expect(result.blob).toBeInstanceOf(Blob);

    const htmlContent = await result.blob.text();
    expect(htmlContent).toContain('Project Scope');
    expect(htmlContent).toContain('<!DOCTYPE html>');
  });

  it('converts plain text to HTML report', async () => {
    const txtContent = 'Line 1 of report\nLine 2 of report';
    const txtFile = new File([txtContent], 'log.txt', { type: 'text/plain' });

    const result = await executeFileConversion(txtFile, 'txt', 'html');
    expect(result.fileName).toBe('log.html');
    expect(result.blob).toBeInstanceOf(Blob);

    const text = await result.blob.text();
    expect(text).toContain('Line 1 of report');
  });

  it('converts CSV to styled HTML table report', async () => {
    const csvContent = 'Region,Sales,Target\nNorth,500,450\nSouth,620,600\nWest,710,700';
    const csvFile = new File([csvContent], 'sales.csv', { type: 'text/csv' });

    const result = await executeFileConversion(csvFile, 'csv', 'html');
    expect(result.fileName).toBe('sales.html');
    expect(result.mimeType).toBe('text/html');

    const html = await result.blob.text();
    expect(html).toContain('<table');
    expect(html).toContain('North');
    expect(html).toContain('620');
  });

  it('rejects unsupported conversion combinations safely with descriptive error', async () => {
    const fakePptx = new File(['fake binary'], 'deck.pptx');
    await expect(
      // pptx to unsupported target
      executeFileConversion(fakePptx, 'pptx', 'webp' as any)
    ).rejects.toThrow(/Unsupported conversion route/);
  });
});
