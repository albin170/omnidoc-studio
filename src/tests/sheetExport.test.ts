import { describe, it, expect } from 'vitest';
import { 
  exportDataToCsvBlob, 
  exportDataToXlsxBlob, 
  exportMultiSheetWorkbookToBlob,
  evaluateCellFormula 
} from '../services/sheetService';

describe('Spreadsheet Export Capabilities', () => {
  const sampleData: (string | number)[][] = [
    ['Product', 'Q1 Revenue', 'Q2 Revenue', 'Growth'],
    ['OmniDoc Pro', 12500, 18200, '45.6%'],
    ['Enterprise Tier', 45000, 62000, '37.8%'],
  ];

  it('exports 2D data to a valid CSV blob with text/csv mime type', async () => {
    const csvBlob = exportDataToCsvBlob(sampleData);
    expect(csvBlob).toBeInstanceOf(Blob);
    expect(csvBlob.type).toContain('text/csv');
    expect(csvBlob.size).toBeGreaterThan(0);

    const text = await csvBlob.text();
    expect(text).toContain('Product');
    expect(text).toContain('OmniDoc Pro');
    expect(text).toContain('12500');
  });

  it('exports 2D data to a valid XLSX blob with spreadsheetml mime type', async () => {
    const xlsxBlob = exportDataToXlsxBlob(sampleData, 'Q1_Q2_Report');
    expect(xlsxBlob).toBeInstanceOf(Blob);
    expect(xlsxBlob.type).toContain('spreadsheetml');
    expect(xlsxBlob.size).toBeGreaterThan(100); // Standard ZIP container overhead
  });

  it('exports multiple worksheets to a valid multi-sheet XLSX blob', () => {
    const multiSheetData = {
      'Q1 Summary': [
        ['Metric', 'Target', 'Actual'],
        ['Revenue', 100000, 105000],
      ],
      'Q2 Summary': [
        ['Metric', 'Target', 'Actual'],
        ['Revenue', 120000, 128000],
      ],
    };

    const multiBlob = exportMultiSheetWorkbookToBlob(multiSheetData, ['Q1 Summary', 'Q2 Summary']);
    expect(multiBlob).toBeInstanceOf(Blob);
    expect(multiBlob.type).toContain('spreadsheetml');
    expect(multiBlob.size).toBeGreaterThan(100);
  });
});

describe('Spreadsheet Formula Engine', () => {
  const testGrid: (string | number)[][] = [
    ['Category', 'Amount', 'Status', 'Code'],
    ['Hardware', 100, 'Approved', 'HW-01'],
    ['Software', 250, 'Pending', 'SW-02'],
    ['Cloud', 400, 'Approved', 'CL-03'],
    ['Hardware', 150, 'Approved', 'HW-04'],
  ];

  it('evaluates standard math and aggregation functions correctly', () => {
    expect(evaluateCellFormula('=B2+B3', testGrid)).toBe(350);
    expect(evaluateCellFormula('=SUM(B2:B5)', testGrid)).toBe(900);
    expect(evaluateCellFormula('=AVERAGE(B2:B5)', testGrid)).toBe(225);
    expect(evaluateCellFormula('=MIN(B2:B5)', testGrid)).toBe(100);
    expect(evaluateCellFormula('=MAX(B2:B5)', testGrid)).toBe(400);
    expect(evaluateCellFormula('=COUNT(B2:B5)', testGrid)).toBe(4);
    expect(evaluateCellFormula('=COUNTA(A2:A5)', testGrid)).toBe(4);
  });

  it('evaluates IF conditions with comparisons correctly', () => {
    expect(evaluateCellFormula('=IF(B2>50, "High", "Low")', testGrid)).toBe('High');
    expect(evaluateCellFormula('=IF(B2>500, "High", "Low")', testGrid)).toBe('Low');
    expect(evaluateCellFormula('=IF(B2=100, 1, 0)', testGrid)).toBe(1);
    expect(evaluateCellFormula('=IF(C2="Approved", "Yes", "No")', testGrid)).toBe('Yes');
  });

  it('evaluates logical AND / OR formulas', () => {
    expect(evaluateCellFormula('=AND(B2>50, B3>200)', testGrid)).toBe(1);
    expect(evaluateCellFormula('=AND(B2>50, B3>500)', testGrid)).toBe(0);
    expect(evaluateCellFormula('=OR(B2>500, B3>200)', testGrid)).toBe(1);
    expect(evaluateCellFormula('=OR(B2>500, B3>500)', testGrid)).toBe(0);
  });

  it('evaluates ROUND and ABS formulas', () => {
    expect(evaluateCellFormula('=ROUND(123.456, 2)', testGrid)).toBe(123.46);
    expect(evaluateCellFormula('=ROUND(123.456, 0)', testGrid)).toBe(123);
    expect(evaluateCellFormula('=ABS(-42)', testGrid)).toBe(42);
  });

  it('evaluates CONCAT / CONCATENATE formulas', () => {
    expect(evaluateCellFormula('=CONCAT("Omni", "Doc", " ", 2026)', testGrid)).toBe('OmniDoc 2026');
  });

  it('evaluates COUNTIF and SUMIF formulas', () => {
    expect(evaluateCellFormula('=COUNTIF(A2:A5, "Hardware")', testGrid)).toBe(2);
    expect(evaluateCellFormula('=COUNTIF(B2:B5, ">150")', testGrid)).toBe(2);
    expect(evaluateCellFormula('=SUMIF(A2:A5, "Hardware", B2:B5)', testGrid)).toBe(250);
    expect(evaluateCellFormula('=SUMIF(B2:B5, ">150")', testGrid)).toBe(650);
  });

  it('evaluates VLOOKUP correctly', () => {
    expect(evaluateCellFormula('=VLOOKUP("Software", A2:D5, 2, FALSE)', testGrid)).toBe(250);
    expect(evaluateCellFormula('=VLOOKUP("Cloud", A2:D5, 4, FALSE)', testGrid)).toBe('CL-03');
    expect(evaluateCellFormula('=VLOOKUP("NonExistent", A2:D5, 2, FALSE)', testGrid)).toBe('#N/A');
  });

  it('handles division by zero and invalid syntax gracefully', () => {
    expect(evaluateCellFormula('=10/0', testGrid)).toBe('#DIV/0!');
    expect(evaluateCellFormula('=UNKNOWN_FUNC(A1)', testGrid)).toBe('#NAME?');
  });

  it('preserves formulas and number formatting across parse and export round trips', async () => {
    const { parseSpreadsheetFile } = await import('../services/sheetService');
    const inputGrid: (string | number)[][] = [
      ['Product', 'Price', 'Tax Rate', 'Total'],
      ['Widget', 100, 0.2, '=B2*(1+C2)'],
    ];

    const blob = exportMultiSheetWorkbookToBlob(
      { Sheet1: inputGrid },
      ['Sheet1'],
      {
        merges: { Sheet1: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }] },
        cellFormats: { Sheet1: { C2: '0.0%' } },
      }
    );

    const file = new File([blob], 'test_formulas.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const parsed = await parseSpreadsheetFile(file);
    expect(parsed.sheetNames).toContain('Sheet1');
    expect(parsed.data[1][3]).toBe('=B2*(1+C2)');
    expect(parsed.formulas?.Sheet1?.D2).toBe('=B2*(1+C2)');
    expect(parsed.cellFormats?.Sheet1?.C2).toBe('0.0%');
  });
});

