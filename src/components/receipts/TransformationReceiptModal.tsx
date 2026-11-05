import React, { useState, useEffect } from 'react';
import { TransformationReceipt } from '../../types';
import { getStoredReceipts, formatReceiptMarkdown, verifyTransformationReceipt } from '../../services/receiptService';
import {
  Sparkles,
  Download,
  X,
  FileCheck,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Cpu,
  Layers,
  ArrowRight,
  Hash,
  CheckCircle2
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
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredReceipts();
      setReceipts(stored);
      if (activeReceipt) {
        setSelectedReceipt(activeReceipt);
        setVerificationStatus('idle');
      } else if (stored.length > 0 && !selectedReceipt) {
        setSelectedReceipt(stored[0]);
        setVerificationStatus('idle');
      }
    }
  }, [isOpen, activeReceipt]);

  const handleVerifySignature = async () => {
    if (!selectedReceipt) return;
    const isValid = await verifyTransformationReceipt(selectedReceipt);
    setVerificationStatus(isValid ? 'valid' : 'invalid');
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080B18]/80 backdrop-blur-xl animate-fadeIn">
      <div className="w-full max-w-4xl max-h-[90vh] glass-panel border-white/15 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-[#F4F5FF] select-none">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base text-[#F4F5FF] tracking-tight">
                  Cryptographic Transformation Receipts
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  VERIFIABLE AUDIT
                </span>
              </div>
              <p className="text-xs text-[#9BA3BD]">
                Non-repudiable certificates with dual SHA-256 hashes, engine versions, and HMAC signatures
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#9BA3BD] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Receipts Sidebar List */}
          <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-white/10 bg-black/20 p-4 overflow-y-auto space-y-2 shrink-0">
            <div className="text-[11px] font-bold text-[#9BA3BD] uppercase tracking-wider mb-2">
              Recent Receipts ({receipts.length})
            </div>

            {receipts.length === 0 ? (
              <div className="text-xs text-[#9BA3BD]/60 italic py-4">No receipts recorded yet.</div>
            ) : (
              receipts.map((r) => (
                <div
                  key={r.receiptId}
                  onClick={() => setSelectedReceipt(r)}
                  className={`p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                    selectedReceipt?.receiptId === r.receiptId
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      : 'bg-white/[0.03] border-white/10 hover:border-white/20 text-[#9BA3BD]'
                  }`}
                >
                  <div className="font-mono font-bold truncate">{r.receiptId}</div>
                  <div className="text-[10px] text-[#9BA3BD] mt-1 flex justify-between">
                    <span>{r.source.format.toUpperCase()} → {r.target.format.toUpperCase()}</span>
                    <span className="text-emerald-400 font-semibold">{r.integrityScore}% fidelity</span>
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
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-white/[0.02] border border-amber-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400">
                      Audit Certificate
                    </span>
                    <h3 className="font-mono text-base font-extrabold text-[#F4F5FF] mt-0.5">
                      {selectedReceipt.receiptId}
                    </h3>
                    <div className="text-xs text-[#9BA3BD] flex items-center gap-2 mt-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(selectedReceipt.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-[#9BA3BD] uppercase font-mono">Fidelity</span>
                    <span className="font-mono text-xl font-black text-emerald-400">
                      {selectedReceipt.integrityScore}%
                    </span>
                  </div>
                </div>

                {/* Source vs Target Artifacts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Source */}
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[#F4F5FF]">
                      <span>Source Document</span>
                      <span className="px-2 py-0.5 rounded bg-[#8B7CFF]/20 border border-[#8B7CFF]/30 font-mono text-[10px] text-[#8B7CFF]">
                        {selectedReceipt.source.format.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-[#F4F5FF] truncate">
                      {selectedReceipt.source.fileName}
                    </div>
                    <div className="text-xs text-[#9BA3BD]">
                      Size: {(selectedReceipt.source.sizeBytes / 1024).toFixed(1)} KB
                    </div>
                    <div className="pt-2">
                      <span className="text-[10px] text-[#9BA3BD] uppercase font-mono">Source SHA-256</span>
                      <div className="p-2 rounded bg-black/40 border border-white/5 font-mono text-[10px] text-[#F4F5FF] select-text break-all">
                        {selectedReceipt.source.sha256}
                      </div>
                    </div>
                  </div>

                  {/* Target */}
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[#F4F5FF]">
                      <span>Target Document</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 font-mono text-[10px] text-emerald-400">
                        {selectedReceipt.target.format.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-[#F4F5FF] truncate">
                      {selectedReceipt.target.fileName}
                    </div>
                    <div className="text-xs text-[#9BA3BD]">
                      Size: {(selectedReceipt.target.sizeBytes / 1024).toFixed(1)} KB
                    </div>
                    <div className="pt-2">
                      <span className="text-[10px] text-[#9BA3BD] uppercase font-mono">Target SHA-256</span>
                      <div className="p-2 rounded bg-black/40 border border-white/5 font-mono text-[10px] text-[#F4F5FF] select-text break-all">
                        {selectedReceipt.target.sha256}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Toolchain & Signature */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#F4F5FF]">
                    <Cpu className="w-4 h-4 text-[#8B7CFF]" />
                    <span>Processing Engine &amp; Cryptographic Signature</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-black/30 border border-white/10">
                      <span className="text-[#9BA3BD] text-[10px]">Engine</span>
                      <div className="font-bold text-[#F4F5FF]">{selectedReceipt.toolchain.engine}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-black/30 border border-white/10">
                      <span className="text-[#9BA3BD] text-[10px]">Version</span>
                      <div className="font-bold text-[#F4F5FF]">{selectedReceipt.toolchain.version}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-black/30 border border-white/10">
                      <span className="text-[#9BA3BD] text-[10px]">Execution Time</span>
                      <div className="font-bold text-[#F4F5FF]">{selectedReceipt.executionDurationMs} ms</div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-[#9BA3BD] uppercase font-mono">WebCrypto HMAC-SHA256 Signature</span>
                      <button
                        onClick={handleVerifySignature}
                        className="text-[10px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
                      >
                        Verify Signature Integrity
                      </button>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-white/5 font-mono text-[10px] text-amber-300 select-text break-all">
                      {selectedReceipt.digitalSignature}
                    </div>

                    {verificationStatus === 'valid' && (
                      <div className="mt-2 flex items-center gap-1.5 p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Cryptographically Authenticated: WebCrypto HMAC signature matches canonical payload.</span>
                      </div>
                    )}

                    {verificationStatus === 'invalid' && (
                      <div className="mt-2 flex items-center gap-1.5 p-2 rounded-lg bg-red-950/40 border border-red-500/30 text-red-400 text-xs font-bold">
                        <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                        <span>Tamper Alert: Signature verification failed. Payload or hashes do not match.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Export Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={handleDownloadMarkdown}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-[#F4F5FF] border border-white/15 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Export Markdown Certificate</span>
                  </button>

                  <button
                    onClick={handleDownloadJson}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#080B18] text-xs font-extrabold transition-colors cursor-pointer shadow-md shadow-amber-500/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download JSON Receipt</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="py-20 text-center text-[#9BA3BD] text-xs">
                Select a receipt to inspect its cryptographic audit certificate.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
