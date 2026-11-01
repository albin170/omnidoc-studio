import { describe, it, expect } from 'vitest';
import { exportDataToCsvBlob, exportDataToXlsxBlob } from '../services/sheetService';

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
});
