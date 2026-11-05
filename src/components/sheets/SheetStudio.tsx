import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  DownloadCloud, 
  Plus, 
  Minus, 
  Save, 
  Calculator,
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  BarChart2,
  Undo2,
  Redo2,
  Search,
  ArrowUpDown,
  Copy,
  Trash2,
  Edit2,
  X
} from 'lucide-react';
import { 
  convertSpreadsheetToPdf, 
  evaluateCellFormula, 
  exportDataToCsvBlob, 
  exportMultiSheetWorkbookToBlob,
  indexToColumnLetter, 
  parseSpreadsheetFile 
} from '../../services/sheetService';
import saveAs from 'file-saver';
import confetti from 'canvas-confetti';

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: 'left' | 'center' | 'right';
  color?: string;
  bgColor?: string;
  format?: 'general' | 'currency' | 'percent' | 'number';
}

interface SheetStudioProps {
  initialTitle?: string;
  initialData?: (string | number)[][];
  onSaveToProjects?: (title: string, data: any) => void;
}

const DEFAULT_SHEET_NAME = 'Sheet1';
const INITIAL_DEMO_DATA: (string | number)[][] = [
  ['Category', 'Q1 Target', 'Q2 Target', 'Q3 Target', 'Q4 Target', 'Annual Total'],
  ['SaaS Subscriptions', 14500, 18200, 22400, 28000, '=SUM(B2:E2)'],
  ['Enterprise Licenses', 32000, 36000, 42000, 51000, '=SUM(B3:E3)'],
  ['Professional Services', 8500, 9200, 11000, 13500, '=SUM(B4:E4)'],
  ['Cloud Infrastructure', -4200, -4800, -5600, -6800, '=SUM(B5:E5)'],
  ['Net Operating Income', '=B2+B3+B4+B5', '=C2+C3+C4+C5', '=D2+D3+D4+D5', '=E2+E3+E4+E5', '=SUM(F2:F5)'],
  ['Average Quarterly Revenue', '=AVERAGE(B2:B4)', '=AVERAGE(C2:C4)', '=AVERAGE(D2:D4)', '=AVERAGE(E2:E4)', ''],
];

