import { describe, it, expect } from 'vitest';
import { FORMAT_REGISTRY, formatFileSize, detectFileFormat } from '../services/formatDetector';
import { evaluateCellFormula, columnLetterToIndex, indexToColumnLetter } from '../services/sheetService';

describe('Format Detector & Registry', () => {
  it('registers all 11 required document and media formats', () => {
    const requiredFormats = ['pdf', 'docx', 'pptx', 'xlsx', 'csv', 'png', 'jpg', 'webp', 'txt', 'html', 'md'];
    for (const fmt of requiredFormats) {
      expect(FORMAT_REGISTRY[fmt as keyof typeof FORMAT_REGISTRY]).toBeDefined();
      expect(FORMAT_REGISTRY[fmt as keyof typeof FORMAT_REGISTRY].allowedConversions.length).toBeGreaterThan(0);
    }
  });

  it('formats human readable file sizes correctly', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1048576)).toBe('1 MB');
    expect(formatFileSize(5242880)).toBe('5 MB');
  });

  it('correctly maps file extensions', async () => {
    const fakePdf = new File(['%PDF-1.4 test'], 'report.pdf', { type: 'application/pdf' });
    const detected = await detectFileFormat(fakePdf);
    expect(detected).toBe('pdf');

    const pkHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    const fakeDocx = new File([pkHeader], 'proposal.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const detectedDocx = await detectFileFormat(fakeDocx);
    expect(detectedDocx).toBe('docx');

    const fakeXlsx = new File([pkHeader], 'budget.xlsx');
    const detectedXlsx = await detectFileFormat(fakeXlsx);
    expect(detectedXlsx).toBe('xlsx');
  });
});

describe('Spreadsheet Formula Evaluation', () => {
  const sampleGrid: (string | number)[][] = [
    ['Item', 'Q1', 'Q2', 'Q3'],
    ['Product A', 10, 20, 30],
    ['Product B', 40, 50, 60],
    ['Product C', 5, 15, 25],
  ];

  it('correctly evaluates SUM formula', () => {
    // SUM(B2:D2) => 10 + 20 + 30 = 60
    const sumRow = evaluateCellFormula('=SUM(B2:D2)', sampleGrid);
    expect(sumRow).toBe(60);

    // SUM(B2:B4) => 10 + 40 + 5 = 55
    const sumCol = evaluateCellFormula('=SUM(B2:B4)', sampleGrid);
    expect(sumCol).toBe(55);
  });

  it('correctly evaluates AVERAGE formula', () => {
    // AVERAGE(B2:D2) => (10 + 20 + 30) / 3 = 20
    const avg = evaluateCellFormula('=AVERAGE(B2:D2)', sampleGrid);
    expect(avg).toBe(20);
  });

  it('correctly evaluates MIN and MAX formulas', () => {
    expect(evaluateCellFormula('=MIN(B2:D2)', sampleGrid)).toBe(10);
    expect(evaluateCellFormula('=MAX(B2:D2)', sampleGrid)).toBe(30);
  });

  it('correctly evaluates arithmetic cell expressions', () => {
    // B2 + C2 => 10 + 20 = 30
    const mathResult = evaluateCellFormula('=B2+C2', sampleGrid);
    expect(mathResult).toBe(30);
  });

  it('converts column letters and indices reciprocally', () => {
    expect(columnLetterToIndex('A')).toBe(0);
    expect(columnLetterToIndex('B')).toBe(1);
    expect(columnLetterToIndex('Z')).toBe(25);
    expect(columnLetterToIndex('AA')).toBe(26);

    expect(indexToColumnLetter(0)).toBe('A');
    expect(indexToColumnLetter(1)).toBe('B');
    expect(indexToColumnLetter(25)).toBe('Z');
  });
});

describe('Conversion Cancellation with AbortController', () => {
  it('aborts active conversion job immediately when AbortSignal triggers', async () => {
    const { executeFileConversion } = await import('../services/converter');
    const controller = new AbortController();
    controller.abort(); // already aborted signal

    const sampleFile = new File(['Hello World testing cancellation'], 'doc.txt', { type: 'text/plain' });

    await expect(
      executeFileConversion(sampleFile, 'txt', 'html', { signal: controller.signal })
    ).rejects.toThrow(/Conversion cancelled by user/);
  });
});
