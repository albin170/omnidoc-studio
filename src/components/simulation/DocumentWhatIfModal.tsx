import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  FileText,
  RotateCcw,
  ArrowRight,
  Layers,
  Languages
} from 'lucide-react';
import { simulationService, SimulationResult } from '../../services/simulationService';

interface DocumentWhatIfModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle?: string;
  pageCount?: number;
}

export const DocumentWhatIfModal: React.FC<DocumentWhatIfModalProps> = ({
  isOpen,
  onClose,
  documentTitle = 'Executive_Agreement_2026.pdf',
  pageCount = 3,
}) => {
  const [fontSizeDelta, setFontSizeDelta] = useState<number>(0);
  const [removeCols, setRemoveCols] = useState<number>(0);
  const [targetLang, setTargetLang] = useState<string>('');
  const [targetLimit, setTargetLimit] = useState<number>(pageCount);

  const [result, setResult] = useState<SimulationResult>(() =>
    simulationService.simulateModifications({
      documentTitle,
      originalPageCount: pageCount,
      fontSizeDeltaPt: 0,
      removeColumnsCount: 0,
      translationTargetLang: '',
      targetPageLimit: pageCount,
    })
  );

  const handleSimulate = (delta: number, cols: number, lang: string, limit: number) => {
    const res = simulationService.simulateModifications({
      documentTitle,
      originalPageCount: pageCount,
      fontSizeDeltaPt: delta,
      removeColumnsCount: cols,
      translationTargetLang: lang,
      targetPageLimit: limit,
    });
    setResult(res);
  };

  const resetSimulation = () => {
    setFontSizeDelta(0);
    setRemoveCols(0);
    setTargetLang('');
    setTargetLimit(pageCount);
    handleSimulate(0, 0, '', pageCount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">Document What-If Simulator</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  SIMULATION PREDICTION
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-md">
                Predict layout shifts, page overflows, and visual volume changes before altering originals.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Font Size Slider */}
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-violet-400" />
                  Font Scale Delta
                </span>
                <span className="font-mono font-bold text-violet-400">
                  {fontSizeDelta > 0 ? `+${fontSizeDelta}` : fontSizeDelta} pt
                </span>
              </div>
              <input
                type="range"
                min="-3"
                max="3"
                step="0.5"
                value={fontSizeDelta}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setFontSizeDelta(val);
                  handleSimulate(val, removeCols, targetLang, targetLimit);
                }}
                className="w-full accent-violet-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>-3 pt (Compact)</span>
                <span>0 pt (Original)</span>
                <span>+3 pt (Enlarge)</span>
              </div>
            </div>

            {/* Translation Target */}
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5 text-blue-400" />
                  Target Language Expansion
                </span>
              </div>
              <select
                value={targetLang}
                onChange={(e) => {
                  const val = e.target.value;
                  setTargetLang(val);
                  handleSimulate(fontSizeDelta, removeCols, val, targetLimit);
                }}
                className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="">No Translation (1.0x)</option>
                <option value="de">German (+28% expansion)</option>
                <option value="fr">French (+25% expansion)</option>
                <option value="es">Spanish (+24% expansion)</option>
                <option value="ru">Russian (+20% expansion)</option>
              </select>
              <div className="text-[10px] text-slate-400">
                Accounts for natural lexical length expansion.
              </div>
            </div>

            {/* Remove Table Columns */}
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  Remove Table Columns
                </span>
                <span className="font-mono font-bold text-emerald-400">{removeCols} col(s)</span>
              </div>
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((num) => (
                  <button
                    key={num}
                    onClick={() => {
                      setRemoveCols(num);
                      handleSimulate(fontSizeDelta, num, targetLang, targetLimit);
                    }}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                      removeCols === num
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Page Ceiling */}
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  Target Page Ceiling
                </span>
                <span className="font-mono font-bold text-amber-400">{targetLimit} page(s)</span>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    onClick={() => {
                      setTargetLimit(num);
                      handleSimulate(fontSizeDelta, removeCols, targetLang, num);
                    }}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                      targetLimit === num
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {num}p
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Outcome Prediction Box */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950/30 border border-violet-500/20 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Predicted Layout Outcome
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Simulated: {new Date(result.simulatedAt).toLocaleTimeString()}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                <div className="text-[11px] text-slate-400">Original Pages</div>
                <div className="text-xl font-extrabold text-slate-100">{result.originalPageCount}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                <div className="text-[11px] text-slate-400">Predicted Pages</div>
                <div className={`text-xl font-extrabold ${result.predictedOverflow ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {result.predictedPageCount}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                <div className="text-[11px] text-slate-400">Text Volume</div>
                <div className="text-xl font-extrabold text-violet-400">
                  {Math.round(result.textExpansionRatio * 100)}%
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                <div className="text-[11px] text-slate-400">Overflow Status</div>
                <div className="text-xs font-bold mt-1">
                  {result.predictedOverflow ? (
                    <span className="text-amber-400 flex items-center justify-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" /> +{result.pageDelta} page(s)
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Fits Bounds
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Warnings and Recommendations */}
            {result.warnings.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
                {result.warnings.map((w, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {result.recommendations.length > 0 && (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 space-y-1">
                {result.recommendations.map((r, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <Sparkles className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <button
            onClick={resetSimulation}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Parameters
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              Close Simulator
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-600/20 transition-all"
            >
              <span>Apply Parameters</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