export const SheetStudio: React.FC<SheetStudioProps> = ({
  initialTitle,
  initialData,
  onSaveToProjects,
}) => {
  const [sheetTitle, setSheetTitle] = useState(initialTitle || 'Financial Analysis');

  // Multi-sheet State
  const [sheetOrder, setSheetOrder] = useState<string[]>([DEFAULT_SHEET_NAME]);
  const [activeSheetName, setActiveSheetName] = useState<string>(DEFAULT_SHEET_NAME);
  const [sheets, setSheets] = useState<Record<string, (string | number)[][]>>({
    [DEFAULT_SHEET_NAME]: initialData || INITIAL_DEMO_DATA,
  });

  // Cell Formatting Dictionary: sheetName -> 'r_c' -> CellStyle
  const [cellStyles, setCellStyles] = useState<Record<string, Record<string, CellStyle>>>({});

  // Active cell & formula input
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [formulaInput, setFormulaInput] = useState<string>('Category');
  const [isExporting, setIsExporting] = useState(false);

  // History for Undo/Redo
  const [history, setHistory] = useState<(string | number)[][][]>([]);
  const [redoStack, setRedoStack] = useState<(string | number)[][][]>([]);

  // Search & Replace bar
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');

  // Chart modal
  const [showChartModal, setShowChartModal] = useState(false);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'area'>('bar');

  // Sheet rename state
  const [renamingSheet, setRenamingSheet] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const gridData = sheets[activeSheetName] || [];
  const currentStyles = cellStyles[activeSheetName] || {};
  const rowCount = gridData.length;
  const colCount = Math.max(8, ...gridData.map((r) => r.length));

  useEffect(() => {
    if (initialTitle) setSheetTitle(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    if (initialData && Array.isArray(initialData) && initialData.length > 0) {
      setSheets((prev) => ({
        ...prev,
        [activeSheetName]: initialData,
      }));
    }
  }, [initialData]);

  // Update current gridData with undo snapshot
  const updateActiveGridData = (newData: (string | number)[][], pushHistory = true) => {
    if (pushHistory) {
      setHistory((prev) => [...prev.slice(-30), gridData]);
      setRedoStack([]);
    }
    setSheets((prev) => ({
      ...prev,
      [activeSheetName]: newData,
    }));
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setRedoStack((prev) => [gridData, ...prev]);
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setSheets((prev) => ({
      ...prev,
      [activeSheetName]: previous,
    }));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setHistory((prev) => [...prev, gridData]);
    setRedoStack((prev) => prev.slice(1));
    setSheets((prev) => ({
      ...prev,
      [activeSheetName]: next,
    }));
  };

  // Cell selection
  const handleSelectCell = (r: number, c: number) => {
    setSelectedCell({ r, c });
    const val = gridData[r]?.[c];
    setFormulaInput(val !== undefined ? String(val) : '');
  };

  const handleCellChange = (r: number, c: number, newVal: string) => {
    const copy = gridData.map((row) => [...row]);
    while (copy.length <= r) copy.push([]);
    copy[r][c] = newVal;
    updateActiveGridData(copy);
    setFormulaInput(newVal);
  };

  const handleFormulaCommit = (newVal: string) => {
    handleCellChange(selectedCell.r, selectedCell.c, newVal);
  };

  // Format toggles
  const activeCellKey = `${selectedCell.r}_${selectedCell.c}`;
  const activeStyle = currentStyles[activeCellKey] || {};

  const toggleCellStyle = (property: keyof CellStyle, value: any) => {
    setCellStyles((prev) => {
      const sheetDict = { ...(prev[activeSheetName] || {}) };
      const current = sheetDict[activeCellKey] || {};
      sheetDict[activeCellKey] = {
        ...current,
        [property]: current[property] === value ? undefined : value,
      };
      return {
        ...prev,
        [activeSheetName]: sheetDict,
      };
    });
  };

  const setCellFormatType = (format: 'general' | 'currency' | 'percent' | 'number') => {
    setCellStyles((prev) => {
      const sheetDict = { ...(prev[activeSheetName] || {}) };
      const current = sheetDict[activeCellKey] || {};
      sheetDict[activeCellKey] = { ...current, format };
      return {
        ...prev,
        [activeSheetName]: sheetDict,
      };
    });
  };

  // Row & Column operations
  const addRow = () => {
    const copy = [...gridData, new Array(colCount).fill('')];
    updateActiveGridData(copy);
  };

  const removeRow = () => {
    if (gridData.length <= 1) return;
    const copy = gridData.slice(0, gridData.length - 1);
    updateActiveGridData(copy);
  };

  const addColumn = () => {
    const copy = gridData.map((row) => [...row, '']);
    updateActiveGridData(copy);
  };

  // Sorting
  const handleSortColumn = (ascending: boolean) => {
    if (gridData.length <= 1) return;
    const headerRow = gridData[0];
    const dataRows = gridData.slice(1);
    const c = selectedCell.c;

    dataRows.sort((rowA, rowB) => {
      const aVal = rowA[c];
      const bVal = rowB[c];
      const numA = parseFloat(String(aVal));
      const numB = parseFloat(String(bVal));
      if (!isNaN(numA) && !isNaN(numB)) {
        return ascending ? numA - numB : numB - numA;
      }
      return ascending
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    updateActiveGridData([headerRow, ...dataRows]);
  };

  // Search & Replace
  const handleSearchAndReplace = (replaceAll = false) => {
    if (!searchQuery) return;
    const copy = gridData.map((row) => [...row]);
    let replacedCount = 0;

    for (let r = 0; r < copy.length; r++) {
      for (let c = 0; c < copy[r].length; c++) {
        const strVal = String(copy[r][c] || '');
        if (strVal.includes(searchQuery)) {
          if (replaceAll) {
            copy[r][c] = strVal.replaceAll(searchQuery, replaceQuery);
            replacedCount++;
          } else {
            copy[r][c] = strVal.replace(searchQuery, replaceQuery);
            updateActiveGridData(copy);
            return;
          }
        }
      }
    }
    if (replacedCount > 0) {
      updateActiveGridData(copy);
    }
  };

  // Multi-sheet operations
  const handleAddSheet = () => {
    let index = sheetOrder.length + 1;
    let newName = `Sheet${index}`;
    while (sheetOrder.includes(newName)) {
      index++;
      newName = `Sheet${index}`;
    }

    const blankSheet: (string | number)[][] = Array.from({ length: 25 }, () => new Array(8).fill(''));
    setSheets((prev) => ({ ...prev, [newName]: blankSheet }));
    setSheetOrder((prev) => [...prev, newName]);
    setActiveSheetName(newName);
    setSelectedCell({ r: 0, c: 0 });
    setFormulaInput('');
  };

  const handleDuplicateSheet = (sheetName: string) => {
    const newName = `${sheetName} Copy`;
    const cloned = (sheets[sheetName] || []).map((row) => [...row]);
    setSheets((prev) => ({ ...prev, [newName]: cloned }));
    setSheetOrder((prev) => [...prev, newName]);
    setActiveSheetName(newName);
  };

  const handleDeleteSheet = (sheetName: string) => {
    if (sheetOrder.length <= 1) {
      alert('Cannot delete the only worksheet in the workbook.');
      return;
    }
    const newOrder = sheetOrder.filter((n) => n !== sheetName);
    setSheetOrder(newOrder);
    setSheets((prev) => {
      const copy = { ...prev };
      delete copy[sheetName];
      return copy;
    });
    if (activeSheetName === sheetName) {
      setActiveSheetName(newOrder[0]);
    }
  };

  const handleStartRename = (sheetName: string) => {
    setRenamingSheet(sheetName);
    setRenameValue(sheetName);
  };

  const handleCommitRename = () => {
    if (!renamingSheet || !renameValue.trim() || renamingSheet === renameValue.trim()) {
      setRenamingSheet(null);
      return;
    }
    const target = renameValue.trim().slice(0, 31);
    if (sheetOrder.includes(target) && target !== renamingSheet) {
      alert('A sheet with that name already exists.');
      return;
    }

    setSheetOrder((prev) => prev.map((n) => (n === renamingSheet ? target : n)));
    setSheets((prev) => {
      const copy = { ...prev };
      copy[target] = copy[renamingSheet];
      delete copy[renamingSheet];
      return copy;
    });
    setCellStyles((prev) => {
      const copy = { ...prev };
      copy[target] = copy[renamingSheet];
      delete copy[renamingSheet];
      return copy;
    });

    if (activeSheetName === renamingSheet) {
      setActiveSheetName(target);
    }
    setRenamingSheet(null);
  };

  // Import handler
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseSpreadsheetFile(file);
      setSheetOrder(parsed.sheetNames);
      setSheets(parsed.sheets);
      setActiveSheetName(parsed.activeSheet);
      setSheetTitle(file.name.replace(/\.[^/.]+$/, ''));
      setSelectedCell({ r: 0, c: 0 });
      setFormulaInput(String(parsed.data[0]?.[0] || ''));
      confetti({ particleCount: 30, spread: 50 });
    } catch (err: any) {
      console.error('Import spreadsheet failed:', err);
      alert('Failed to parse spreadsheet: ' + (err.message || 'Unknown error'));
    }
  };

  // Export handlers
  const handleExportXlsx = () => {
    const blob = exportMultiSheetWorkbookToBlob(sheets, sheetOrder);
    saveAs(blob, `${sheetTitle}.xlsx`);
    confetti({ particleCount: 40, spread: 60 });
  };

  const handleExportCsv = () => {
    const blob = exportDataToCsvBlob(gridData);
    saveAs(blob, `${sheetTitle}_${activeSheetName}.csv`);
    confetti({ particleCount: 40, spread: 60 });
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const pdfBytes = await convertSpreadsheetToPdf(gridData, `${sheetTitle} - ${activeSheetName}`);
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      saveAs(blob, `${sheetTitle}_report.pdf`);
      confetti({ particleCount: 50, spread: 60 });
    } catch (err) {
      console.error('Export sheet to PDF failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Format cell output value for display
  const formatCellValue = (val: string | number, fmt?: string) => {
    if (val === '' || val === null || val === undefined) return '';
    const num = typeof val === 'number' ? val : parseFloat(String(val));
    if (isNaN(num)) return String(val);

    switch (fmt) {
      case 'currency':
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
      case 'percent':
        return (num > 1 ? num / 100 : num).toLocaleString('en-US', { style: 'percent', minimumFractionDigits: 1 });
      case 'number':
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      default:
        return String(val);
    }
  };

  // Chart data extraction
  const getChartData = () => {
    const headers: string[] = [];
    const series: { label: string; values: number[] }[] = [];

    if (gridData.length > 1) {
      const headerRow = gridData[0];
      const categories: string[] = [];

      for (let r = 1; r < Math.min(gridData.length, 12); r++) {
        const cat = String(gridData[r][0] || `Row ${r}`);
        categories.push(cat);
      }

      // Collect numeric columns
      for (let c = 1; c < Math.min(headerRow.length, 6); c++) {
        const colTitle = String(headerRow[c] || `Col ${c}`);
        const values: number[] = [];
        for (let r = 1; r < Math.min(gridData.length, 12); r++) {
          let val = gridData[r][c];
          if (typeof val === 'string' && val.startsWith('=')) {
            val = evaluateCellFormula(val, gridData);
          }
          const num = typeof val === 'number' ? val : parseFloat(String(val));
          values.push(!isNaN(num) ? num : 0);
        }
        if (values.some((v) => v !== 0)) {
          series.push({ label: colTitle, values });
        }
      }

      return { categories, series };
    }
    return { categories: ['Q1', 'Q2', 'Q3', 'Q4'], series: [{ label: 'Sales', values: [10, 25, 45, 80] }] };
  };

  const activeCoord = `${indexToColumnLetter(selectedCell.c)}${selectedCell.r + 1}`;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      {/* Top Header */}
      <div className="h-14 border-b border-slate-800 bg-slate-900/90 px-4 flex items-center justify-between shrink-0 gap-3 overflow-x-auto">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={sheetTitle}
            onChange={(e) => setSheetTitle(e.target.value)}
            className="bg-transparent text-sm font-bold text-white border-b border-transparent hover:border-slate-700 focus:border-emerald-500 px-1 py-0.5 outline-none w-48 md:w-60"
            placeholder="Spreadsheet Title"
          />
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
            MULTI-SHEET XLSX
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Import Workbook</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
          </label>

          {onSaveToProjects && (
            <button
              onClick={() => onSaveToProjects(sheetTitle, { sheets, sheetOrder, cellStyles })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-indigo-400" />
              <span>Save</span>
            </button>
          )}

          <button
            onClick={() => setShowChartModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
            title="Create Interactive Chart"
          >
            <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Chart</span>
          </button>

          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
          >
            <DownloadCloud className="w-3.5 h-3.5 text-red-400" />
            <span>PDF Report</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
          >
            <DownloadCloud className="w-3.5 h-3.5 text-emerald-400" />
            <span>CSV</span>
          </button>

          <button
            onClick={handleExportXlsx}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 cursor-pointer"
          >
            <DownloadCloud className="w-3.5 h-3.5" />
            <span>Export .XLSX</span>
          </button>
        </div>
      </div>

      {/* Formatting & Controls Ribbon */}
      <div className="border-b border-slate-800 bg-slate-900/70 px-4 py-1.5 flex items-center justify-between gap-3 overflow-x-auto text-xs text-slate-300">
        <div className="flex items-center gap-1 shrink-0">
          {/* Undo / Redo */}
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className="p-1.5 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-400 hover:text-white"
            title="Undo"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1.5 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-400 hover:text-white"
            title="Redo"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Text Formatting */}
          <button
            onClick={() => toggleCellStyle('bold', true)}
            className={`p-1.5 rounded font-bold ${activeStyle.bold ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-slate-800 text-slate-400'}`}
            title="Bold"
          >
            <BoldIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => toggleCellStyle('italic', true)}
            className={`p-1.5 rounded italic ${activeStyle.italic ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-slate-800 text-slate-400'}`}
            title="Italic"
          >
            <ItalicIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => toggleCellStyle('underline', true)}
            className={`p-1.5 rounded underline ${activeStyle.underline ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-slate-800 text-slate-400'}`}
            title="Underline"
          >
            <UnderlineIcon className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Alignments */}
          <button
            onClick={() => toggleCellStyle('align', 'left')}
            className={`p-1.5 rounded ${activeStyle.align === 'left' ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-slate-800 text-slate-400'}`}
            title="Align Left"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => toggleCellStyle('align', 'center')}
            className={`p-1.5 rounded ${activeStyle.align === 'center' ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-slate-800 text-slate-400'}`}
            title="Align Center"
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => toggleCellStyle('align', 'right')}
            className={`p-1.5 rounded ${activeStyle.align === 'right' ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-slate-800 text-slate-400'}`}
            title="Align Right"
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Number Formats */}
          <select
            value={activeStyle.format || 'general'}
            onChange={(e) => setCellFormatType(e.target.value as any)}
            className="bg-slate-800 text-slate-300 text-xs rounded px-2 py-1 outline-none border border-slate-700 cursor-pointer"
          >
            <option value="general">General</option>
            <option value="currency">Currency ($)</option>
            <option value="percent">Percent (%)</option>
            <option value="number">Number (1,234.00)</option>
          </select>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Sort Column */}
          <button
            onClick={() => handleSortColumn(true)}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            title="Sort Column Ascending"
          >
            <ArrowUpDown className="w-3 h-3 text-emerald-400" />
            <span>Sort A-Z</span>
          </button>
          <button
            onClick={() => handleSortColumn(false)}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            title="Sort Column Descending"
          >
            <ArrowUpDown className="w-3 h-3 text-amber-400" />
            <span>Sort Z-A</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Search Toggle */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`flex items-center gap-1 px-2 py-1 rounded ${showSearch ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-slate-800 text-slate-400'}`}
            title="Find & Replace"
          >
            <Search className="w-3 h-3" />
            <span>Find & Replace</span>
          </button>
        </div>

        {/* Row & Col Controls */}
        <div className="flex items-center gap-1 text-slate-400 text-xs shrink-0">
          <button
            onClick={addRow}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 hover:text-white cursor-pointer"
            title="Add row"
          >
            <Plus className="w-3 h-3" />
            <span>Row</span>
          </button>
          <button
            onClick={removeRow}
            disabled={gridData.length <= 1}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 hover:text-white disabled:opacity-30 cursor-pointer"
            title="Remove row"
          >
            <Minus className="w-3 h-3" />
            <span>Row</span>
          </button>
          <button
            onClick={addColumn}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 hover:text-white cursor-pointer"
            title="Add column"
          >
            <Plus className="w-3 h-3" />
            <span>Col</span>
          </button>
        </div>
      </div>

      {/* Find & Replace Bar (Collapsible) */}
      {showSearch && (
        <div className="border-b border-slate-800 bg-slate-900/80 px-4 py-2 flex items-center gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Find:</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search text..."
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white outline-none w-36"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Replace:</span>
            <input
              type="text"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              placeholder="Replace with..."
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white outline-none w-36"
            />
          </div>
          <button
            onClick={() => handleSearchAndReplace(false)}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
          >
            Replace Next
          </button>
          <button
            onClick={() => handleSearchAndReplace(true)}
            className="px-2.5 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 font-semibold border border-emerald-500/30"
          >
            Replace All
          </button>
          <button
            onClick={() => setShowSearch(false)}
            className="p-1 text-slate-500 hover:text-slate-300 ml-auto"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Formula Bar */}
      <div className="h-10 border-b border-slate-800 bg-slate-900/60 px-4 flex items-center gap-3 shrink-0">
        <div className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono text-xs font-bold w-14 text-center">
          {activeCoord}
        </div>

        <div className="flex-1 flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 gap-2">
          <Calculator className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <input
            type="text"
            value={formulaInput}
            onChange={(e) => {
              setFormulaInput(e.target.value);
              handleFormulaCommit(e.target.value);
            }}
            placeholder="Enter value or formula e.g. =SUM(B2:E2), =AVERAGE(B2:B5), =IF(B2>50, 'High', 'Low'), =VLOOKUP(...)"
            className="w-full bg-transparent text-xs text-white outline-none font-mono"
          />
        </div>
      </div>

      {/* Spreadsheet Grid View */}
      <div className="flex-1 overflow-auto bg-slate-950 p-2">
        <div className="inline-block min-w-full align-middle">
          <table className="border-collapse table-fixed select-none text-xs">
            <thead>
              <tr>
                {/* Top-left corner */}
                <th className="w-12 h-7 bg-slate-900 border border-slate-800 text-slate-500 font-mono text-[10px] text-center" />
                {Array.from({ length: colCount }, (_, cIdx) => (
                  <th
                    key={cIdx}
                    className="w-32 h-7 bg-slate-900 border border-slate-800 text-slate-400 font-mono text-[11px] font-semibold text-center"
                  >
                    {indexToColumnLetter(cIdx)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.max(rowCount, 20) }, (_, rIdx) => (
                <tr key={rIdx}>
                  {/* Row number */}
                  <td className="w-12 h-7 bg-slate-900/80 border border-slate-800 text-slate-500 font-mono text-[10px] text-center font-bold">
                    {rIdx + 1}
                  </td>

                  {/* Row Cells */}
                  {Array.from({ length: colCount }, (_, cIdx) => {
                    const rawVal = gridData[rIdx]?.[cIdx];
                    const isSelected = selectedCell.r === rIdx && selectedCell.c === cIdx;
                    const isHeader = rIdx === 0;

                    // Evaluate formula if rawVal starts with '='
                    let displayVal = rawVal !== undefined ? rawVal : '';
                    if (typeof rawVal === 'string' && rawVal.startsWith('=')) {
                      displayVal = evaluateCellFormula(rawVal, gridData);
                    }

                    const cellKey = `${rIdx}_${cIdx}`;
                    const style = currentStyles[cellKey] || {};
                    const formatted = formatCellValue(displayVal, style.format);

                    return (
                      <td
                        key={cIdx}
                        onClick={() => handleSelectCell(rIdx, cIdx)}
                        style={{
                          fontWeight: style.bold || isHeader ? 'bold' : 'normal',
                          fontStyle: style.italic ? 'italic' : 'normal',
                          textDecoration: style.underline ? 'underline' : 'none',
                          textAlign: style.align || (isHeader ? 'center' : typeof displayVal === 'number' ? 'right' : 'left'),
                          color: style.color || undefined,
                          backgroundColor: style.bgColor || undefined,
                        }}
                        className={`h-7 px-2 border border-slate-800/90 truncate transition-colors cursor-cell ${
                          isSelected
                            ? 'bg-emerald-950/40 outline-2 outline-emerald-500 z-10'
                            : isHeader
                            ? 'bg-slate-900 text-slate-200'
                            : 'bg-slate-950/70 hover:bg-slate-800/40 text-slate-300'
                        }`}
                      >
                        {isSelected ? (
                          <input
                            type="text"
                            value={formulaInput}
                            onChange={(e) => {
                              setFormulaInput(e.target.value);
                              handleCellChange(rIdx, cIdx, e.target.value);
                            }}
                            className="w-full bg-transparent outline-none text-white font-mono text-xs"
                            autoFocus
                          />
                        ) : (
                          <span
                            className={`font-mono text-xs ${
                              typeof displayVal === 'number' && displayVal < 0 ? 'text-red-400' : ''
                            }`}
                          >
                            {formatted !== '' ? String(formatted) : ''}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Worksheet Tab Bar */}
      <div className="h-10 border-t border-slate-800 bg-slate-900/90 px-3 flex items-center justify-between shrink-0 overflow-x-auto gap-2">
        <div className="flex items-center gap-1.5">
          {sheetOrder.map((name) => {
            const isActive = name === activeSheetName;
            const isEditing = renamingSheet === name;

            return (
              <div
                key={name}
                onClick={() => !isEditing && setActiveSheetName(name)}
                className={`group flex items-center gap-1.5 px-3 py-1 rounded-t-md text-xs font-semibold cursor-pointer border-t-2 transition-colors ${
                  isActive
                    ? 'bg-slate-950 text-emerald-400 border-emerald-500 shadow-sm'
                    : 'bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-transparent'
                }`}
              >
                {isEditing ? (
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={handleCommitRename}
                    onKeyDown={(e) => e.key === 'Enter' && handleCommitRename()}
                    autoFocus
                    className="bg-slate-900 text-white px-1 py-0.5 rounded outline-none border border-emerald-500 w-24 text-xs"
                  />
                ) : (
                  <span onDoubleClick={() => handleStartRename(name)}>{name}</span>
                )}

                {/* Tab actions */}
                <div className="hidden group-hover:flex items-center gap-1 ml-1 opacity-70 hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartRename(name);
                    }}
                    title="Rename Sheet"
                    className="p-0.5 hover:text-white"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateSheet(name);
                    }}
                    title="Duplicate Sheet"
                    className="p-0.5 hover:text-white"
                  >
                    <Copy className="w-2.5 h-2.5" />
                  </button>
                  {sheetOrder.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSheet(name);
                      }}
                      title="Delete Sheet"
                      className="p-0.5 hover:text-red-400"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add Sheet Button */}
          <button
            onClick={handleAddSheet}
            className="flex items-center justify-center w-7 h-7 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
            title="Add New Worksheet"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="text-[11px] text-slate-500 font-mono hidden sm:block">
          Active: {activeSheetName} · {gridData.length} Rows · {colCount} Cols
        </div>
      </div>

      {/* Interactive Chart Modal */}
      {showChartModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Data Visualization & Chart Generator</h3>
              </div>
              <button
                onClick={() => setShowChartModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chart Type Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Chart Type:</span>
              <button
                onClick={() => setChartType('bar')}
                className={`px-3 py-1 rounded text-xs font-semibold ${chartType === 'bar' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'}`}
              >
                Bar Chart
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`px-3 py-1 rounded text-xs font-semibold ${chartType === 'line' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'}`}
              >
                Line Chart
              </button>
              <button
                onClick={() => setChartType('pie')}
                className={`px-3 py-1 rounded text-xs font-semibold ${chartType === 'pie' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'}`}
              >
                Pie Chart
              </button>
              <button
                onClick={() => setChartType('area')}
                className={`px-3 py-1 rounded text-xs font-semibold ${chartType === 'area' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'}`}
              >
                Area Chart
              </button>
            </div>

            {/* Render SVG Chart */}
            <div className="h-64 bg-slate-950 rounded-lg p-4 flex items-center justify-center border border-slate-800">
              {(() => {
                const { categories, series } = getChartData();
                const colors = ['#06b6d4', '#10b981', '#6366f1', '#f59e0b', '#ec4899'];
                const firstSeries = series[0] || { label: 'Values', values: categories.map(() => 10) };
                const maxVal = Math.max(...firstSeries.values.map(Math.abs), 1);

                if (chartType === 'bar') {
                  const barWidth = 28;
                  const gap = 16;
                  const totalWidth = categories.length * (barWidth + gap);

                  return (
                    <svg viewBox={`0 0 ${Math.max(totalWidth + 40, 320)} 200`} className="w-full h-full">
                      {categories.map((cat, idx) => {
                        const val = firstSeries.values[idx] || 0;
                        const barHeight = Math.max(8, (Math.abs(val) / maxVal) * 140);
                        const x = 30 + idx * (barWidth + gap);
                        const y = 160 - barHeight;

                        return (
                          <g key={idx}>
                            <rect
                              x={x}
                              y={y}
                              width={barWidth}
                              height={barHeight}
                              rx={4}
                              fill={colors[idx % colors.length]}
                              className="transition-all hover:opacity-80"
                            />
                            <text x={x + barWidth / 2} y={180} fill="#94a3b8" fontSize="10" textAnchor="middle">
                              {cat.length > 7 ? cat.slice(0, 6) + '…' : cat}
                            </text>
                            <text x={x + barWidth / 2} y={y - 4} fill="#e2e8f0" fontSize="9" textAnchor="middle">
                              {val}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  );
                } else if (chartType === 'line' || chartType === 'area') {
                  const points = categories.map((_, idx) => {
                    const val = firstSeries.values[idx] || 0;
                    const x = 40 + (idx * 240) / Math.max(1, categories.length - 1);
                    const y = 160 - (Math.abs(val) / maxVal) * 130;
                    return `${x},${y}`;
                  }).join(' ');

                  const areaPoints = `40,160 ${points} ${40 + 240},160`;

                  return (
                    <svg viewBox="0 0 320 200" className="w-full h-full">
                      {chartType === 'area' && (
                        <polygon points={areaPoints} fill="rgba(6, 182, 212, 0.25)" />
                      )}
                      <polyline points={points} fill="none" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      {categories.map((cat, idx) => {
                        const val = firstSeries.values[idx] || 0;
                        const x = 40 + (idx * 240) / Math.max(1, categories.length - 1);
                        const y = 160 - (Math.abs(val) / maxVal) * 130;
                        return (
                          <g key={idx}>
                            <circle cx={x} cy={y} r="4" fill="#06b6d4" stroke="#ffffff" strokeWidth="1.5" />
                            <text x={x} y={180} fill="#94a3b8" fontSize="10" textAnchor="middle">
                              {cat.slice(0, 5)}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  );
                } else {
                  // Pie Chart
                  let cumulativeAngle = 0;
                  const total = firstSeries.values.reduce((a, b) => a + Math.max(0, b), 0) || 1;
                  const cx = 160;
                  const cy = 100;
                  const r = 70;

                  return (
                    <svg viewBox="0 0 320 200" className="w-full h-full">
                      {firstSeries.values.map((v, idx) => {
                        const angle = (Math.max(0, v) / total) * 360;
                        const startAngle = cumulativeAngle;
                        const endAngle = cumulativeAngle + angle;
                        cumulativeAngle += angle;

                        const startRad = (startAngle - 90) * (Math.PI / 180);
                        const endRad = (endAngle - 90) * (Math.PI / 180);

                        const x1 = cx + r * Math.cos(startRad);
                        const y1 = cy + r * Math.sin(startRad);
                        const x2 = cx + r * Math.cos(endRad);
                        const y2 = cy + r * Math.sin(endRad);

                        const largeArc = angle > 180 ? 1 : 0;
                        const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

                        return (
                          <path
                            key={idx}
                            d={d}
                            fill={colors[idx % colors.length]}
                            className="hover:opacity-80 transition-opacity"
                          />
                        );
                      })}
                    </svg>
                  );
                }
              })()}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowChartModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
