import * as XLSX from 'xlsx';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface ParsedSpreadsheet {
  sheetNames: string[];
  activeSheet: string;
  data: (string | number)[][];
  rowCount: number;
  colCount: number;
}

const MAX_SPREADSHEET_FILE_SIZE = 25 * 1024 * 1024; // 25 MB safety limit
const MAX_ALLOWED_ROWS = 5000;
const MAX_ALLOWED_COLS = 200;

/**
 * Deep-sanitizes an object/array to prevent prototype pollution attacks (CVE-2023-30533)
 */
export function sanitizeWorkbookData<T>(obj: T, depth = 0): T {
  if (depth > 20 || obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeWorkbookData(item, depth + 1)) as unknown as T;
  }

  const cleanObj = Object.create(null);
  for (const [key, value] of Object.entries(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    cleanObj[key] = sanitizeWorkbookData(value, depth + 1);
  }
  return cleanObj as T;
}

/**
 * Read and parse an XLSX or CSV file into a 2D array with prototype-pollution and ReDoS defenses
 */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSpreadsheet> {
  if (file.size > MAX_SPREADSHEET_FILE_SIZE) {
    throw new Error(`Spreadsheet exceeds maximum permitted memory allocation of 25MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
  }

  const arrayBuffer = await file.arrayBuffer();
  
  // Parse with safe options preventing prototype pollution & arbitrary code execution
  const workbook = XLSX.read(arrayBuffer, { 
    type: 'array',
    cellFormula: false, // Do not evaluate untrusted macros/formulas from file
    cellHTML: false,
    dense: false
  });

  const sheetNames = workbook.SheetNames.filter((name) => name !== '__proto__' && name !== 'constructor');
  if (sheetNames.length === 0) {
    throw new Error('Workbook contains no valid worksheets.');
  }

  const firstSheetName = sheetNames[0] || 'Sheet1';
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to 2D array of values
  const rawData: (string | number)[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  // Sanitize raw data array to eliminate prototype pollution vectors
  const sanitizedRows = sanitizeWorkbookData(rawData);

  // Enforce memory & ReDoS bounds
  const boundedRowCount = Math.min(sanitizedRows.length, MAX_ALLOWED_ROWS);
  const rowSlice = sanitizedRows.slice(0, boundedRowCount);

  const calculatedCols = Math.max(8, ...rowSlice.map((r) => Array.isArray(r) ? r.length : 0));
  const maxCols = Math.min(calculatedCols, MAX_ALLOWED_COLS);
  const minRows = Math.max(25, boundedRowCount);

  const normalizedData: (string | number)[][] = [];
  for (let r = 0; r < minRows; r++) {
    const row = rowSlice[r] || [];
    const normalizedRow: (string | number)[] = [];
    for (let c = 0; c < maxCols; c++) {
      const cellVal = row[c];
      normalizedRow.push(cellVal !== undefined && cellVal !== null ? cellVal : '');
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
  const cleanData = sanitizeWorkbookData(data);
  const ws = XLSX.utils.aoa_to_sheet(cleanData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Convert 2D array to CSV text and blob
 */
export function exportDataToCsvBlob(data: (string | number)[][]): Blob {
  const cleanData = sanitizeWorkbookData(data);
  const ws = XLSX.utils.aoa_to_sheet(cleanData);
  const csvText = XLSX.utils.sheet_to_csv(ws);
  return new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
}

/**
 * Safe Recursive-Descent Arithmetic Expression Parser (BUG-18 Fix).
 * Evaluates math expressions without using `Function()` or `eval()`.
 */
export function parseAndEvaluateMath(expr: string): number {
  let pos = 0;
  const str = expr.replace(/\s+/g, '');

  function peek(): string {
    return str[pos] || '';
  }

  function get(): string {
    return str[pos++] || '';
  }

  function parseExpression(): number {
    let result = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = get();
      const right = parseTerm();
      if (op === '+') result += right;
      else result -= right;
    }
    return result;
  }

  function parseTerm(): number {
    let result = parsePower();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = get();
      const right = parsePower();
      if (op === '*') {
        result *= right;
      } else if (op === '/') {
        if (right === 0) throw new Error('DIV_ZERO');
        result /= right;
      } else if (op === '%') {
        if (right === 0) throw new Error('DIV_ZERO');
        result %= right;
      }
    }
    return result;
  }

  function parsePower(): number {
    let result = parseUnary();
    if (peek() === '^') {
      get();
      const right = parsePower(); // Right-associative exponentiation
      result = Math.pow(result, right);
    }
    return result;
  }

  function parseUnary(): number {
    if (peek() === '+') {
      get();
      return parseUnary();
    }
    if (peek() === '-') {
      get();
      return -parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    if (peek() === '(') {
      get(); // '('
      const result = parseExpression();
      if (peek() !== ')') {
        throw new Error('MISMATCHED_PAREN');
      }
      get(); // ')'
      return result;
    }

    const start = pos;
    while (/[0-9.]/.test(peek())) {
      get();
    }

    if (start === pos) {
      throw new Error('UNEXPECTED_CHAR');
    }

    const numStr = str.substring(start, pos);
    const num = parseFloat(numStr);
    if (isNaN(num)) {
      throw new Error('INVALID_NUMBER');
    }
    return num;
  }

  const result = parseExpression();
  if (pos < str.length) {
    throw new Error('EXTRA_TOKENS');
  }
  return result;
}

/**
 * Evaluate standard spreadsheet formulas (SUM, AVERAGE, MIN, MAX, COUNT, and arithmetic)
 * Completely sandbox-safe: zero dynamic code generation or eval.
 */
export function evaluateCellFormula(
  formula: string,
  gridData: (string | number)[][]
): number | string {
  const clean = formula.trim().toUpperCase();
  if (!clean.startsWith('=')) return formula;

  const expression = clean.substring(1).trim();

  // Range functions e.g. SUM(A1:A5)
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

  // Arithmetic evaluation e.g. A1+B1 or (10*5)/2
  try {
    const substituted = expression.replace(/([A-Z]+)([0-9]+)/g, (_, colStr, rowStr) => {
      const colIdx = columnLetterToIndex(colStr);
      const rowIdx = parseInt(rowStr, 10) - 1;
      const val = gridData[rowIdx]?.[colIdx];
      const num = typeof val === 'number' ? val : parseFloat(String(val) || '0');
      return isNaN(num) ? '0' : String(num);
    });

    const evaluated = parseAndEvaluateMath(substituted);
    return isFinite(evaluated) ? +evaluated.toFixed(2) : '#VALUE!';
  } catch (err: any) {
    if (err?.message === 'DIV_ZERO') {
      return '#DIV/0!';
    }
    return '#VALUE!';
  }
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
      const row = gridData[r];
      if (row && row[c] !== undefined && row[c] !== '') {
        const val = row[c];
        const num = typeof val === 'number' ? val : parseFloat(String(val));
        values.push(!isNaN(num) ? num : val);
      }
    }
  }
  return values;
}

/**
 * Convert Excel column letters (A, B, Z, AA, AB) to 0-based column index
 */
export function columnLetterToIndex(column: string): number {
  let index = 0;
  for (let i = 0; i < column.length; i++) {
    index = index * 26 + (column.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Convert 0-based index to Excel column string (0 -> A, 27 -> AB)
 */
export function columnIndexToLetter(index: number): string {
  let temp = index + 1;
  let letter = '';
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

export const indexToColumnLetter = columnIndexToLetter;

/**
 * Compatibility wrapper supporting both (data, title) and (title, data) signatures
 */
export async function convertSpreadsheetToPdf(
  dataOrTitle: (string | number)[][] | string,
  titleOrData?: string | (string | number)[][]
): Promise<Uint8Array> {
  let title = 'Spreadsheet Export';
  let data: (string | number)[][] = [];

  if (Array.isArray(dataOrTitle)) {
    data = dataOrTitle;
    if (typeof titleOrData === 'string') {
      title = titleOrData;
    }
  } else if (typeof dataOrTitle === 'string') {
    title = dataOrTitle;
    if (Array.isArray(titleOrData)) {
      data = titleOrData;
    }
  }
  return convertSheetDataToPdf(title, data);
}

/**
 * Convert 2D spreadsheet data to a high-density, professional PDF report
 */
export async function convertSheetDataToPdf(
  title: string,
  data: (string | number)[][]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 842; // A4 Landscape
  const pageHeight = 595;
  const margin = 40;

  const nonBlankData = data.filter((row) => row.some((cell) => cell !== ''));
  const activeRows = nonBlankData.length > 0 ? nonBlankData : [['No Data Available']];
  const colCount = Math.min(12, Math.max(...activeRows.map((r) => r.length)));
  const colWidth = (pageWidth - margin * 2) / Math.max(1, colCount);
  const rowHeight = 22;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Header Title
  page.drawText(title || 'Spreadsheet Report', {
    x: margin,
    y: y - 10,
    size: 16,
    font: boldFont,
    color: rgb(0.09, 0.13, 0.24),
  });

  page.drawText(`Generated via OmniDoc Studio Secure Engine · ${new Date().toLocaleDateString()}`, {
    x: margin,
    y: y - 26,
    size: 9,
    font,
    color: rgb(0.4, 0.45, 0.55),
  });

  y -= 50;

  for (let r = 0; r < activeRows.length; r++) {
    if (y - rowHeight < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    const row = activeRows[r];
    const isHeader = r === 0;

    // Row Background
    if (isHeader) {
      page.drawRectangle({
        x: margin,
        y: y - rowHeight + 4,
        width: pageWidth - margin * 2,
        height: rowHeight,
        color: rgb(0.12, 0.22, 0.45),
      });
    } else if (r % 2 === 1) {
      page.drawRectangle({
        x: margin,
        y: y - rowHeight + 4,
        width: pageWidth - margin * 2,
        height: rowHeight,
        color: rgb(0.96, 0.97, 0.99),
      });
    }

    // Cell Texts
    for (let c = 0; c < colCount; c++) {
      const cellVal = String(row[c] !== undefined ? row[c] : '');
      const truncated = cellVal.length > 25 ? cellVal.slice(0, 23) + '…' : cellVal;
      page.drawText(truncated, {
        x: margin + c * colWidth + 6,
        y: y - 12,
        size: 9,
        font: isHeader ? boldFont : font,
        color: isHeader ? rgb(1, 1, 1) : rgb(0.15, 0.2, 0.3),
      });
    }

    y -= rowHeight;
  }

  return await pdfDoc.save();
}
