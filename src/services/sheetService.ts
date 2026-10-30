import * as XLSX from 'xlsx';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface ParsedSpreadsheet {
  sheetNames: string[];
  activeSheet: string;
  data: (string | number)[][];
  rowCount: number;
  colCount: number;
}

/**
 * Read and parse an XLSX or CSV file into a 2D array
 */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSpreadsheet> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetNames = workbook.SheetNames;
  const firstSheetName = sheetNames[0] || 'Sheet1';
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to 2D array of values
  const rawData: (string | number)[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
  });

  // Ensure reasonable minimum dimensions (e.g. at least 20 rows and 8 cols)
  const maxCols = Math.max(8, ...rawData.map((r) => r.length));
  const minRows = Math.max(25, rawData.length);

  const normalizedData: (string | number)[][] = [];
  for (let r = 0; r < minRows; r++) {
    const row = rawData[r] || [];
    const normalizedRow: (string | number)[] = [];
    for (let c = 0; c < maxCols; c++) {
      normalizedRow.push(row[c] !== undefined ? row[c] : '');
    }
    normalizedData.push(normalizedRow);
  }

  return {
    sheetNames,
    activeSheet: firstSheetName,
    data: normalizedData,
    rowCount: normalizedData.length,
    colCount: maxCols,
  };
}

/**
 * Convert 2D array back to an XLSX workbook blob
 */
export function exportDataToXlsxBlob(data: (string | number)[][], sheetName = 'Sheet1'): Blob {
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Convert 2D array to CSV text and blob
 */
export function exportDataToCsvBlob(data: (string | number)[][]): Blob {
  const ws = XLSX.utils.aoa_to_sheet(data);
  const csvText = XLSX.utils.sheet_to_csv(ws);
  return new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
}

/**
 * Evaluate standard spreadsheet formulas (SUM, AVERAGE, MIN, MAX, COUNT)
 */
export function evaluateCellFormula(
  formula: string,
  gridData: (string | number)[][]
): number | string {
  const clean = formula.trim().toUpperCase();
  if (!clean.startsWith('=')) return formula;

  const expression = clean.substring(1).trim();

  // Range matching e.g. SUM(A1:A5)
  const match = expression.match(/^([A-Z]+)\((([A-Z]+[0-9]+):([A-Z]+[0-9]+))\)$/);
  if (match) {
    const func = match[1];
    const startCell = match[3];
    const endCell = match[4];

    const values = getValuesInRange(startCell, endCell, gridData);
    const numericValues = values.filter((v) => typeof v === 'number' && !isNaN(v)) as number[];

    switch (func) {
      case 'SUM':
        return numericValues.reduce((a, b) => a + b, 0);
      case 'AVERAGE':
      case 'AVG':
        return numericValues.length ? +(numericValues.reduce((a, b) => a + b, 0) / numericValues.length).toFixed(2) : 0;
      case 'MIN':
        return numericValues.length ? Math.min(...numericValues) : 0;
      case 'MAX':
        return numericValues.length ? Math.max(...numericValues) : 0;
      case 'COUNT':
        return numericValues.length;
      default:
        return '#NAME?';
    }
  }

  // Simple arithmetic evaluation e.g. A1+B1 or 10*5
  try {
    const substituted = expression.replace(/([A-Z]+)([0-9]+)/g, (_, colStr, rowStr) => {
      const colIdx = columnLetterToIndex(colStr);
      const rowIdx = parseInt(rowStr, 10) - 1;
      const val = gridData[rowIdx]?.[colIdx];
      const num = typeof val === 'number' ? val : parseFloat(String(val) || '0');
      return isNaN(num) ? '0' : String(num);
    });

    // Safe mathematical evaluation (only digits, parens, and arithmetic symbols)
    if (/^[0-9+\-*/. ()]+$/.test(substituted)) {
      const result = Function(`'use strict'; return (${substituted})`)();
      return typeof result === 'number' && !isNaN(result) ? +result.toFixed(2) : '#VALUE!';
    }
  } catch (e) {
    return '#ERROR!';
  }

  return '#VALUE!';
}

/**
 * Get range of cell coordinates e.g. A1 to B3
 */
function getValuesInRange(
  startCell: string,
  endCell: string,
  gridData: (string | number)[][]
): (string | number)[] {
  const startMatch = startCell.match(/([A-Z]+)([0-9]+)/);
  const endMatch = endCell.match(/([A-Z]+)([0-9]+)/);
  if (!startMatch || !endMatch) return [];

  const startCol = columnLetterToIndex(startMatch[1]);
  const startRow = parseInt(startMatch[2], 10) - 1;
  const endCol = columnLetterToIndex(endMatch[1]);
  const endRow = parseInt(endMatch[2], 10) - 1;

  const minCol = Math.min(startCol, endCol);
  const maxCol = Math.max(startCol, endCol);
  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);

  const values: (string | number)[] = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const val = gridData[r]?.[c];
      if (val !== undefined && val !== '') {
        const num = typeof val === 'number' ? val : parseFloat(String(val));
        values.push(!isNaN(num) ? num : val);
      }
    }
  }

  return values;
}

