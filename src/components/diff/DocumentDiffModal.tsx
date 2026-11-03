import React, { useState } from 'react';
import { 
  X, 
  GitCompare, 
  Download, 
  FileText, 
  ArrowRight,
  Plus,
  Minus,
  CheckCircle2
} from 'lucide-react';
import { computeTextDiff, generateChangeReport } from '../../services/diffService';
import { DiffResult } from '../../types';
import saveAs from 'file-saver';
import { useToast } from '../../services/toastService';

interface DocumentDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultOldText?: string;
  defaultNewText?: string;
  defaultOldTitle?: string;
  defaultNewTitle?: string;
}

export const DocumentDiffModal: React.FC<DocumentDiffModalProps> = ({
  isOpen,
  onClose,
  defaultOldText = '',
  defaultNewText = '',
  defaultOldTitle = 'Original Version',
  defaultNewTitle = 'Revised Version',
}) => {
  const { addToast } = useToast();
  const [oldTitle, setOldTitle] = useState(defaultOldTitle);
  const [newTitle, setNewTitle] = useState(defaultNewTitle);
  const [oldContent, setOldContent] = useState(defaultOldText);
  const [newContent, setNewContent] = useState(defaultNewText);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(() => {
    if (defaultOldText || defaultNewText) {
      return computeTextDiff(defaultOldText, defaultNewText, defaultOldTitle, defaultNewTitle);
    }
    return null;
  });

  if (!isOpen) return null;

  const handleRunDiff = () => {
    if (!oldContent.trim() && !newContent.trim()) {
      addToast('warning', 'Empty Comparison', 'Please provide content in both document versions.');
      return;
    }
    const result = computeTextDiff(oldContent, newContent, oldTitle, newTitle);
    setDiffResult(result);
    addToast('success', 'Comparison Generated', `${result.stats.additions} added, ${result.stats.deletions} removed.`);
  };

  const handleExportReport = () => {
    if (!diffResult) return;
    const report = generateChangeReport(diffResult);
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    saveAs(blob, `change_report_${Date.now()}.md`);
    addToast('info', 'Report Downloaded', 'Markdown change report saved.');
  };

  const handleLoadSample = () => {
    const s1 = `Project Scope & Specifications (v1.0)\n1. Target delivery: Q3 2026\n2. Storage mechanism: Local only\n3. Initial budget allocation: $40,000\n4. Authentication: Basic prototype tokens\n5. Document parsing: Experimental`;
    const s2 = `Project Scope & Specifications (v2.0)\n1. Target delivery: Q4 2026 (Extended)\n2. Storage mechanism: Dual Cloud & Local Privacy Mode\n3. Initial budget allocation: $65,000\n4. Authentication: Cryptographic session signatures\n5. Document parsing: Full structural OpenXML & PDF pipeline\n6. Added AI Assistant with verifiable citations`;
    setOldTitle('Contract Specs v1.0');
    setNewTitle('Contract Specs v2.0');
    setOldContent(s1);
    setNewContent(s2);
    setDiffResult(computeTextDiff(s1, s2, 'Contract Specs v1.0', 'Contract Specs v2.0'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="h-16 px-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                Document Diff &amp; Revision Analyzer
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                  v2.0 Intelligence
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Compare revisions of DOCX, PDF, or text documents and generate change reports
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadSample}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 cursor-pointer"
            >
              Load Sample
            </button>
            {diffResult && (
              <button
                onClick={handleExportReport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Report</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left Panel: Inputs */}
          <div className="w-full md:w-1/2 p-4 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col gap-4 overflow-y-auto">
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={oldTitle}
                  onChange={(e) => setOldTitle(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 font-semibold w-48"
                  placeholder="Original Document"
                />
                <span className="text-[11px] text-red-400 font-mono font-semibold flex items-center gap-1">
                  <Minus className="w-3 h-3" /> Baseline
                </span>
              </div>
              <textarea
                value={oldContent}
                onChange={(e) => setOldContent(e.target.value)}
                placeholder="Paste original document text or type here..."
                className="flex-1 min-h-[140px] bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 font-mono resize-none focus:outline-none focus:border-red-500/50"
              />
            </div>

            <div className="flex-1 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 font-semibold w-48"
                  placeholder="Revised Document"
                />
                <span className="text-[11px] text-emerald-400 font-mono font-semibold flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Revised
                </span>
              </div>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Paste revised document text or type here..."
                className="flex-1 min-h-[140px] bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 font-mono resize-none focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <button
              onClick={handleRunDiff}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20"
            >
              <GitCompare className="w-4 h-4" />
              <span>Compute Document Comparison</span>
            </button>
          </div>

          {/* Right Panel: Diff Results */}
          <div className="w-full md:w-1/2 p-4 flex flex-col overflow-hidden bg-slate-950/60">
            {diffResult ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Statistics Bar */}
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800 mb-3 shrink-0">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                    <Plus className="w-3.5 h-3.5" />
                    <span>+{diffResult.stats.additions} Added</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20">
                    <Minus className="w-3.5 h-3.5" />
                    <span>-{diffResult.stats.deletions} Removed</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{diffResult.stats.unchanged} Unchanged</span>
                  </div>
                </div>

                {/* Diff Stream View */}
                <div className="flex-1 overflow-y-auto rounded-2xl bg-slate-950 border border-slate-800/80 p-3 font-mono text-xs space-y-1">
                  {diffResult.tokens.map((token, idx) => {
                    if (token.type === 'add') {
                      return (
                        <div key={idx} className="bg-emerald-950/40 text-emerald-300 px-2 py-1 rounded border-l-2 border-emerald-500 flex items-start gap-2">
                          <span className="select-none font-bold text-emerald-400 shrink-0">+</span>
                          <span className="break-all">{token.text}</span>
                        </div>
                      );
                    }
                    if (token.type === 'del') {
                      return (
                        <div key={idx} className="bg-red-950/40 text-red-300 px-2 py-1 rounded border-l-2 border-red-500 flex items-start gap-2 line-through opacity-80">
                          <span className="select-none font-bold text-red-400 shrink-0">-</span>
                          <span className="break-all">{token.text}</span>
                        </div>
                      );
                    }
                    return (
                      <div key={idx} className="text-slate-400 px-2 py-0.5 flex items-start gap-2">
                        <span className="select-none text-slate-600 shrink-0">&nbsp;</span>
                        <span className="break-all">{token.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <FileText className="w-12 h-12 stroke-1 mb-3 text-slate-600" />
                <h3 className="text-sm font-bold text-slate-400 mb-1">No Comparison Computed</h3>
                <p className="text-xs max-w-xs">
                  Paste content on the left or click &quot;Load Sample&quot; to inspect visual changes, additions, and deletions.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
