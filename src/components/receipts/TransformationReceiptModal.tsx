import React, { useState, useEffect } from 'react';
import { TransformationReceipt } from '../../types';
import { getStoredReceipts, formatReceiptMarkdown } from '../../services/receiptService';
import {
  Sparkles,
  Download,
  X,
  FileCheck,
  ShieldCheck,
  Clock,
  Cpu,
  Layers,
  ArrowRight,
  Hash
} from 'lucide-react';
import { saveAs } from 'file-saver';

interface TransformationReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeReceipt?: TransformationReceipt | null;
}

export const TransformationReceiptModal: React.FC<TransformationReceiptModalProps> = ({
  isOpen,
  onClose,
  activeReceipt,
}) => {
  const [receipts, setReceipts] = useState<TransformationReceipt[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<TransformationReceipt | null>(
    activeReceipt || null
  );

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredReceipts();
      setReceipts(stored);
      if (activeReceipt) {
        setSelectedReceipt(activeReceipt);
      } else if (stored.length > 0 && !selectedReceipt) {
        setSelectedReceipt(stored[0]);
      }
    }
  }, [isOpen, activeReceipt]);

  if (!isOpen) return null;

  const handleDownloadJson = () => {
    if (!selectedReceipt) return;
    const blob = new Blob([JSON.stringify(selectedReceipt, null, 2)], {
      type: 'application/json',
    });
    saveAs(blob, `transformation-receipt-${selectedReceipt.receiptId}.json`);
  };

  const handleDownloadMarkdown = () => {
    if (!selectedReceipt) return;
    const md = formatReceiptMarkdown(selectedReceipt);
    const blob = new Blob([md], { type: 'text/markdown' });
    saveAs(blob, `certificate-${selectedReceipt.receiptId}.md`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100 select-none">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base text-white tracking-tight">
                  Cryptographic Transformation Receipts
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-300">
                  VERIFIABLE AUDIT
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Non-repudiable certificates with dual SHA-256 hashes, engine versions, and HMAC signatures
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Receipts Sidebar List */}
          <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/50 p-4 overflow-y-auto space-y-2 shrink-0">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Recent Receipts ({receipts.length})
            </div>

            {receipts.length === 0 ? (
              <div className="text-xs text-slate-500 italic py-4">No receipts recorded yet.</div>
            ) : (
              receipts.map((r) => (
                <div
                  key={r.receiptId}
                  onClick={() => setSelectedReceipt(r)}
                  className={`p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                    selectedReceipt?.receiptId === r.receiptId
                      ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-300'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="font-mono font-bold truncate">{r.receiptId}</div>
                  <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                    <span>{r.source.format.toUpperCase()} → {r.target.format.toUpperCase()}</span>
                    <span>{r.integrityScore}% fidelity</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Active Receipt Viewer */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {selectedReceipt ? (
              <>
                {/* Certificate Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-yellow-950/40 via-amber-950/30 to-slate-900 border border-yellow-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-yellow-400">
                      Audit Certificate
                    </span>
                    <h3 className="font-mono text-base font-extrabold text-white mt-0.5">
                      {selectedReceipt.receiptId}
                    </h3>
                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(selectedReceipt.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-slate-400 uppercase font-mono">Fidelity</span>
                    <span className="font-mono text-xl font-black text-emerald-400">
                      {selectedReceipt.integrityScore}%
                    </span>
                  </div>
                </div>

                {/* Source vs Target Artifacts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Source */}
                  <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span>Source Document</span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-[10px] text-blue-400">
                        {selectedReceipt.source.format.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white truncate">
                      {selectedReceipt.source.fileName}
                    </div>
                    <div className="text-xs text-slate-400">
                      Size: {(selectedReceipt.source.sizeBytes / 1024).toFixed(1)} KB
                    </div>
                    <div className="pt-2">
                      <span className="text-[10px] text-slate-500 uppercase font-mono">Source SHA-256</span>
                      <div className="p-2 rounded bg-black/40 font-mono text-[10px] text-slate-300 select-text break-all">
                        {selectedReceipt.source.sha256}
                      </div>
                    </div>
                  </div>

                  {/* Target */}
                  <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span>Target Document</span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-[10px] text-emerald-400">
                        {selectedReceipt.target.format.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white truncate">
                      {selectedReceipt.target.fileName}
                    </div>
                    <div className="text-xs text-slate-400">
                      Size: {(selectedReceipt.target.sizeBytes / 1024).toFixed(1)} KB
                    </div>
                    <div className="pt-2">
                      <span className="text-[10px] text-slate-500 uppercase font-mono">Target SHA-256</span>
                      <div className="p-2 rounded bg-black/40 font-mono text-[10px] text-slate-300 select-text break-all">
                        {selectedReceipt.target.sha256}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Toolchain & Signature */}
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                    <Cpu className="w-4 h-4 text-indigo-400" />
                    <span>Processing Engine &amp; Cryptographic Signature</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 text-[10px]">Engine</span>
                      <div className="font-bold text-white">{selectedReceipt.toolchain.engine}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 text-[10px]">Version</span>
                      <div className="font-bold text-white">{selectedReceipt.toolchain.version}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 text-[10px]">Execution Time</span>
                      <div className="font-bold text-white">{selectedReceipt.executionDurationMs} ms</div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-mono">HMAC Digital Signature</span>
                    <div className="p-2 rounded bg-black/40 font-mono text-[10px] text-yellow-300 select-text break-all">
                      {selectedReceipt.digitalSignature}
                    </div>
                  </div>
                </div>

                {/* Export Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={handleDownloadMarkdown}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-yellow-400" />
                    <span>Export Markdown Certificate</span>
                  </button>

                  <button
                    onClick={handleDownloadJson}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-slate-950 text-xs font-extrabold transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download JSON Receipt</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="py-20 text-center text-slate-500 text-xs">
                Select a receipt to inspect its cryptographic audit certificate.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
