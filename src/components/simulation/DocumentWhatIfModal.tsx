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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070B13]/80 backdrop-blur-xl animate-fade-in">
      <div className="glass-panel border-white/15 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-[#F5FAFF]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#A8DEFA]/15 border border-[#A8DEFA]/30 flex items-center justify-center text-[#A8DEFA]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#F5FAFF]">Document What-If Simulator</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#A8DEFA]/20 text-[#A8DEFA] border border-[#A8DEFA]/30">
                  SIMULATION PREDICTION
                </span>
              </div>
              <p className="text-xs text-[#A7B8CA] truncate max-w-md">
                Predict layout shifts, page overflows, and visual volume changes before altering originals.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#A7B8CA] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Font Size Slider */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#F5FAFF] flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#A8DEFA]" />
                  Font Scale Delta
                </span>
                <span className="font-mono font-bold text-[#A8DEFA]">
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
                className="w-full accent-[#A8DEFA] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#A7B8CA]">
                <span>-3 pt (Compact)</span>
                <span>0 pt (Original)</span>
                <span>+3 pt (Enlarge)</span>
              </div>
            </div>

            {/* Translation Target */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#F5FAFF] flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5 text-[#A8DEFA]" />
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
                className="w-full px-3 py-1.5 text-xs bg-[#0B1420] border border-white/15 rounded-lg text-[#F5FAFF] focus:outline-none focus:border-[#A8DEFA]"
              >
                <option value="">No Translation (1.0x)</option>
                <option value="de">German (+28% expansion)</option>
                <option value="fr">French (+25% expansion)</option>
                <option value="es">Spanish (+24% expansion)</option>
                <option value="ru">Russian (+20% expansion)</option>
              </select>
              <div className="text-[10px] text-[#A7B8CA]">
                Accounts for natural lexical length expansion.
              </div>
            </div>

            {/* Remove Table Columns */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#F5FAFF] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#A8DEFA]" />
                  Remove Table Columns
                </span>
                <span className="font-mono font-bold text-[#A8DEFA]">{removeCols} col(s)</span>
              </div>
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((num) => (
                  <button
                    key={num}
                    onClick={() => {
                      setRemoveCols(num);
                      handleSimulate(fontSizeDelta, num, targetLang, targetLimit);
                    }}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      removeCols === num
                        ? 'bg-[#A8DEFA]/20 text-[#A8DEFA] border-[#A8DEFA]/40'
                        : 'bg-white/10 text-[#A7B8CA] border-white/15 hover:text-white'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Page Ceiling */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#F5FAFF] flex items-center gap-1.5">
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
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      targetLimit === num
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-white/10 text-[#A7B8CA] border-white/15 hover:text-white'
                    }`}
                  >
                    {num}p
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Outcome Prediction Box */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-[#A8DEFA]/10 border border-[#A8DEFA]/20 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#A7B8CA] uppercase tracking-wider">
                Predicted Layout Outcome
              </span>
              <span className="text-[11px] font-mono text-[#A7B8CA]">
                Simulated: {new Date(result.simulatedAt).toLocaleTimeString()}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-black/30 border border-white/10 text-center">
                <div className="text-[11px] text-[#A7B8CA]">Original Pages</div>
                <div className="text-xl font-extrabold text-[#F5FAFF]">{result.originalPageCount}</div>
              </div>
              <div className="p-3 rounded-xl bg-black/30 border border-white/10 text-center">
                <div className="text-[11px] text-[#A7B8CA]">Predicted Pages</div>
                <div className={`text-xl font-extrabold ${result.predictedOverflow ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {result.predictedPageCount}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-black/30 border border-white/10 text-center">
                <div className="text-[11px] text-[#A7B8CA]">Text Volume</div>
                <div className="text-xl font-extrabold text-[#A8DEFA]">
                  {Math.round(result.textExpansionRatio * 100)}%
                </div>
              </div>
              <div className="p-3 rounded-xl bg-black/30 border border-white/10 text-center">
                <div className="text-[11px] text-[#A7B8CA]">Overflow Status</div>
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
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300 space-y-1">
                {result.warnings.map((w, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {result.recommendations.length > 0 && (
              <div className="p-3 rounded-xl bg-[#A8DEFA]/10 border border-[#A8DEFA]/25 text-xs text-[#A8DEFA] space-y-1">
                {result.recommendations.map((r, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <Sparkles className="w-4 h-4 shrink-0 text-[#A8DEFA] mt-0.5" />
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
          <button
            onClick={resetSimulation}
            className="flex items-center gap-1.5 text-xs text-[#A7B8CA] hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Parameters
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#A7B8CA] hover:text-white transition-colors cursor-pointer"
            >
              Close Simulator
            </button>
            <button
              onClick={onClose}
              className="glass-btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-lg shadow-[#A8DEFA]/20 transition-all cursor-pointer"
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
