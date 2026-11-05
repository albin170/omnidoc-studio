import React, { useState } from 'react';
import { 
  X, 
  Layers, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Archive,
  FileText
} from 'lucide-react';
import { FileFormat, BatchJobItem } from '../../types';
import { runBatchConversion, BatchRunProgress } from '../../services/batchService';
import { FORMAT_REGISTRY, formatFileSize } from '../../services/formatDetector';
import saveAs from 'file-saver';
import { useToast } from '../../services/toastService';
import confetti from 'canvas-confetti';

interface BatchAutomationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BatchAutomationModal: React.FC<BatchAutomationModalProps> = ({ isOpen, onClose }) => {
  const { addToast } = useToast();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [targetFormat, setTargetFormat] = useState<FileFormat>('pdf');
  const [namingPattern, setNamingPattern] = useState('{original}_converted_{date}');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<BatchRunProgress | null>(null);
  const [zipResult, setZipResult] = useState<{ blob: Blob; jobs: BatchJobItem[] } | null>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...files]);
      addToast('info', 'Files Queued', `${files.length} file(s) added to batch.`);
    }
  };

  const handleClear = () => {
    setSelectedFiles([]);
    setZipResult(null);
    setProgress(null);
  };

  const handleExecuteBatch = async () => {
    if (selectedFiles.length === 0) {
      addToast('warning', 'No Files', 'Please select at least one document to convert.');
      return;
    }

    setIsProcessing(true);
    setZipResult(null);

    try {
      const items = selectedFiles.map((file) => ({
        file,
        targetFormat,
      }));

      const res = await runBatchConversion(items, namingPattern, (p) => {
        setProgress(p);
      });

      setZipResult({ blob: res.zipBlob, jobs: res.jobs });
      confetti({ particleCount: 50, spread: 70 });
      addToast('success', 'Batch Complete', `Converted ${res.jobs.filter((j) => j.status === 'done').length} files into ZIP archive.`);
    } catch (err: any) {
      addToast('error', 'Batch Execution Failed', err?.message || 'Error occurred during batch conversion.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadZip = () => {
    if (!zipResult) return;
    saveAs(zipResult.blob, `OmniDoc_Batch_${targetFormat.toUpperCase()}_${Date.now()}.zip`);
    addToast('info', 'Download Started', 'ZIP bundle is downloading.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080B18]/80 backdrop-blur-xl animate-fadeIn">
      <div className="glass-panel border-white/15 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-[#F4F5FF]">
        {/* Header */}
        <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#8B7CFF]/15 text-[#8B7CFF] border border-[#8B7CFF]/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#F4F5FF] flex items-center gap-2">
                Batch Document Conversion &amp; ZIP Automation
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#8B7CFF]/20 text-[#8B7CFF] font-semibold border border-[#8B7CFF]/30">
                  v2.0 Automation
                </span>
              </h2>
              <p className="text-xs text-[#9BA3BD]">
                Process multiple documents in parallel and bundle outputs into a verified ZIP archive
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-[#9BA3BD] hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="p-5 border-b border-white/10 bg-white/[0.02] grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0 text-xs">
          <div>
            <label className="text-[11px] font-bold text-[#9BA3BD] uppercase tracking-wider block mb-1.5">
              Unified Target Format
            </label>
            <select
              value={targetFormat}
              onChange={(e) => setTargetFormat(e.target.value as FileFormat)}
              className="w-full bg-[#11152A] border border-white/15 rounded-xl px-3 py-2 text-[#F4F5FF] font-semibold outline-none focus:border-[#8B7CFF]"
            >
              <option value="pdf">PDF (Portable Document Format)</option>
              <option value="docx">DOCX (Microsoft Word)</option>
              <option value="html">HTML (Clean Web Document)</option>
              <option value="txt">TXT (Plain Text Document)</option>
              <option value="csv">CSV (Comma-Separated Grid)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-[#9BA3BD] uppercase tracking-wider block mb-1.5">
              Naming Template
            </label>
            <input
              type="text"
              value={namingPattern}
              onChange={(e) => setNamingPattern(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/15 rounded-xl px-3 py-2 text-[#F4F5FF] font-mono outline-none focus:border-[#8B7CFF]"
              placeholder="{original}_converted_{date}"
            />
          </div>

          <div className="flex items-end gap-2">
            <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-[#F4F5FF] font-semibold border border-white/15 cursor-pointer transition-colors">
              <Upload className="w-4 h-4 text-[#42D6E8]" />
              <span>Add Files</span>
              <input type="file" multiple className="hidden" onChange={handleFileSelect} />
            </label>
            {selectedFiles.length > 0 && (
              <button
                onClick={handleClear}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-[#9BA3BD] hover:text-white text-xs font-semibold cursor-pointer border border-white/10 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* File Queue List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {selectedFiles.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-[#9BA3BD] border-2 border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
              <Archive className="w-10 h-10 mb-2 stroke-1 text-[#9BA3BD]/40" />
              <p className="text-xs font-semibold text-[#F4F5FF]">No files selected in batch queue</p>
              <p className="text-[11px] text-[#9BA3BD]">Click &quot;Add Files&quot; above to select multiple documents</p>
            </div>
          ) : (
            selectedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#8B7CFF]/15 text-[#8B7CFF] border border-[#8B7CFF]/30 font-bold flex items-center justify-center text-[10px]">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-semibold text-[#F4F5FF] truncate max-w-sm">{file.name}</div>
                    <div className="text-[10px] text-[#9BA3BD]">{formatFileSize(file.size)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-[#42D6E8] uppercase">
                    &rarr; {targetFormat}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer & Actions */}
        <div className="p-5 border-t border-white/10 bg-white/[0.02] flex items-center justify-between shrink-0">
          <div>
            {progress && (
              <div className="text-xs text-[#9BA3BD] flex items-center gap-2">
                <span>Progress: {progress.completed} / {progress.total} done</span>
                {progress.failed > 0 && <span className="text-red-400 font-semibold">({progress.failed} failed)</span>}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {zipResult && (
              <button
                onClick={handleDownloadZip}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 cursor-pointer animate-bounce"
              >
                <Download className="w-4 h-4" />
                <span>Download Bundled ZIP</span>
              </button>
            )}

            <button
              onClick={handleExecuteBatch}
              disabled={isProcessing || selectedFiles.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl glass-btn-primary text-white font-bold text-xs shadow-lg shadow-[#8B7CFF]/30 cursor-pointer disabled:opacity-40"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Converting Batch...</span>
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4" />
                  <span>Execute Batch Conversion</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
