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
  X,
  User,
  Table as TableIcon,
  Sliders,
  ChevronDown
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

const createEmptyGrid = (rows = 30, cols = 15): (string | number)[][] =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));

export const SAMPLE_WORKBOOK_DATA: (string | number)[][] = [
  ['Category', 'Q1 Target', 'Q1 Actual', 'Variance', 'Status'],
  ['Operations', 12500, 11800, '=C2-B2', 'On Track'],
  ['Development', 35000, 36200, '=C3-B3', 'Exceeded'],
  ['Support', 8400, 8100, '=C4-B4', 'On Track'],
  ['Marketing', 15000, 14200, '=C5-B5', 'Under'],
];

export const SheetStudio: React.FC<SheetStudioProps> = ({
  initialTitle,
  initialData,
  onSaveToProjects,
}) => {
  const [sheetTitle, setSheetTitle] = useState(initialTitle || 'Excel Sheets');

  // Multi-sheet State: clean blank workbook defaults to 1 sheet with empty grid
  const [sheetOrder, setSheetOrder] = useState<string[]>(['Sheet1']);
  const [activeSheetName, setActiveSheetName] = useState<string>('Sheet1');
  const [sheets, setSheets] = useState<Record<string, (string | number)[][]>>(() => {
    if (initialData && initialData.length > 0) {
      return { Sheet1: initialData };
    }
    return { Sheet1: createEmptyGrid(30, 15) };
  });

  // Cell Formatting Dictionary: sheetName -> 'r_c' -> CellStyle
  const [cellStyles, setCellStyles] = useState<Record<string, Record<string, CellStyle>>>({});

  // Active cell & formula input
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [formulaInput, setFormulaInput] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

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
  const rowCount = Math.max(gridData.length, 1000);
  const colCount = Math.max(26, ...gridData.map((r) => r.length));

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

  const handleLoadSampleTemplate = () => {
    setHistory((prev) => [...prev, gridData]);
    setSheets({
      Sheet1: SAMPLE_WORKBOOK_DATA,
    });
    setSheetOrder(['Sheet1']);
    setActiveSheetName('Sheet1');
    setSheetTitle('Financial Projections (Sample)');
    setSelectedCell({ r: 1, c: 1 });
    setFormulaInput(String(SAMPLE_WORKBOOK_DATA[1]?.[1] || ''));
    confetti({ particleCount: 30, spread: 50 });
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#070B13]/60 text-[#F5FAFF]">
      {/* Top Header matching reference */}
      <div className="h-14 border-b border-white/10 bg-[#0B1420]/85 backdrop-blur-2xl px-5 flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#38BDF8] to-[#38BDF8] flex items-center justify-center p-0.5 shadow-md shadow-[#38BDF8]/20">
            <div className="w-full h-full bg-[#070B13] rounded-[10px] flex items-center justify-center">
              <TableIcon className="w-4 h-4 text-[#38BDF8]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#F5FAFF] tracking-tight">Excel Sheets</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                MULTI-SHEET XLSX
              </span>
            </div>
            <p className="text-[11px] text-[#A7B8CA]">View, edit and analyze your spreadsheets</p>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleLoadSampleTemplate}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl glass-card hover:border-[#38BDF8]/50 text-xs text-[#A7B8CA] hover:text-[#38BDF8] cursor-pointer transition-all"
            title="Load sample financial workbook"
          >
            <TableIcon className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span className="hidden sm:inline">Sample</span>
          </button>

          <label className="p-2 rounded-xl glass-card hover:border-emerald-400/50 text-[#A7B8CA] hover:text-[#F5FAFF] cursor-pointer transition-all" title="Import Workbook">
            <Upload className="w-4 h-4 text-emerald-400" />
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
          </label>

          <button
            onClick={() => setShowChartModal(true)}
            className="p-2 rounded-xl glass-card hover:border-[#38BDF8]/50 text-[#A7B8CA] hover:text-[#38BDF8] cursor-pointer transition-all"
            title="Create Interactive Chart"
          >
            <BarChart2 className="w-4 h-4 text-[#38BDF8]" />
          </button>

          {onSaveToProjects && (
            <button
              onClick={() => onSaveToProjects(sheetTitle, { sheets, sheetOrder, cellStyles })}
              className="p-2 rounded-xl glass-card hover:border-[#38BDF8]/50 text-[#A7B8CA] hover:text-[#38BDF8] cursor-pointer transition-all"
              title="Save to Projects"
            >
              <Save className="w-4 h-4" />
            </button>
          )}

          {/* Export Gradient Pill Button */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#38BDF8] to-[#FF3366] hover:brightness-110 text-white text-xs font-semibold shadow-lg shadow-[#38BDF8]/30 cursor-pointer transition-all"
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              <span>Export</span>
              <ChevronDown className="w-3 h-3 ml-0.5 opacity-80" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-44 rounded-2xl glass-panel border border-white/15 p-1.5 shadow-2xl z-50 flex flex-col gap-1 text-xs">
                <button
                  onClick={() => {
                    setShowExportMenu(false);
                    handleExportXlsx();
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10 text-left text-[#F5FAFF] transition-colors"
                >
                  <DownloadCloud className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Excel (.XLSX)</span>
                </button>
                <button
                  onClick={() => {
                    setShowExportMenu(false);
                    handleExportCsv();
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10 text-left text-[#F5FAFF] transition-colors"
                >
                  <DownloadCloud className="w-3.5 h-3.5 text-cyan-400" />
                  <span>CSV File (.CSV)</span>
                </button>
                <button
                  onClick={() => {
                    setShowExportMenu(false);
                    handleExportPdf();
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10 text-left text-[#F5FAFF] transition-colors"
                >
                  <DownloadCloud className="w-3.5 h-3.5 text-rose-400" />
                  <span>PDF Document (.PDF)</span>
                </button>
              </div>
            )}
          </div>

          {/* User Profile Avatar */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FF3366] to-[#38BDF8] p-0.5 ml-1">
            <div className="w-full h-full rounded-full bg-[#080E1C] flex items-center justify-center text-xs font-bold text-white">
              <User className="w-4 h-4 text-[#38BDF8]" />
            </div>
          </div>
        </div>
      </div>

      {/* Formatting & Controls Ribbon */}
      <div className="border-b border-white/10 bg-[#0B1420]/60 backdrop-blur-xl px-4 py-1.5 flex items-center justify-between gap-3 overflow-x-auto text-xs text-[#A7B8CA]">
        <div className="flex items-center gap-1 shrink-0">
          {/* Undo / Redo */}
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] disabled:opacity-30 text-[#A7B8CA] hover:text-[#F5FAFF] transition-colors"
            title="Undo"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] disabled:opacity-30 text-[#A7B8CA] hover:text-[#F5FAFF] transition-colors"
            title="Redo"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Text Formatting */}
          <button
            onClick={() => toggleCellStyle('bold', true)}
            className={`p-1.5 rounded-lg font-bold transition-all ${activeStyle.bold ? 'bg-[#38BDF8]/25 text-[#F5FAFF] border border-[#38BDF8]/40' : 'hover:bg-white/[0.06] text-[#A7B8CA]'}`}
            title="Bold"
          >
            <BoldIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => toggleCellStyle('italic', true)}
            className={`p-1.5 rounded-lg italic transition-all ${activeStyle.italic ? 'bg-[#38BDF8]/25 text-[#F5FAFF] border border-[#38BDF8]/40' : 'hover:bg-white/[0.06] text-[#A7B8CA]'}`}
            title="Italic"
          >
            <ItalicIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => toggleCellStyle('underline', true)}
            className={`p-1.5 rounded-lg underline transition-all ${activeStyle.underline ? 'bg-[#38BDF8]/25 text-[#F5FAFF] border border-[#38BDF8]/40' : 'hover:bg-white/[0.06] text-[#A7B8CA]'}`}
            title="Underline"
          >
            <UnderlineIcon className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Alignments */}
          <button
            onClick={() => toggleCellStyle('align', 'left')}
            className={`p-1.5 rounded-lg transition-all ${activeStyle.align === 'left' ? 'bg-[#38BDF8]/25 text-[#38BDF8] border border-[#38BDF8]/40' : 'hover:bg-white/[0.06] text-[#A7B8CA]'}`}
            title="Align Left"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => toggleCellStyle('align', 'center')}
            className={`p-1.5 rounded-lg transition-all ${activeStyle.align === 'center' ? 'bg-[#38BDF8]/25 text-[#38BDF8] border border-[#38BDF8]/40' : 'hover:bg-white/[0.06] text-[#A7B8CA]'}`}
            title="Align Center"
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => toggleCellStyle('align', 'right')}
            className={`p-1.5 rounded-lg transition-all ${activeStyle.align === 'right' ? 'bg-[#38BDF8]/25 text-[#38BDF8] border border-[#38BDF8]/40' : 'hover:bg-white/[0.06] text-[#A7B8CA]'}`}
            title="Align Right"
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Number Formats */}
          <select
            value={activeStyle.format || 'general'}
            onChange={(e) => setCellFormatType(e.target.value as any)}
            className="glass-input text-xs rounded-xl px-2.5 py-1 outline-none text-[#F5FAFF] cursor-pointer"
          >
            <option value="general" className="bg-[#0B1420] text-white">General</option>
            <option value="currency" className="bg-[#0B1420] text-white">Currency ($)</option>
            <option value="percent" className="bg-[#0B1420] text-white">Percent (%)</option>
            <option value="number" className="bg-[#0B1420] text-white">Number (1,234.00)</option>
          </select>

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Sort Column */}
          <button
            onClick={() => handleSortColumn(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl hover:bg-white/[0.06] text-[#A7B8CA] hover:text-[#F5FAFF] transition-colors"
            title="Sort Column Ascending"
          >
            <ArrowUpDown className="w-3 h-3 text-emerald-400" />
            <span>Sort A-Z</span>
          </button>
          <button
            onClick={() => handleSortColumn(false)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl hover:bg-white/[0.06] text-[#A7B8CA] hover:text-[#F5FAFF] transition-colors"
            title="Sort Column Descending"
          >
            <ArrowUpDown className="w-3 h-3 text-amber-400" />
            <span>Sort Z-A</span>
          </button>

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Search Toggle */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl transition-all ${showSearch ? 'bg-[#38BDF8]/25 text-[#F5FAFF] border border-[#38BDF8]/40' : 'hover:bg-white/[0.06] text-[#A7B8CA]'}`}
            title="Find & Replace"
          >
            <Search className="w-3 h-3" />
            <span>Find & Replace</span>
          </button>
        </div>

        {/* Row & Col Controls */}
        <div className="flex items-center gap-1.5 text-[#A7B8CA] text-xs shrink-0">
          <button
            onClick={addRow}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl glass-card hover:border-[#38BDF8]/50 hover:text-[#F5FAFF] cursor-pointer transition-all"
            title="Add row"
          >
            <Plus className="w-3 h-3 text-[#38BDF8]" />
            <span>Row</span>
          </button>
          <button
            onClick={removeRow}
            disabled={gridData.length <= 1}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl glass-card hover:border-rose-400/50 hover:text-rose-300 disabled:opacity-30 cursor-pointer transition-all"
            title="Remove row"
          >
            <Minus className="w-3 h-3 text-rose-400" />
            <span>Row</span>
          </button>
          <button
            onClick={addColumn}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl glass-card hover:border-[#38BDF8]/50 hover:text-[#F5FAFF] cursor-pointer transition-all"
            title="Add column"
          >
            <Plus className="w-3 h-3 text-[#38BDF8]" />
            <span>Col</span>
          </button>
        </div>
      </div>

      {/* Find & Replace Bar (Collapsible) */}
      {showSearch && (
        <div className="border-b border-white/10 bg-[#0B1420]/90 backdrop-blur-xl px-4 py-2 flex items-center gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#A7B8CA] font-medium">Find:</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search text..."
              className="glass-input rounded-xl px-2.5 py-1 text-[#F5FAFF] outline-none w-36"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#A7B8CA] font-medium">Replace:</span>
            <input
              type="text"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              placeholder="Replace with..."
              className="glass-input rounded-xl px-2.5 py-1 text-[#F5FAFF] outline-none w-36"
            />
          </div>
          <button
            onClick={() => handleSearchAndReplace(false)}
            className="px-3 py-1 rounded-xl glass-card hover:bg-white/[0.08] text-[#F5FAFF] font-semibold cursor-pointer"
          >
            Replace Next
          </button>
          <button
            onClick={() => handleSearchAndReplace(true)}
            className="px-3 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold border border-emerald-500/30 cursor-pointer"
          >
            Replace All
          </button>
          <button
            onClick={() => setShowSearch(false)}
            className="p-1 text-[#A7B8CA] hover:text-[#F5FAFF] ml-auto"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2-Column Split Body: Left Spreadsheet Grid, Right Sheet Properties */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Formula Bar & Grid */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden border-r border-white/10">
          {/* Formula Bar */}
          <div className="h-10 border-b border-white/10 bg-[#0B1420]/50 backdrop-blur-xl px-4 flex items-center gap-3 shrink-0">
            <div className="px-2.5 py-1 rounded-xl glass-card border-white/10 text-[#38BDF8] font-mono text-xs font-bold w-14 text-center">
              {activeCoord}
            </div>

            <div className="flex-1 flex items-center glass-input rounded-xl px-3 py-1 gap-2">
              <Calculator className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
              <input
                type="text"
                value={formulaInput}
                onChange={(e) => {
                  setFormulaInput(e.target.value);
                  handleFormulaCommit(e.target.value);
                }}
                placeholder="Enter value or formula e.g. =SUM(B2:E2), =AVERAGE(B2:B5), =IF(B2>50, 'High', 'Low')"
                className="w-full bg-transparent text-xs text-[#F5FAFF] outline-none font-mono placeholder:text-[#A7B8CA]/50"
              />
            </div>
          </div>

          {/* Spreadsheet Grid View */}
          <div className="flex-1 overflow-auto bg-[#070B13]/50 p-2 custom-scrollbar">
            <div className="inline-block min-w-full align-middle">
              <table className="border-collapse table-fixed select-none text-xs">
                <thead>
                  <tr>
                    {/* Top-left corner */}
                    <th className="w-12 h-7 bg-[#0B1420]/90 border border-white/10 text-[#A7B8CA] font-mono text-[10px] text-center" />
                    {Array.from({ length: colCount }, (_, cIdx) => (
                      <th
                        key={cIdx}
                        className="w-32 h-7 bg-[#0B1420]/90 border border-white/10 text-[#A7B8CA] font-mono text-[11px] font-semibold text-center"
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
                      <td className="w-12 h-7 bg-[#0B1420]/70 border border-white/10 text-[#A7B8CA] font-mono text-[10px] text-center font-bold">
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
                        const cellStr = String(displayVal).trim();

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
                            className={`h-7 px-2 border border-white/10 truncate transition-colors cursor-cell ${
                              isSelected
                                ? 'bg-[#38BDF8]/25 outline-2 outline-[#38BDF8] z-10 text-[#F5FAFF]'
                                : isHeader
                                ? 'bg-white/[0.06] text-[#F5FAFF] font-semibold'
                                : 'bg-transparent hover:bg-white/[0.04] text-[#F5FAFF]'
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
                                className="w-full bg-transparent outline-none text-[#F5FAFF] font-mono text-xs"
                                autoFocus
                              />
                            ) : cellStr === 'Active' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold text-[10px] border border-emerald-500/30">
                                Active
                              </span>
                            ) : cellStr === 'Pending' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold text-[10px] border border-amber-500/30">
                                Pending
                              </span>
                            ) : (
                              <span
                                className={`font-mono text-xs ${
                                  typeof displayVal === 'number' && displayVal < 0 ? 'text-rose-400' : ''
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
        </div>

        {/* Right Column: Sheet Properties Inspector Panel */}
        <div className="w-72 bg-[#0B1420]/50 backdrop-blur-2xl p-4 flex flex-col gap-4 overflow-y-auto shrink-0 select-none custom-scrollbar">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <h3 className="text-xs font-bold text-[#F5FAFF] uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Sheet Properties</span>
            </h3>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-[#A7B8CA] font-medium">Name</label>
            <input
              type="text"
              value={activeSheetName}
              onChange={(e) => {
                const newName = e.target.value;
                if (!newName) return;
                setSheets((prev) => {
                  const updated = { ...prev };
                  updated[newName] = updated[activeSheetName] || [];
                  delete updated[activeSheetName];
                  return updated;
                });
                setSheetOrder((prev) => prev.map((s) => (s === activeSheetName ? newName : s)));
                setActiveSheetName(newName);
              }}
              className="w-full glass-input rounded-xl px-3 py-1.5 text-xs text-[#F5FAFF] outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-[#A7B8CA] font-medium">Total Rows</label>
            <div className="w-full glass-card rounded-xl px-3 py-2 text-xs font-mono font-semibold text-[#F5FAFF] flex items-center justify-between">
              <span>{rowCount}</span>
              <span className="text-[10px] text-[#A7B8CA]">Virtual rows</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-[#A7B8CA] font-medium">Total Columns</label>
            <div className="w-full glass-card rounded-xl px-3 py-2 text-xs font-mono font-semibold text-[#F5FAFF] flex items-center justify-between">
              <span>{colCount}</span>
              <span className="text-[10px] text-[#A7B8CA]">A – Z</span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 space-y-2">
            <label className="text-[11px] text-[#A7B8CA] font-medium">Selected Cell Info</label>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#A7B8CA]">Coordinate:</span>
                <span className="font-mono text-[#38BDF8] font-bold">{activeCoord}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7B8CA]">Raw Value:</span>
                <span className="font-mono text-[#F5FAFF] truncate max-w-[120px]">
                  {gridData[selectedCell.r]?.[selectedCell.c] !== undefined ? String(gridData[selectedCell.r][selectedCell.c]) : 'Empty'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 space-y-2 mt-auto">
            <button
              onClick={addRow}
              className="w-full py-2 px-3 rounded-xl glass-card hover:border-[#38BDF8]/50 text-[#F5FAFF] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Add New Row</span>
            </button>
            <button
              onClick={addColumn}
              className="w-full py-2 px-3 rounded-xl glass-card hover:border-[#38BDF8]/50 text-[#F5FAFF] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Add New Column</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Worksheet Tab Bar */}
      <div className="h-10 border-t border-white/10 bg-[#0B1420]/90 backdrop-blur-xl px-3 flex items-center justify-between shrink-0 overflow-x-auto gap-2">
        <div className="flex items-center gap-1.5">
          {sheetOrder.map((name) => {
            const isActive = name === activeSheetName;
            const isEditing = renamingSheet === name;

            return (
              <div
                key={name}
                onClick={() => !isEditing && setActiveSheetName(name)}
                className={`group flex items-center gap-1.5 px-3 py-1 rounded-t-xl text-xs font-semibold cursor-pointer border-t-2 transition-all ${
                  isActive
                    ? 'bg-[#070B13]/80 text-[#38BDF8] border-[#38BDF8] shadow-md shadow-[#38BDF8]/10'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] text-[#A7B8CA] hover:text-[#F5FAFF] border-transparent'
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
                    className="glass-input text-[#F5FAFF] px-1 py-0.5 rounded outline-none border-[#38BDF8] w-24 text-xs"
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
                      className="p-0.5 hover:text-rose-400"
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
            className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-white/10 text-[#A7B8CA] hover:text-[#38BDF8] transition-colors cursor-pointer"
            title="Add New Worksheet"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="text-[11px] text-[#A7B8CA] font-mono hidden sm:block">
          Active: {activeSheetName} · {gridData.length} Rows · {colCount} Cols
        </div>
      </div>

      {/* Interactive Chart Modal */}
      {showChartModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel border-white/15 rounded-2xl max-w-2xl w-full p-5 shadow-2xl flex flex-col gap-4 text-[#F5FAFF]">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-[#38BDF8]" />
                <h3 className="text-sm font-bold text-[#F5FAFF]">Data Visualization &amp; Chart Generator</h3>
              </div>
              <button
                onClick={() => setShowChartModal(false)}
                className="p-1 text-[#A7B8CA] hover:text-[#F5FAFF] rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chart Type Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#A7B8CA] font-medium">Chart Type:</span>
              <button
                onClick={() => setChartType('bar')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${chartType === 'bar' ? 'glass-btn-primary lg-glow-ice' : 'glass-card text-[#A7B8CA]'}`}
              >
                Bar Chart
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${chartType === 'line' ? 'glass-btn-primary lg-glow-ice' : 'glass-card text-[#A7B8CA]'}`}
              >
                Line Chart
              </button>
              <button
                onClick={() => setChartType('pie')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${chartType === 'pie' ? 'glass-btn-primary lg-glow-ice' : 'glass-card text-[#A7B8CA]'}`}
              >
                Pie Chart
              </button>
              <button
                onClick={() => setChartType('area')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${chartType === 'area' ? 'glass-btn-primary lg-glow-ice' : 'glass-card text-[#A7B8CA]'}`}
              >
                Area Chart
              </button>
            </div>

            {/* Render SVG Chart */}
            <div className="h-64 bg-[#070B13]/60 rounded-xl p-4 flex items-center justify-center border border-white/10">
              {(() => {
                const { categories, series } = getChartData();
                const colors = ['#06b6d4', '#10b981', '#FF3366', '#f59e0b', '#ec4899'];
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
