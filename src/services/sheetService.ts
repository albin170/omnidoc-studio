import * as XLSX from 'xlsx';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface ParsedSpreadsheet {
  sheetNames: string[];
  activeSheet: string;
  sheets: Record<string, (string | number)[][]>;
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
 * Read and parse an XLSX or CSV file into a multi-sheet dictionary and 2D array with prototype-pollution and ReDoS defenses
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

  const sheets: Record<string, (string | number)[][]> = {};

  for (const sName of sheetNames) {
    const worksheet = workbook.Sheets[sName];
    if (!worksheet) continue;

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
    sheets[sName] = normalizedData;
  }

  const firstSheetName = sheetNames[0] || 'Sheet1';
  const firstData = sheets[firstSheetName] || [];

  return {
    sheetNames,
    activeSheet: firstSheetName,
    sheets,
    data: firstData,
    rowCount: firstData.length,
    colCount: firstData[0]?.length || 8,
  };
}

/**
 * Convert multiple 2D sheet arrays into a multi-sheet XLSX workbook blob
 */
export function exportMultiSheetWorkbookToBlob(
  sheets: Record<string, (string | number)[][]>,
  sheetOrder?: string[]
): Blob {
  const wb = XLSX.utils.book_new();
  const names = sheetOrder && sheetOrder.length > 0 ? sheetOrder : Object.keys(sheets);
  for (const name of names) {
    const sheetData = sheets[name];
    if (!sheetData) continue;
    const cleanData = sanitizeWorkbookData(sheetData);
    const ws = XLSX.utils.aoa_to_sheet(cleanData);

    // Compute automatic column widths so columns are never cramped
    const colWidths: { wch: number }[] = [];
    const maxCols = Math.max(0, ...cleanData.map((r) => Array.isArray(r) ? r.length : 0));
    for (let c = 0; c < maxCols; c++) {
      let maxLen = 10;
      for (let r = 0; r < Math.min(cleanData.length, 100); r++) {
        const val = cleanData[r]?.[c];
        if (val !== undefined && val !== null) {
          const s = String(val);
          if (s.length > maxLen) maxLen = Math.min(s.length + 3, 50);
        }
      }
      colWidths.push({ wch: maxLen });
    }
    ws['!cols'] = colWidths;

    // Enrich cells with real Excel formulas and pre-calculated cached values
    for (let r = 0; r < cleanData.length; r++) {
      if (!Array.isArray(cleanData[r])) continue;
      for (let c = 0; c < cleanData[r].length; c++) {
        const val = cleanData[r][c];
        if (typeof val === 'string' && val.startsWith('=')) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          if (ws[cellRef]) {
            const computed = evaluateCellFormula(val, cleanData);
            ws[cellRef].f = val.substring(1);
            ws[cellRef].v = typeof computed === 'number' ? computed : String(computed);
            ws[cellRef].t = typeof computed === 'number' ? 'n' : 's';
          }
        }
      }
    }

    // Excel sheet name limit is 31 characters
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Convert 2D array back to an XLSX workbook blob
 */
export function exportDataToXlsxBlob(data: (string | number)[][], sheetName = 'Sheet1'): Blob {
  return exportMultiSheetWorkbookToBlob({ [sheetName]: data });
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
 * Splits top-level arguments by comma, ignoring commas inside parentheses and string literals
 */
function splitTopLevelArgs(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let parenDepth = 0;
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if (inQuote) {
      current += ch;
      if (ch === quoteChar) {
        inQuote = false;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
      current += ch;
    } else if (ch === '(') {
      parenDepth++;
      current += ch;
    } else if (ch === ')') {
      parenDepth--;
      current += ch;
    } else if (ch === ',' && parenDepth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim().length > 0) {
    args.push(current.trim());
  }
  return args;
}

/**
 * Checks if a string matches a top-level function call like FUNC(arg1, arg2)
 */
function matchTopLevelFunction(expr: string): { name: string; argsStr: string } | null {
  const trimmed = expr.trim();
  const match = trimmed.match(/^([A-Z_]+)\s*\(/);
  if (!match) return null;

  const name = match[1];
  const openIdx = trimmed.indexOf('(');
  let depth = 0;
  let inQuote = false;
  let quoteChar = '';

  for (let i = openIdx; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inQuote) {
      if (ch === quoteChar) inQuote = false;
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0) {
        if (i === trimmed.length - 1) {
          const argsStr = trimmed.substring(openIdx + 1, i);
          return { name, argsStr };
        }
        return null;
      }
    }
  }
  return null;
}

function findTopLevelComparison(expr: string): { left: string; op: string; right: string } | null {
  let parenDepth = 0;
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (inQuote) {
      if (ch === quoteChar) inQuote = false;
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === '(') {
      parenDepth++;
    } else if (ch === ')') {
      parenDepth--;
    } else if (parenDepth === 0) {
      // Check 2-character ops first: >=, <=, <>, !=
      const two = expr.substring(i, i + 2);
      if (two === '>=' || two === '<=' || two === '<>' || two === '!=') {
        return {
          left: expr.substring(0, i).trim(),
          op: two,
          right: expr.substring(i + 2).trim(),
        };
      }
      // Check 1-character ops: >, <, =
      if (ch === '>' || ch === '<' || ch === '=') {
        return {
          left: expr.substring(0, i).trim(),
          op: ch,
          right: expr.substring(i + 1).trim(),
        };
      }
    }
  }
  return null;
}

/**
 * Strips surrounding quotes from string literals
 */
function stripQuotes(str: string): string {
  const trimmed = str.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Checks if a value satisfies an Excel-style criteria string (e.g. ">50", "<=10", "<>Apple", "Pass")
 */
function matchesCriteria(cellVal: string | number, criteria: string | number): boolean {
  const criteriaStr = String(criteria).trim();
  const numCell = typeof cellVal === 'number' ? cellVal : parseFloat(String(cellVal));
  const isCellNum = !isNaN(numCell);

  const compMatch = criteriaStr.match(/^(>=|<=|<>|!=|>|<|=)(.*)$/);
  if (compMatch) {
    const op = compMatch[1];
    const targetStr = compMatch[2].trim();
    const numTarget = parseFloat(targetStr);
    const isTargetNum = !isNaN(numTarget);

    if (isCellNum && isTargetNum) {
      switch (op) {
        case '>': return numCell > numTarget;
        case '<': return numCell < numTarget;
        case '>=': return numCell >= numTarget;
        case '<=': return numCell <= numTarget;
        case '<>':
        case '!=': return numCell !== numTarget;
        case '=': return numCell === numTarget;
      }
    } else {
      const sCell = String(cellVal).toLowerCase();
      const sTarget = stripQuotes(targetStr).toLowerCase();
      switch (op) {
        case '=': return sCell === sTarget;
        case '<>':
        case '!=': return sCell !== sTarget;
        case '>': return sCell > sTarget;
        case '<': return sCell < sTarget;
        case '>=': return sCell >= sTarget;
        case '<=': return sCell <= sTarget;
      }
    }
  }

  // Exact comparison
  if (isCellNum && !isNaN(parseFloat(criteriaStr))) {
    return numCell === parseFloat(criteriaStr);
  }
  return String(cellVal).trim().toLowerCase() === stripQuotes(criteriaStr).toLowerCase();
}

/**
 * Extract 2D matrix range from coordinates (e.g. A1 to C10)
 */
export function getRangeGrid(
  startCell: string,
  endCell: string,
  gridData: (string | number)[][]
): (string | number)[][] {
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

  const result: (string | number)[][] = [];
  for (let r = minRow; r <= maxRow; r++) {
    const rowSlice: (string | number)[] = [];
    for (let c = minCol; c <= maxCol; c++) {
      const val = gridData[r]?.[c];
      rowSlice.push(val !== undefined && val !== null ? val : '');
    }
    result.push(rowSlice);
  }
  return result;
}

/**
 * Evaluate standard and advanced spreadsheet formulas
 * Supports: SUM, AVERAGE/AVG, MIN, MAX, COUNT, COUNTA, IF, AND, OR, ROUND, ABS, CONCAT, COUNTIF, SUMIF, VLOOKUP
 * Completely sandbox-safe: zero dynamic code generation or eval.
 */
export function evaluateCellFormula(
  formula: string,
  gridData: (string | number)[][],
  depth = 0
): number | string {
  if (depth > 15) return '#CIRCULAR!';

  const clean = formula.trim();
  if (!clean.startsWith('=')) return formula;

  const expression = clean.substring(1).trim();
  if (!expression) return '';

  return evaluateExpressionInternal(expression, gridData, depth);
}

function evaluateExpressionInternal(
  expression: string,
  gridData: (string | number)[][],
  depth: number
): number | string {
  if (depth > 15) return '#CIRCULAR!';
  const trimmed = expression.trim();

  // Quoted string literal
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  // Boolean constants
  if (trimmed.toUpperCase() === 'TRUE') return 1;
  if (trimmed.toUpperCase() === 'FALSE') return 0;

  // Standalone cell coordinate e.g. A1, B12
  const singleCellMatch = trimmed.match(/^([A-Z]+)([0-9]+)$/i);
  if (singleCellMatch) {
    const colIdx = columnLetterToIndex(singleCellMatch[1].toUpperCase());
    const rowIdx = parseInt(singleCellMatch[2], 10) - 1;
    const cellVal = gridData[rowIdx]?.[colIdx];
    if (cellVal === undefined || cellVal === null || cellVal === '') return 0;
    if (typeof cellVal === 'string' && cellVal.startsWith('=')) {
      return evaluateCellFormula(cellVal, gridData, depth + 1);
    }
    const num = typeof cellVal === 'number' ? cellVal : parseFloat(String(cellVal));
    return isNaN(num) ? cellVal : num;
  }

  // Top-level comparison expression e.g. B2 > 50 or A1 = "Hardware"
  const comp = findTopLevelComparison(trimmed);
  if (comp) {
    const leftRes = evaluateExpressionInternal(comp.left, gridData, depth + 1);
    const rightRes = evaluateExpressionInternal(comp.right, gridData, depth + 1);

    const leftNum = typeof leftRes === 'number' ? leftRes : parseFloat(String(leftRes));
    const rightNum = typeof rightRes === 'number' ? rightRes : parseFloat(String(rightRes));
    const bothNum = !isNaN(leftNum) && !isNaN(rightNum);

    if (bothNum) {
      switch (comp.op) {
        case '>': return leftNum > rightNum ? 1 : 0;
        case '<': return leftNum < rightNum ? 1 : 0;
        case '>=': return leftNum >= rightNum ? 1 : 0;
        case '<=': return leftNum <= rightNum ? 1 : 0;
        case '=': return leftNum === rightNum ? 1 : 0;
        case '<>':
        case '!=': return leftNum !== rightNum ? 1 : 0;
      }
    } else {
      const leftStr = String(leftRes).toLowerCase();
      const rightStr = String(rightRes).toLowerCase();
      switch (comp.op) {
        case '=': return leftStr === rightStr ? 1 : 0;
        case '<>':
        case '!=': return leftStr !== rightStr ? 1 : 0;
        case '>': return leftStr > rightStr ? 1 : 0;
        case '<': return leftStr < rightStr ? 1 : 0;
        case '>=': return leftStr >= rightStr ? 1 : 0;
        case '<=': return leftStr <= rightStr ? 1 : 0;
      }
    }
  }

  // Top-level function call
  const funcCall = matchTopLevelFunction(trimmed);
  if (funcCall) {
    const funcName = funcCall.name.toUpperCase();
    const rawArgs = splitTopLevelArgs(funcCall.argsStr);

    switch (funcName) {
      case 'SUM': {
        const values: number[] = [];
        for (const arg of rawArgs) {
          const rangeMatch = arg.match(/^([A-Z]+[0-9]+):([A-Z]+[0-9]+)$/i);
          if (rangeMatch) {
            const vals = getValuesInRange(rangeMatch[1].toUpperCase(), rangeMatch[2].toUpperCase(), gridData);
            for (const v of vals) {
              const n = typeof v === 'number' ? v : parseFloat(String(v));
              if (!isNaN(n)) values.push(n);
            }
          } else {
            const res = evaluateExpressionInternal(arg, gridData, depth + 1);
            const n = typeof res === 'number' ? res : parseFloat(String(res));
            if (!isNaN(n)) values.push(n);
          }
        }
        return values.reduce((a, b) => a + b, 0);
      }

      case 'AVERAGE':
      case 'AVG': {
        const values: number[] = [];
        for (const arg of rawArgs) {
          const rangeMatch = arg.match(/^([A-Z]+[0-9]+):([A-Z]+[0-9]+)$/i);
          if (rangeMatch) {
            const vals = getValuesInRange(rangeMatch[1].toUpperCase(), rangeMatch[2].toUpperCase(), gridData);
            for (const v of vals) {
              const n = typeof v === 'number' ? v : parseFloat(String(v));
              if (!isNaN(n)) values.push(n);
            }
          } else {
            const res = evaluateExpressionInternal(arg, gridData, depth + 1);
            const n = typeof res === 'number' ? res : parseFloat(String(res));
            if (!isNaN(n)) values.push(n);
          }
        }
        return values.length ? +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : 0;
      }

      case 'MIN': {
        const values: number[] = [];
        for (const arg of rawArgs) {
          const rangeMatch = arg.match(/^([A-Z]+[0-9]+):([A-Z]+[0-9]+)$/i);
          if (rangeMatch) {
            const vals = getValuesInRange(rangeMatch[1].toUpperCase(), rangeMatch[2].toUpperCase(), gridData);
            for (const v of vals) {
              const n = typeof v === 'number' ? v : parseFloat(String(v));
              if (!isNaN(n)) values.push(n);
            }
          } else {
            const res = evaluateExpressionInternal(arg, gridData, depth + 1);
            const n = typeof res === 'number' ? res : parseFloat(String(res));
            if (!isNaN(n)) values.push(n);
          }
        }
        return values.length ? Math.min(...values) : 0;
      }

      case 'MAX': {
        const values: number[] = [];
        for (const arg of rawArgs) {
          const rangeMatch = arg.match(/^([A-Z]+[0-9]+):([A-Z]+[0-9]+)$/i);
          if (rangeMatch) {
            const vals = getValuesInRange(rangeMatch[1].toUpperCase(), rangeMatch[2].toUpperCase(), gridData);
            for (const v of vals) {
              const n = typeof v === 'number' ? v : parseFloat(String(v));
              if (!isNaN(n)) values.push(n);
            }
          } else {
            const res = evaluateExpressionInternal(arg, gridData, depth + 1);
            const n = typeof res === 'number' ? res : parseFloat(String(res));
            if (!isNaN(n)) values.push(n);
          }
        }
        return values.length ? Math.max(...values) : 0;
      }

      case 'COUNT': {
        let count = 0;
        for (const arg of rawArgs) {
          const rangeMatch = arg.match(/^([A-Z]+[0-9]+):([A-Z]+[0-9]+)$/i);
          if (rangeMatch) {
            const vals = getValuesInRange(rangeMatch[1].toUpperCase(), rangeMatch[2].toUpperCase(), gridData);
            for (const v of vals) {
              const n = typeof v === 'number' ? v : parseFloat(String(v));
              if (!isNaN(n)) count++;
            }
          } else {
            const res = evaluateExpressionInternal(arg, gridData, depth + 1);
            const n = typeof res === 'number' ? res : parseFloat(String(res));
            if (!isNaN(n)) count++;
          }
        }
        return count;
      }

      case 'COUNTA': {
        let count = 0;
        for (const arg of rawArgs) {
          const rangeMatch = arg.match(/^([A-Z]+[0-9]+):([A-Z]+[0-9]+)$/i);
          if (rangeMatch) {
            const vals = getValuesInRange(rangeMatch[1].toUpperCase(), rangeMatch[2].toUpperCase(), gridData);
            for (const v of vals) {
              if (v !== '' && v !== null && v !== undefined) count++;
            }
          } else {
            const res = evaluateExpressionInternal(arg, gridData, depth + 1);
            if (res !== '' && res !== null && res !== undefined) count++;
          }
        }
        return count;
      }

      case 'ROUND': {
        if (rawArgs.length < 1) return '#VALUE!';
        const numVal = Number(evaluateExpressionInternal(rawArgs[0], gridData, depth + 1));
        const decimals = rawArgs.length > 1 ? Number(evaluateExpressionInternal(rawArgs[1], gridData, depth + 1)) : 0;
        if (isNaN(numVal) || isNaN(decimals)) return '#VALUE!';
        const factor = Math.pow(10, decimals);
        return Math.round(numVal * factor) / factor;
      }

      case 'ABS': {
        if (rawArgs.length < 1) return '#VALUE!';
        const numVal = Number(evaluateExpressionInternal(rawArgs[0], gridData, depth + 1));
        return isNaN(numVal) ? '#VALUE!' : Math.abs(numVal);
      }

      case 'CONCAT':
      case 'CONCATENATE': {
        return rawArgs
          .map((arg) => {
            const rangeMatch = arg.match(/^([A-Z]+[0-9]+):([A-Z]+[0-9]+)$/i);
            if (rangeMatch) {
              const vals = getValuesInRange(rangeMatch[1].toUpperCase(), rangeMatch[2].toUpperCase(), gridData);
              return vals.join('');
            }
            return String(evaluateExpressionInternal(arg, gridData, depth + 1));
          })
          .join('');
      }

      case 'IF': {
        if (rawArgs.length < 2) return '#VALUE!';
        const conditionExpr = rawArgs[0];
        const trueExpr = rawArgs[1];
        const falseExpr = rawArgs[2] !== undefined ? rawArgs[2] : '""';

        const condVal = evaluateExpressionInternal(conditionExpr, gridData, depth + 1);
        const condResult = Boolean(condVal && condVal !== '0' && condVal !== 0 && condVal !== 'FALSE');

        return condResult
          ? evaluateExpressionInternal(trueExpr, gridData, depth + 1)
          : evaluateExpressionInternal(falseExpr, gridData, depth + 1);
      }

      case 'AND': {
        for (const arg of rawArgs) {
          const res = evaluateExpressionInternal(arg, gridData, depth + 1);
          if (!res || res === 0 || res === '0' || res === 'FALSE') return 0;
        }
        return 1;
      }

      case 'OR': {
        for (const arg of rawArgs) {
          const res = evaluateExpressionInternal(arg, gridData, depth + 1);
          if (res && res !== 0 && res !== '0' && res !== 'FALSE') return 1;
        }
        return 0;
      }

      case 'COUNTIF': {
        if (rawArgs.length < 2) return '#VALUE!';
        const rangeMatch = rawArgs[0].match(/^([A-Z]+[0-9]+):([A-Z]+[0-9]+)$/i);
        if (!rangeMatch) return '#VALUE!';
        const criteria = stripQuotes(String(evaluateExpressionInternal(rawArgs[1], gridData, depth + 1)));
        const values = getValuesInRange(rangeMatch[1].toUpperCase(), rangeMatch[2].toUpperCase(), gridData);
        let count = 0;
        for (const val of values) {
          if (matchesCriteria(val, criteria)) count++;
        }
        return count;
      }

      case 'SUMIF': {
        if (rawArgs.length < 2) return '#VALUE!';
        const rangeMatch = rawArgs[0].match(/^([A-Z]+[0-9]+):([A-Z]+[0-9]+)$/i);
        if (!rangeMatch) return '#VALUE!';
        const criteria = stripQuotes(String(evaluateExpressionInternal(rawArgs[1], gridData, depth + 1)));

        const testValues = getValuesInRange(rangeMatch[1].toUpperCase(), rangeMatch[2].toUpperCase(), gridData);
        let sumValues = testValues;

        if (rawArgs[2]) {
          const sumRangeMatch = rawArgs[2].match(/^([A-Z]+[0-9]+):([A-Z]+[0-9]+)$/i);
          if (sumRangeMatch) {
            sumValues = getValuesInRange(sumRangeMatch[1].toUpperCase(), sumRangeMatch[2].toUpperCase(), gridData);
          }
        }

        let total = 0;
        for (let i = 0; i < testValues.length; i++) {
          if (matchesCriteria(testValues[i], criteria)) {
            const raw = sumValues[i];
            const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
            if (!isNaN(n)) total += n;
          }
        }
        return total;
      }

      case 'VLOOKUP': {
        if (rawArgs.length < 3) return '#VALUE!';
        const lookupVal = evaluateExpressionInternal(rawArgs[0], gridData, depth + 1);
        const rangeMatch = rawArgs[1].match(/^([A-Z]+[0-9]+):([A-Z]+[0-9]+)$/i);
        if (!rangeMatch) return '#VALUE!';

        const colIndex = Number(evaluateExpressionInternal(rawArgs[2], gridData, depth + 1));
        if (isNaN(colIndex) || colIndex < 1) return '#VALUE!';

        const subgrid = getRangeGrid(rangeMatch[1].toUpperCase(), rangeMatch[2].toUpperCase(), gridData);
        const targetColIdx = colIndex - 1;

        const sLookup = String(lookupVal).trim().toLowerCase();
        for (const row of subgrid) {
          const firstVal = String(row[0] !== undefined ? row[0] : '').trim().toLowerCase();
          if (firstVal === sLookup) {
            const matchedVal = row[targetColIdx];
            return matchedVal !== undefined ? matchedVal : '';
          }
        }
        return '#N/A';
      }

      default:
        return '#NAME?';
    }
  }

  // Arithmetic expression fallback e.g. A1 + B1 * 2 or (10*5)/2
  try {
    const substituted = trimmed.replace(/([A-Z]+)([0-9]+)/gi, (_, colStr, rowStr) => {
      const colIdx = columnLetterToIndex(colStr.toUpperCase());
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
export function getValuesInRange(
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
