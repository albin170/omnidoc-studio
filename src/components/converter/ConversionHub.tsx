import React, { useState, useRef } from 'react';
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
  Settings2,
  X,
  Grid,
  Check,
  Ban,
  FileCode,
  ShieldCheck
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

const SUPPORTED_MATRIX_FORMATS: FileFormat[] = [
  'pdf',
  'docx',
  'pptx',
  'xlsx',
  'csv',
  'png',
  'jpg',
  'webp',
  'txt',
  'html',
  'md'
];

export const ConversionHub: React.FC<ConversionHubProps> = ({
  jobs,
  setJobs,
  onAddFiles,
  onConversionCompleted,
}) => {
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [globalOptions, setGlobalOptions] = useState<ConversionOptions>({
    quality: 0.92,
    pageOrientation: 'portrait',
    ocrLanguage: 'eng',
  });
  const [previewBlob, setPreviewBlob] = useState<{ url: string; name: string; type: string } | null>(null);

  // Active AbortControllers map for real in-flight worker cancellation
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Cancel active job with genuine AbortSignal propagation
  const cancelConversion = (jobId: string) => {
    const controller = abortControllersRef.current.get(jobId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(jobId);
    }
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? { ...j, status: 'queued', progress: 0, errorMessage: 'Conversion cancelled by user' }
          : j
      )
    );
  };

  // Switch target format and make job ready for another conversion without re-uploading
  const handleTargetFormatChange = (jobId: string, newTarget: FileFormat) => {
    setJobs((prev) =>
      prev.map((j) => {
        if (j.id === jobId) {
          return {
            ...j,
            targetFormat: newTarget,
            status: 'queued',
            progress: 0,
            resultBlob: undefined,
            resultFileName: undefined,
            errorMessage: undefined,
          };
        }
        return j;
      })
    );
  };

  // Run single job with AbortController
  const runConversion = async (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job || job.status === 'processing') return;

    const controller = new AbortController();
    abortControllersRef.current.set(jobId, controller);

    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: 'processing', progress: 10, errorMessage: undefined } : j))
    );

    try {
      const res = await executeFileConversion(
        job.sourceFile,
        job.sourceFormat,
        job.targetFormat,
        {
          ...(job.options || globalOptions),
          signal: controller.signal,
        },
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

      // Record to persistent conversion history
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
      if (err.name === 'AbortError' || controller.signal.aborted) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? { ...j, status: 'queued', progress: 0, errorMessage: 'Conversion cancelled' }
              : j
          )
        );
        return;
      }

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
    } finally {
      abortControllersRef.current.delete(jobId);
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
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 text-[#F4F5FF] custom-scrollbar bg-[#080B18]/60">
      {/* Top Banner and Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/10 shadow-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-[#F4F5FF]">Conversion Hub</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#8B7CFF]/20 text-[#8B7CFF] border border-[#8B7CFF]/30 glow-purple">
              Verified Pipeline
            </span>
          </div>
          <p className="text-xs md:text-sm text-[#9BA3BD] mt-1">
            Convert documents, presentations, spreadsheets, and media with genuine header validation and client-side privacy.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowMatrixModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass-card hover:border-[#42D6E8]/50 text-[#42D6E8] text-xs font-semibold cursor-pointer transition-all"
            title="View full conversion compatibility matrix"
          >
            <Grid className="w-4 h-4 text-[#42D6E8]" />
            <span>Compatibility Matrix</span>
          </button>

          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass-card hover:border-[#8B7CFF]/50 text-[#F4F5FF] text-xs font-semibold cursor-pointer transition-all">
            <Plus className="w-4 h-4 text-[#8B7CFF]" />
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
                className="flex items-center gap-2 px-4 py-2 rounded-xl glass-btn-primary disabled:opacity-50 text-xs font-semibold shadow-lg shadow-[#8B7CFF]/25 transition-all cursor-pointer"
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
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold shadow-md transition-all cursor-pointer"
                >
                  <Archive className="w-4 h-4" />
                  <span>Download ZIP ({completedCount})</span>
                </button>
              )}

              <button
                onClick={() => setJobs([])}
                className="p-2 rounded-xl text-[#9BA3BD] hover:text-rose-400 glass-card transition-colors cursor-pointer"
                title="Clear all jobs"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Conversion Options Card */}
      <div className="p-4 rounded-2xl glass-card border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 text-[#F4F5FF] font-semibold">
          <Settings2 className="w-4 h-4 text-[#42D6E8]" />
          <span>Conversion Settings:</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[#9BA3BD]">
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
              className="accent-[#8B7CFF] w-24 cursor-pointer"
            />
            <span className="text-[#F4F5FF] font-mono">
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
              className="glass-input rounded-xl px-2.5 py-1 text-[#F4F5FF] cursor-pointer bg-[#11152A]"
            >
              <option value="portrait" className="bg-[#11152A] text-white">Portrait</option>
              <option value="landscape" className="bg-[#11152A] text-white">Landscape</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span>OCR Language:</span>
            <select
              value={globalOptions.ocrLanguage}
              onChange={(e) =>
                setGlobalOptions((prev) => ({ ...prev, ocrLanguage: e.target.value }))
              }
              className="glass-input rounded-xl px-2.5 py-1 text-[#F4F5FF] cursor-pointer bg-[#11152A]"
            >
              <option value="eng" className="bg-[#11152A] text-white">English</option>
              <option value="spa" className="bg-[#11152A] text-white">Spanish (Español)</option>
              <option value="fra" className="bg-[#11152A] text-white">French (Français)</option>
              <option value="deu" className="bg-[#11152A] text-white">German (Deutsch)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Jobs Queue Table */}
      {jobs.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-white/15 rounded-3xl p-6 glass-panel">
          <RefreshCw className="w-10 h-10 mx-auto text-[#9BA3BD]/50 mb-3" />
          <h3 className="text-base font-semibold text-[#F4F5FF]">No conversion tasks queued</h3>
          <p className="text-xs text-[#9BA3BD] max-w-sm mx-auto mt-1 mb-4">
            Upload files from the Dashboard or click below to start converting documents and media.
          </p>
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass-btn-primary text-xs font-semibold cursor-pointer shadow-lg shadow-[#8B7CFF]/20">
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
                className="p-4 rounded-2xl glass-card border-white/10 hover:border-[#8B7CFF]/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
              >
                {/* File Info */}
                <div className="flex items-center gap-3 min-w-[240px] max-w-md">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs uppercase text-white shrink-0 shadow-md"
                    style={{ backgroundColor: FORMAT_REGISTRY[job.sourceFormat]?.color || '#8B7CFF' }}
                  >
                    {job.sourceFormat}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-sm font-semibold text-[#F4F5FF] truncate" title={job.sourceFile.name}>
                      {job.sourceFile.name}
                    </div>
                    <div className="text-xs text-[#9BA3BD]">
                      {formatFileSize(job.sourceFile.size)}
                    </div>
                  </div>
                </div>

                {/* Conversion Selector: Source -> Target */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#9BA3BD]">Target:</span>
                  <select
                    value={job.targetFormat}
                    onChange={(e) => handleTargetFormatChange(job.id, e.target.value as FileFormat)}
                    disabled={job.status === 'processing'}
                    className="glass-input rounded-xl px-2.5 py-1.5 text-[#F4F5FF] font-semibold uppercase cursor-pointer bg-[#11152A]"
                  >
                    {allowed.map((fmt) => (
                      <option key={fmt} value={fmt} className="bg-[#11152A] text-white">
                        .{fmt.toUpperCase()} — {FORMAT_REGISTRY[fmt]?.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Progress / Status */}
                <div className="min-w-[140px]">
                  {job.status === 'queued' && (
                    <span className="text-xs text-[#9BA3BD] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#9BA3BD]" />
                      Ready to convert
                    </span>
                  )}
                  {job.status === 'processing' && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-[#8B7CFF]">
                        <span>Converting...</span>
                        <span>{job.progress}%</span>
                      </div>
                      <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#8B7CFF] to-[#42D6E8] rounded-full transition-all duration-300"
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
                    <span className="text-xs text-rose-400 flex items-center gap-1.5" title={job.errorMessage}>
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span className="truncate max-w-[120px]">{job.errorMessage || 'Failed'}</span>
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 self-end md:self-center">
                  {job.status === 'completed' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handlePreview(job)}
                        className="p-2 rounded-xl glass-card hover:border-[#8B7CFF]/50 text-[#9BA3BD] hover:text-[#F4F5FF] transition-colors cursor-pointer"
                        title="Preview Result"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDownloadSingle(job)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-btn-primary text-xs font-semibold shadow-sm transition-all cursor-pointer"
                        title="Download converted file"
                      >
                        <DownloadCloud className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>

                      <button
                        onClick={() => runConversion(job.id)}
                        className="p-2 rounded-xl glass-card hover:border-[#8B7CFF]/50 text-[#9BA3BD] hover:text-[#F4F5FF] transition-colors cursor-pointer"
                        title="Convert again / Re-run"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {job.status === 'processing' && (
                    <button
                      onClick={() => cancelConversion(job.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold cursor-pointer transition-colors shadow-sm"
                      title="Abort conversion"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  )}

                  {job.status === 'error' && (
                    <button
                      onClick={() => runConversion(job.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold cursor-pointer transition-colors"
                      title="Retry conversion"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                  )}

                  {job.status === 'queued' && (
                    <button
                      onClick={() => runConversion(job.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-btn-primary text-xs font-semibold cursor-pointer shadow-sm shadow-[#8B7CFF]/20"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Convert</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      cancelConversion(job.id);
                      setJobs((prev) => prev.filter((j) => j.id !== job.id));
                    }}
                    className="p-2 rounded-xl glass-card text-[#9BA3BD] hover:text-rose-400 transition-colors cursor-pointer"
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

      {/* Compatibility Matrix Modal */}
      {showMatrixModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel border-white/15 rounded-3xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl text-[#F4F5FF]">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Grid className="w-5 h-5 text-[#42D6E8]" />
                <div>
                  <h3 className="text-base font-bold text-[#F4F5FF]">
                    Universal Conversion Compatibility Matrix
                  </h3>
                  <p className="text-xs text-[#9BA3BD]">
                    Supported client-side transformation routes with full layout and text extraction fidelity.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMatrixModal(false)}
                className="p-1.5 rounded-xl glass-card text-[#9BA3BD] hover:text-[#F4F5FF] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5 custom-scrollbar">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[#9BA3BD]">
                      <th className="py-2.5 px-3 uppercase tracking-wider font-semibold">Source Format</th>
                      <th className="py-2.5 px-3 uppercase tracking-wider font-semibold">Category</th>
                      <th className="py-2.5 px-3 uppercase tracking-wider font-semibold">Supported Target Formats</th>
                      <th className="py-2.5 px-3 uppercase tracking-wider font-semibold text-center">Fidelity Mode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {SUPPORTED_MATRIX_FORMATS.map((fmt) => {
                      const meta = FORMAT_REGISTRY[fmt];
                      if (!meta) return null;
                      return (
                        <tr key={fmt} className="hover:bg-white/[0.03] transition-colors">
                          <td className="py-2.5 px-3 font-bold flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: meta.color }}
                            />
                            <span className="text-[#F4F5FF] uppercase">.{fmt}</span>
                            <span className="text-[11px] text-[#9BA3BD] font-normal">({meta.label})</span>
                          </td>
                          <td className="py-2.5 px-3 text-[#9BA3BD] capitalize">{meta.category}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1">
                              {meta.allowedConversions.map((tgt) => (
                                <span
                                  key={tgt}
                                  className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-mono font-semibold text-[#42D6E8]"
                                >
                                  .{tgt.toUpperCase()}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <ShieldCheck className="w-3 h-3" />
                              Client-Side Native
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-white/10 bg-[#080B18]/50 flex justify-end">
              <button
                onClick={() => setShowMatrixModal(false)}
                className="px-4 py-2 rounded-xl glass-btn-primary text-xs font-semibold"
              >
                Close Matrix
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewBlob && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel border-white/15 rounded-3xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl text-[#F4F5FF]">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F4F5FF] truncate">{previewBlob.name}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => saveAs(previewBlob.url, previewBlob.name)}
                  className="px-3.5 py-1.5 rounded-xl glass-btn-primary text-xs font-semibold cursor-pointer shadow-md shadow-[#8B7CFF]/20"
                >
                  Download
                </button>
                <button
                  onClick={() => {
                    URL.revokeObjectURL(previewBlob.url);
                    setPreviewBlob(null);
                  }}
                  className="px-3 py-1.5 rounded-xl glass-card text-[#9BA3BD] hover:text-[#F4F5FF] text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-[#080B18]/80">
              {previewBlob.type.startsWith('image/') ? (
                <img src={previewBlob.url} alt="Preview" className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-2xl" />
              ) : previewBlob.type === 'application/pdf' ? (
                <iframe src={previewBlob.url} className="w-full h-[65vh] rounded-xl border border-white/10" title="PDF preview" />
              ) : (
                <div className="text-center p-8 text-[#9BA3BD] space-y-2">
                  <FileCode className="w-10 h-10 mx-auto text-[#8B7CFF] opacity-60" />
                  <p className="text-sm text-[#F4F5FF] font-semibold">Preview generated for this file format.</p>
                  <p className="text-xs text-[#9BA3BD] mt-1">Download to view and edit in your native application.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
