import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  DownloadCloud, 
  Plus, 
  Minus, 
  Save, 
  Calculator
} from 'lucide-react';
import { 
  convertSpreadsheetToPdf, 
  evaluateCellFormula, 
  exportDataToCsvBlob, 
  exportDataToXlsxBlob, 
  indexToColumnLetter, 
  parseSpreadsheetFile 
} from '../../services/sheetService';
import saveAs from 'file-saver';
import confetti from 'canvas-confetti';

interface SheetStudioProps {
  initialTitle?: string;
  initialData?: (string | number)[][];
  onSaveToProjects?: (title: string, data: any) => void;
}

export const SheetStudio: React.FC<SheetStudioProps> = ({
  initialTitle,
  initialData,
  onSaveToProjects,
}) => {
  const [sheetTitle, setSheetTitle] = useState(initialTitle || 'Financial Analysis');
  const [gridData, setGridData] = useState<(string | number)[][]>(
    initialData || [
      ['Category', 'Q1 Target', 'Q2 Target', 'Q3 Target', 'Q4 Target', 'Annual Total'],
      ['SaaS Subscriptions', 14500, 18200, 22400, 28000, '=SUM(B2:E2)'],
      ['Enterprise Licenses', 32000, 36000, 42000, 51000, '=SUM(B3:E3)'],
      ['Professional Services', 8500, 9200, 11000, 13500, '=SUM(B4:E4)'],
      ['Cloud Infrastructure', -4200, -4800, -5600, -6800, '=SUM(B5:E5)'],
      ['Net Operating Income', '=B2+B3+B4+B5', '=C2+C3+C4+C5', '=D2+D3+D4+D5', '=E2+E3+E4+E5', '=SUM(F2:F5)'],
      ['Average Quarterly Revenue', '=AVERAGE(B2:B4)', '=AVERAGE(C2:C4)', '=AVERAGE(D2:D4)', '=AVERAGE(E2:E4)', ''],
    ]
  );

  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [formulaInput, setFormulaInput] = useState<string>('Category');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (initialTitle) setSheetTitle(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    if (initialData && Array.isArray(initialData) && initialData.length > 0) {
      setGridData(initialData);
    }
  }, [initialData]);

  const rowCount = gridData.length;
  const colCount = Math.max(8, ...gridData.map((r) => r.length));

  // Cell selection
  const handleSelectCell = (r: number, c: number) => {
    setSelectedCell({ r, c });
    const val = gridData[r]?.[c];
    setFormulaInput(val !== undefined ? String(val) : '');
  };

  const handleCellChange = (r: number, c: number, newVal: string) => {
    setGridData((prev) => {
      const copy = prev.map((row) => [...row]);
      // Ensure row exists
      while (copy.length <= r) copy.push([]);
      copy[r][c] = newVal;
      return copy;
    });
    setFormulaInput(newVal);
  };

  const handleFormulaCommit = (newVal: string) => {
    handleCellChange(selectedCell.r, selectedCell.c, newVal);
  };

  // Add / Remove rows & cols
  const addRow = () => {
    setGridData((prev) => [...prev, new Array(colCount).fill('')]);
  };

  const removeRow = () => {
    if (gridData.length <= 1) return;
    setGridData((prev) => prev.slice(0, prev.length - 1));
  };

  const addColumn = () => {
    setGridData((prev) => prev.map((row) => [...row, '']));
  };

  // Import handler
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseSpreadsheetFile(file);
      setGridData(parsed.data);
      setSheetTitle(file.name.replace(/\.[^/.]+$/, ''));
      setSelectedCell({ r: 0, c: 0 });
      setFormulaInput(String(parsed.data[0]?.[0] || ''));
    } catch (err) {
      console.error('Import spreadsheet failed:', err);
    }
  };

  // Export handlers
  const handleExportXlsx = () => {
    const blob = exportDataToXlsxBlob(gridData, sheetTitle);
    saveAs(blob, `${sheetTitle}.xlsx`);
    confetti({ particleCount: 40, spread: 60 });
  };

  const handleExportCsv = () => {
    const blob = exportDataToCsvBlob(gridData);
    saveAs(blob, `${sheetTitle}.csv`);
    confetti({ particleCount: 40, spread: 60 });
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const pdfBytes = await convertSpreadsheetToPdf(gridData, sheetTitle);
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      saveAs(blob, `${sheetTitle}_report.pdf`);
      confetti({ particleCount: 50, spread: 60 });
    } catch (err) {
      console.error('Export sheet to PDF failed:', err);
    } finally {
      setIsExporting(false);
    }
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
            className="bg-transparent text-sm font-bold text-white border-b border-transparent hover:border-slate-700 focus:border-emerald-500 px-1 py-0.5 outline-none w-52 md:w-64"
            placeholder="Spreadsheet Title"
          />
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
            XLSX / CSV
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Import XLSX/CSV</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
          </label>

          {onSaveToProjects && (
            <button
              onClick={() => onSaveToProjects(sheetTitle, { gridData })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-indigo-400" />
              <span>Save</span>
            </button>
          )}

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

      {/* Formula Bar & Grid Operations */}
      <div className="h-11 border-b border-slate-800 bg-slate-900/60 px-4 flex items-center gap-3 shrink-0">
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
            placeholder="Enter value or formula e.g. =SUM(B2:E2), =AVERAGE(B2:B5), =A1*1.1"
            className="w-full bg-transparent text-xs text-white outline-none font-mono"
          />
        </div>

        {/* Row & Col Controls */}
        <div className="flex items-center gap-1 text-slate-400 text-xs">
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

                    return (
                      <td
                        key={cIdx}
                        onClick={() => handleSelectCell(rIdx, cIdx)}
                        className={`h-7 px-2 border border-slate-800/90 truncate transition-colors cursor-cell ${
                          isSelected
                            ? 'bg-emerald-950/40 outline-2 outline-emerald-500 z-10'
                            : isHeader
                            ? 'bg-slate-900 font-bold text-slate-200'
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
                            {displayVal !== '' ? String(displayVal) : ''}
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
  );
};