export function columnLetterToIndex(col: string): number {
  let index = 0;
  for (let i = 0; i < col.length; i++) {
    index = index * 26 + (col.charCodeAt(i) - 64);
  }
  return index - 1;
}

export function indexToColumnLetter(idx: number): string {
  let letter = '';
  let temp = idx;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Export spreadsheet data to a structured table PDF report
 */
export async function convertSpreadsheetToPdf(
  data: (string | number)[][],
  title: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // A4 Landscape for tables
  const width = 841.89;
  const height = 595.28;
  const margin = 40;

  // Filter out completely empty trailing rows
  const activeRows = data.filter((row) => row.some((c) => String(c).trim() !== ''));
  const rowsToRender = activeRows.length > 0 ? activeRows : data.slice(0, 10);
  const maxCols = Math.min(10, Math.max(...rowsToRender.map((r) => r.length)));

  const colWidth = (width - margin * 2) / maxCols;
  const rowHeight = 22;

  let page = pdfDoc.addPage([width, height]);
  let cursorY = height - margin;

  // Title
  page.drawText(title || 'Spreadsheet Report', {
    x: margin,
    y: cursorY,
    size: 16,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.2),
  });
  cursorY -= 30;

  // Render rows
  for (let r = 0; r < rowsToRender.length; r++) {
    if (cursorY - rowHeight < margin) {
      page = pdfDoc.addPage([width, height]);
      cursorY = height - margin;
    }

    const isHeader = r === 0;
    const currentFont = isHeader ? boldFont : font;

    // Row background
    if (isHeader) {
      page.drawRectangle({
        x: margin,
        y: cursorY - rowHeight,
        width: width - margin * 2,
        height: rowHeight,
        color: rgb(0.9, 0.93, 0.98),
      });
    } else if (r % 2 === 1) {
      page.drawRectangle({
        x: margin,
        y: cursorY - rowHeight,
        width: width - margin * 2,
        height: rowHeight,
        color: rgb(0.98, 0.98, 0.99),
      });
    }

    // Border
    page.drawRectangle({
      x: margin,
      y: cursorY - rowHeight,
      width: width - margin * 2,
      height: rowHeight,
      borderWidth: 0.5,
      borderColor: rgb(0.8, 0.85, 0.9),
      color: undefined,
    });

    for (let c = 0; c < maxCols; c++) {
      const val = String(rowsToRender[r][c] || '');
      const cellX = margin + c * colWidth + 6;
      const cellY = cursorY - rowHeight + 6;

      const truncated = val.length > 18 ? val.substring(0, 16) + '...' : val;

      page.drawText(truncated, {
        x: cellX,
        y: cellY,
        size: isHeader ? 9 : 8.5,
        font: currentFont,
        color: isHeader ? rgb(0.1, 0.2, 0.4) : rgb(0.2, 0.2, 0.2),
      });
    }

    cursorY -= rowHeight;
  }

  return await pdfDoc.save();
}
