import React, { useState } from 'react';
import { 
  RefreshCw, 
  DownloadCloud, 
  Plus, 
  Trash2, 
  Archive, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Eye, 
  SlidersHorizontal,
  Settings2
} from 'lucide-react';
import { ConversionJob, ConversionOptions, FileFormat } from '../../types';
import { FORMAT_REGISTRY, formatFileSize } from '../../services/formatDetector';
import { createBatchZipArchive, executeFileConversion } from '../../services/converter';
import { addConversionHistoryItem } from '../../services/storageService';
import saveAs from 'file-saver';
import confetti from 'canvas-confetti';

interface ConversionHubProps {
  jobs: ConversionJob[];
  setJobs: React.Dispatch<React.SetStateAction<ConversionJob[]>>;
  onAddFiles: (files: File[]) => void;
  onConversionCompleted?: () => void;
}

export const ConversionHub: React.FC<ConversionHubProps> = ({
  jobs,
  setJobs,
  onAddFiles,
  onConversionCompleted,
}) => {
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [globalOptions, setGlobalOptions] = useState<ConversionOptions>({
    quality: 0.92,
    pageOrientation: 'portrait',
    ocrLanguage: 'eng',
  });
  const [previewBlob, setPreviewBlob] = useState<{ url: string; name: string; type: string } | null>(null);

  // Run single job
  const runConversion = async (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job || job.status === 'processing') return;

    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: 'processing', progress: 10 } : j))
    );

    try {
      const res = await executeFileConversion(
        job.sourceFile,
        job.sourceFormat,
        job.targetFormat,
        job.options || globalOptions,
        (pct, _step) => {
          setJobs((prev) =>
            prev.map((j) => (j.id === jobId ? { ...j, progress: pct } : j))
          );
        }
      );

      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: 'completed',
                progress: 100,
                resultBlob: res.blob,
                resultFileName: res.fileName,
              }
            : j
        )
      );

      // Record to persistent conversion history (BUG-002 fix)
      addConversionHistoryItem({
        id: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sourceName: job.sourceFile.name,
        sourceFormat: job.sourceFormat,
        targetFormat: job.targetFormat,
        sizeBytes: res.blob.size || job.sourceFile.size,
        completedAt: Date.now(),
        status: 'completed',
      });
      onConversionCompleted?.();

      confetti({ particleCount: 30, spread: 60, origin: { y: 0.85 } });
    } catch (err: any) {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: 'error',
                errorMessage: err.message || 'Conversion failed',
              }
            : j
        )
      );

      // Record failed conversion in history
      addConversionHistoryItem({
        id: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sourceName: job.sourceFile.name,
        sourceFormat: job.sourceFormat,
        targetFormat: job.targetFormat,
        sizeBytes: job.sourceFile.size,
        completedAt: Date.now(),
        status: 'failed',
      });
      onConversionCompleted?.();
    }
  };

  // Convert all pending jobs
  const handleConvertAll = async () => {
    setIsProcessingAll(true);
    const pendingJobs = jobs.filter((j) => j.status === 'queued' || j.status === 'error');

    for (const job of pendingJobs) {
      await runConversion(job.id);
    }

    setIsProcessingAll(false);
  };

  // Download all as ZIP
  const handleDownloadAllZip = async () => {
    const completed = jobs.filter((j) => j.status === 'completed' && j.resultBlob);
    if (completed.length === 0) return;

    try {
      const zipBlob = await createBatchZipArchive(completed);
      saveAs(zipBlob, `OmniDoc_Export_${Date.now()}.zip`);
      confetti({ particleCount: 80, spread: 70 });
    } catch (err) {
      console.error('ZIP generation failed:', err);
    }
  };

  const handleDownloadSingle = (job: ConversionJob) => {
    if (job.resultBlob && job.resultFileName) {
      saveAs(job.resultBlob, job.resultFileName);
    }
  };

  const handlePreview = (job: ConversionJob) => {
    if (job.resultBlob) {
      const url = URL.createObjectURL(job.resultBlob);
      setPreviewBlob({
        url,
        name: job.resultFileName || 'Preview',
        type: job.resultBlob.type,
      });
    }
  };

  const completedCount = jobs.filter((j) => j.status === 'completed').length;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
      {/* Top Banner and Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/80 p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-white">Conversion Hub</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Universal Engine
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Convert documents, presentations, spreadsheets, and images with full precision and local privacy.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer transition-all">
            <Plus className="w-4 h-4 text-indigo-400" />
            <span>Add More Files</span>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && onAddFiles(Array.from(e.target.files))}
            />
          </label>

          {jobs.length > 0 && (
            <>
              <button
                onClick={handleConvertAll}
                disabled={isProcessingAll || jobs.every((j) => j.status === 'completed')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
              >
                {isProcessingAll ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span>Convert All ({jobs.length})</span>
              </button>

              {completedCount > 0 && (
                <button
                  onClick={handleDownloadAllZip}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <Archive className="w-4 h-4" />
                  <span>Download ZIP ({completedCount})</span>
                </button>
              )}

              <button
                onClick={() => setJobs([])}
                className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
                title="Clear all jobs"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Conversion Options Card */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-semibold">
          <Settings2 className="w-4 h-4 text-indigo-400" />
          <span>Conversion Settings:</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-slate-400">
          <div className="flex items-center gap-2">
            <span>Image Quality:</span>
            <input
              type="range"
              min="0.4"
              max="1.0"
              step="0.05"
              value={globalOptions.quality}
              onChange={(e) =>
                setGlobalOptions((prev) => ({ ...prev, quality: parseFloat(e.target.value) }))
              }
              className="accent-indigo-500 w-24 cursor-pointer"
            />
            <span className="text-slate-200 font-mono">
              {Math.round((globalOptions.quality || 0.92) * 100)}%
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span>Orientation:</span>
            <select
              value={globalOptions.pageOrientation}
              onChange={(e) =>
                setGlobalOptions((prev) => ({
                  ...prev,
                  pageOrientation: e.target.value as 'portrait' | 'landscape',
                }))
              }
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 cursor-pointer"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span>OCR Language:</span>
            <select
              value={globalOptions.ocrLanguage}
              onChange={(e) =>
                setGlobalOptions((prev) => ({ ...prev, ocrLanguage: e.target.value }))
              }
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 cursor-pointer"
            >
              <option value="eng">English</option>
              <option value="spa">Spanish (Español)</option>
              <option value="fra">French (Français)</option>
              <option value="deu">German (Deutsch)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Jobs Queue Table */}
      {jobs.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-2xl p-6 bg-slate-900/30">
          <RefreshCw className="w-10 h-10 mx-auto text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-slate-300">No conversion tasks queued</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Upload files from the Dashboard or click below to start converting documents and media.
          </p>
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>Select Files</span>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && onAddFiles(Array.from(e.target.files))}
            />
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const allowed = FORMAT_REGISTRY[job.sourceFormat]?.allowedConversions || ['pdf', 'txt'];

            return (
              <div
                key={job.id}
                className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
              >
                {/* File Info */}
                <div className="flex items-center gap-3 min-w-[240px] max-w-md">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs uppercase text-white shrink-0"
                    style={{ backgroundColor: FORMAT_REGISTRY[job.sourceFormat]?.color || '#4f46e5' }}
                  >
                    {job.sourceFormat}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-sm font-semibold text-slate-200 truncate" title={job.sourceFile.name}>
                      {job.sourceFile.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatFileSize(job.sourceFile.size)}
                    </div>
                  </div>
                </div>

                {/* Conversion Selector: Source -> Target */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Target:</span>
                  <select
                    value={job.targetFormat}
                    onChange={(e) => {
                      const newTarget = e.target.value as FileFormat;
                      setJobs((prev) =>
                        prev.map((j) => (j.id === job.id ? { ...j, targetFormat: newTarget } : j))
                      );
                    }}
                    disabled={job.status === 'processing'}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-semibold uppercase cursor-pointer"
                  >
                    {allowed.map((fmt) => (
                      <option key={fmt} value={fmt}>
                        .{fmt.toUpperCase()} — {FORMAT_REGISTRY[fmt]?.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Progress / Status */}
                <div className="min-w-[140px]">
                  {job.status === 'queued' && (
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-500" />
                      Ready to convert
                    </span>
                  )}
                  {job.status === 'processing' && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-indigo-400">
                        <span>Converting...</span>
                        <span>{job.progress}%</span>
                      </div>
                      <div className="w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {job.status === 'completed' && (
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Completed
                    </span>
                  )}
                  {job.status === 'error' && (
                    <span className="text-xs text-red-400 flex items-center gap-1.5" title={job.errorMessage}>
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      Failed
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 self-end md:self-center">
                  {job.status === 'completed' ? (
                    <>
                      <button
                        onClick={() => handlePreview(job)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Preview Result"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDownloadSingle(job)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                      >
                        <DownloadCloud className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => runConversion(job.id)}
                      disabled={job.status === 'processing'}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                    >
                      {job.status === 'processing' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>Convert</span>
                    </button>
                  )}

                  <button
                    onClick={() => setJobs((prev) => prev.filter((j) => j.id !== job.id))}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      {previewBlob && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white truncate">{previewBlob.name}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => saveAs(previewBlob.url, previewBlob.name)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Download
                </button>
                <button
                  onClick={() => {
                    URL.revokeObjectURL(previewBlob.url);
                    setPreviewBlob(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950">
              {previewBlob.type.startsWith('image/') ? (
                <img src={previewBlob.url} alt="Preview" className="max-w-full max-h-[65vh] object-contain rounded-lg" />
              ) : previewBlob.type === 'application/pdf' ? (
                <iframe src={previewBlob.url} className="w-full h-[65vh] rounded-lg border-0" title="PDF preview" />
              ) : (
                <div className="text-center p-8 text-slate-400">
                  <p className="text-sm">Preview generated for this file format.</p>
                  <p className="text-xs text-slate-500 mt-1">Download to view and edit in your native application.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
