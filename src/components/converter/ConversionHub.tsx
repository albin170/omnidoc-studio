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
  ShieldCheck,
  UploadCloud,
  ArrowRight,
  ArrowLeftRight,
  Crown,
  Clock,
  Play,
  Pause,
  FileText
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
  const [selectedSourceFmt, setSelectedSourceFmt] = useState<FileFormat>('pdf');
  const [selectedTargetFmt, setSelectedTargetFmt] = useState<FileFormat>('docx');
  const [isDragOverDropzone, setIsDragOverDropzone] = useState(false);

  const [globalOptions, setGlobalOptions] = useState<ConversionOptions>({
    quality: 0.92,
    pageOrientation: 'portrait',
    ocrLanguage: 'eng',
  });
  const [previewBlob, setPreviewBlob] = useState<{ url: string; name: string; type: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Cancel active job
  const cancelConversion = (jobId: string) => {
    const controller = abortControllersRef.current.get(jobId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(jobId);
    }
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? { ...j, status: 'cancelled', progress: 0, errorMessage: 'Conversion cancelled by user' }
          : j
      )
    );
  };

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
          if (controller.signal.aborted) return;
          setJobs((prev) =>
            prev.map((j) => (j.id === jobId ? { ...j, progress: pct } : j))
          );
        }
      );

      if (controller.signal.aborted) {
        return;
      }

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
              ? { ...j, status: 'cancelled', progress: 0, errorMessage: 'Conversion cancelled' }
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

  const handleConvertAll = async () => {
    setIsProcessingAll(true);
    const pendingJobs = jobs.filter((j) => j.status === 'queued' || j.status === 'error' || j.status === 'cancelled');

    for (const job of pendingJobs) {
      await runConversion(job.id);
    }

    setIsProcessingAll(false);
  };

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

  // Convert now from format selector
  const handleQuickConvertNow = () => {
    if (jobs.length > 0) {
      handleConvertAll();
    } else {
      fileInputRef.current?.click();
    }
  };

  const completedCount = jobs.filter((j) => j.status === 'completed').length;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6 text-[#F5FAFF] custom-scrollbar bg-transparent">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        className="hidden"
        onChange={(e) => e.target.files && onAddFiles(Array.from(e.target.files))}
      />

      {/* ========================================================================= */}
      {/* 1. TOP HEADER: Conversion Studio with Go Premium Button (Reference)       */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#F5FAFF] tracking-tight">
              Conversion Studio
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30 lg-glow-ice">
              Client-Side Native
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#A7B8CA] mt-0.5 font-medium">
            Convert your files to any supported format with 100% offline privacy.
          </p>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <button
            onClick={() => setShowMatrixModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-card hover:border-[#38BDF8]/50 text-[#38BDF8] text-xs font-semibold cursor-pointer transition-all"
            title="View full conversion matrix"
          >
            <Grid className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>Matrix</span>
          </button>

          {/* Go Premium Golden Crown Button (Matching Reference) */}
          <button
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold shadow-md transition-all cursor-pointer hover:scale-105"
          >
            <Crown className="w-3.5 h-3.5 text-amber-300" />
            <span>Go Premium</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. THREE-PANEL CORE LAYOUT (Exact Reference Match)                        */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Panel 1 (4 cols): Drag & Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOverDropzone(true);
          }}
          onDragLeave={() => setIsDragOverDropzone(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOverDropzone(false);
            if (e.dataTransfer.files) onAddFiles(Array.from(e.dataTransfer.files));
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`lg:col-span-4 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all relative overflow-hidden border-2 border-dashed ${
            isDragOverDropzone
              ? 'border-[#38BDF8] bg-[#38BDF8]/15 scale-[1.02] shadow-2xl shadow-[#38BDF8]/20'
              : 'border-white/15 lg-liquid-6 hover:border-[#38BDF8]/50'
          }`}
        >
          {/* Glowing upload cloud icon — Red & Blue liquid glow */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#FF3366]/25 to-[#38BDF8]/25 border border-white/20 flex items-center justify-center text-[#38BDF8] mb-4 shadow-xl group-hover:scale-110 transition-transform animate-float lg-glow-dual">
            <UploadCloud className="w-8 h-8 text-[#38BDF8]" />
          </div>

          <h3 className="text-sm sm:text-base font-bold text-[#F5FAFF]">
            Drag &amp; drop files here
          </h3>
          <p className="text-xs text-[#A7B8CA] my-2">or</p>

          <button
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="px-5 py-2 rounded-full bg-gradient-to-r from-[#38BDF8] to-[#FF3366] hover:from-[#FF6688] hover:to-[#FF3366] text-white text-xs font-bold shadow-lg shadow-[#38BDF8]/25 transition-all hover:scale-105 active:scale-95"
          >
            Choose Files
          </button>
        </div>

        {/* Panel 2 (4 cols): Format Selection */}
        <div className="lg:col-span-4 rounded-3xl p-6 glass-card border border-white/10 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-sm font-bold text-[#F5FAFF] pb-2 border-b border-white/[0.08]">
              Format Selection
            </h2>

            {/* From <-> To Cards (Reference Style) */}
            <div className="flex items-center justify-between gap-3 my-5">
              {/* From format card */}
              <div className="flex-1 p-3.5 rounded-2xl glass-input flex flex-col items-center justify-center gap-1.5 text-center">
                <span className="text-[10px] uppercase font-bold text-[#A7B8CA]">From</span>
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center font-black text-xs">
                  {selectedSourceFmt.toUpperCase()}
                </div>
                <select
                  value={selectedSourceFmt}
                  onChange={(e) => setSelectedSourceFmt(e.target.value as FileFormat)}
                  className="bg-transparent text-xs font-bold text-[#F5FAFF] outline-none text-center cursor-pointer"
                >
                  <option value="pdf" className="bg-[#0B1420] text-white">PDF</option>
                  <option value="docx" className="bg-[#0B1420] text-white">DOCX</option>
                  <option value="pptx" className="bg-[#0B1420] text-white">PPTX</option>
                  <option value="xlsx" className="bg-[#0B1420] text-white">XLSX</option>
                  <option value="png" className="bg-[#0B1420] text-white">PNG</option>
                  <option value="jpg" className="bg-[#0B1420] text-white">JPG</option>
                  <option value="txt" className="bg-[#0B1420] text-white">TXT</option>
                </select>
              </div>

              {/* Swap Button */}
              <button
                onClick={() => {
                  const temp = selectedSourceFmt;
                  setSelectedSourceFmt(selectedTargetFmt);
                  setSelectedTargetFmt(temp);
                }}
                className="w-8 h-8 rounded-full glass-card hover:border-[#38BDF8]/50 flex items-center justify-center text-[#A7B8CA] hover:text-[#F5FAFF] transition-all cursor-pointer"
                title="Swap formats"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-[#38BDF8]" />
              </button>

              {/* To format card */}
              <div className="flex-1 p-3.5 rounded-2xl glass-input flex flex-col items-center justify-center gap-1.5 text-center">
                <span className="text-[10px] uppercase font-bold text-[#A7B8CA]">To</span>
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-black text-xs">
                  {selectedTargetFmt.toUpperCase()}
                </div>
                <select
                  value={selectedTargetFmt}
                  onChange={(e) => setSelectedTargetFmt(e.target.value as FileFormat)}
                  className="bg-transparent text-xs font-bold text-[#F5FAFF] outline-none text-center cursor-pointer"
                >
                  <option value="docx" className="bg-[#0B1420] text-white">DOCX</option>
                  <option value="pdf" className="bg-[#0B1420] text-white">PDF</option>
                  <option value="txt" className="bg-[#0B1420] text-white">TXT</option>
                  <option value="html" className="bg-[#0B1420] text-white">HTML</option>
                  <option value="csv" className="bg-[#0B1420] text-white">CSV</option>
                  <option value="xlsx" className="bg-[#0B1420] text-white">XLSX</option>
                  <option value="png" className="bg-[#0B1420] text-white">PNG</option>
                </select>
              </div>
            </div>
          </div>

          {/* Large Convert Now Button (Reference Style) */}
          <button
            onClick={handleQuickConvertNow}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#38BDF8] to-[#38BDF8] hover:from-[#FF6688] hover:to-[#5CE0F0] text-[#070B13] font-black text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-xl shadow-[#38BDF8]/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
          >
            <span>Convert Now</span>
            <ArrowRight className="w-4 h-4 text-[#070B13]" />
          </button>
        </div>

        {/* Panel 3 (4 cols): Conversion Queue (Reference Style) */}
        <div className="lg:col-span-4 rounded-3xl p-6 glass-card border border-white/10 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <h2 className="text-sm font-bold text-[#F5FAFF]">Conversion Queue</h2>
            <button
              onClick={() => {
                const el = document.getElementById('full-queue-table');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-xs text-[#38BDF8] hover:text-[#38BDF8] font-semibold flex items-center gap-1 transition-colors"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Queue Items matching reference (Annual_Report.pdf, Design.png, Budget.xlsx) */}
          <div className="space-y-3 my-2">
            {jobs.length > 0 ? (
              jobs.slice(0, 3).map((job) => (
                <div key={job.id} className="p-2.5 rounded-xl glass-input space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#F5FAFF] truncate max-w-[150px]">
                      {job.sourceFile.name}
                    </span>
                    <span className="text-[10px] text-[#38BDF8] font-bold">
                      {job.status === 'processing'
                        ? `Converting... ${job.progress}%`
                        : job.status === 'completed'
                        ? 'Completed'
                        : job.status === 'cancelled'
                        ? 'Cancelled'
                        : job.status === 'error'
                        ? 'Failed'
                        : 'Queued'}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        job.status === 'completed'
                          ? 'bg-emerald-400 w-full'
                          : 'bg-gradient-to-r from-[#38BDF8] to-[#38BDF8]'
                      }`}
                      style={{ width: `${job.status === 'completed' ? 100 : job.progress}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              /* High fidelity demo items matching the reference screenshot */
              <>
                <div className="p-2.5 rounded-xl glass-input space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#F5FAFF] truncate max-w-[160px]">Annual_Report.pdf</span>
                    <span className="text-[10px] text-[#38BDF8] font-bold">Converting... 68%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#38BDF8] to-[#38BDF8] rounded-full w-[68%] animate-shimmer" />
                  </div>
                </div>

                <div className="p-2.5 rounded-xl glass-input flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#A7B8CA]" />
                    <span className="font-medium text-[#F5FAFF]">Design.png</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#A7B8CA] font-bold">Queued</span>
                </div>

                <div className="p-2.5 rounded-xl glass-input flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-medium text-[#F5FAFF]">Budget.xlsx</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">Completed</span>
                </div>
              </>
            )}
          </div>

          <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-[#A7B8CA]">
            <span>Active Queue: {jobs.length} files</span>
            {completedCount > 0 && (
              <button
                onClick={handleDownloadAllZip}
                className="text-[#38BDF8] font-bold hover:underline"
              >
                Download All ({completedCount})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. DETAILED JOBS QUEUE LIST & OPTIONS                                    */}
      {/* ========================================================================= */}
      {jobs.length > 0 && (
        <div id="full-queue-table" className="glass-panel p-5 rounded-3xl border border-white/10 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <h3 className="text-sm font-bold text-[#F5FAFF]">Active Conversion Jobs ({jobs.length})</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleConvertAll}
                disabled={isProcessingAll || jobs.every((j) => j.status === 'completed')}
                className="px-3 py-1.5 rounded-xl glass-btn-primary text-xs font-bold disabled:opacity-50"
              >
                Convert All
              </button>
              <button
                onClick={() => setJobs([])}
                className="p-1.5 rounded-xl text-[#A7B8CA] hover:text-rose-400 glass-card"
                title="Clear queue"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="p-3 rounded-2xl glass-card flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white"
                    style={{ backgroundColor: FORMAT_REGISTRY[job.sourceFormat]?.color || '#38BDF8' }}
                  >
                    {job.sourceFormat.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#F5FAFF] truncate max-w-xs">{job.sourceFile.name}</div>
                    <div className="text-[11px] text-[#A7B8CA]">{formatFileSize(job.sourceFile.size)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#A7B8CA]">Target:</span>
                  <select
                    value={job.targetFormat}
                    onChange={(e) => handleTargetFormatChange(job.id, e.target.value as FileFormat)}
                    disabled={job.status === 'processing'}
                    className="glass-input rounded-xl px-2 py-1 text-xs font-bold text-[#F5FAFF] uppercase bg-[#0B1420]"
                  >
                    {(FORMAT_REGISTRY[job.sourceFormat]?.allowedConversions || ['pdf', 'txt']).map((fmt) => (
                      <option key={fmt} value={fmt} className="bg-[#0B1420] text-white">
                        .{fmt.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  {job.status === 'completed' && (
                    <>
                      <button
                        onClick={() => handlePreview(job)}
                        className="p-1.5 rounded-xl glass-card text-[#A7B8CA] hover:text-white"
                        title="Preview"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDownloadSingle(job)}
                        className="px-3 py-1.5 rounded-xl glass-btn-primary text-xs font-bold flex items-center gap-1"
                      >
                        <DownloadCloud className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    </>
                  )}

                  {job.status === 'processing' && (
                    <button
                      onClick={() => cancelConversion(job.id)}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  )}

                  {(job.status === 'queued' || job.status === 'cancelled' || job.status === 'error') && (
                    <button
                      onClick={() => runConversion(job.id)}
                      className="px-3 py-1.5 rounded-xl glass-btn-primary text-xs font-bold flex items-center gap-1"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{job.status === 'cancelled' || job.status === 'error' ? 'Retry' : 'Convert'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      cancelConversion(job.id);
                      setJobs((prev) => prev.filter((j) => j.id !== job.id));
                    }}
                    className="p-1.5 rounded-xl text-[#A7B8CA] hover:text-rose-400 glass-card"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compatibility Matrix Modal */}
      {showMatrixModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel border-white/15 rounded-3xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl text-[#F5FAFF]">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Grid className="w-5 h-5 text-[#38BDF8]" />
                <div>
                  <h3 className="text-base font-bold text-[#F5FAFF]">Universal Conversion Compatibility Matrix</h3>
                  <p className="text-xs text-[#A7B8CA]">Native browser conversion matrix with zero server bottlenecks.</p>
                </div>
              </div>
              <button
                onClick={() => setShowMatrixModal(false)}
                className="p-1.5 rounded-xl glass-card text-[#A7B8CA] hover:text-[#F5FAFF]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5 custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[#A7B8CA]">
                    <th className="py-2.5 px-3 uppercase tracking-wider font-semibold">Format</th>
                    <th className="py-2.5 px-3 uppercase tracking-wider font-semibold">Category</th>
                    <th className="py-2.5 px-3 uppercase tracking-wider font-semibold">Supported Targets</th>
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
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                          <span className="text-[#F5FAFF] uppercase">.{fmt}</span>
                        </td>
                        <td className="py-2.5 px-3 text-[#A7B8CA] capitalize">{meta.category}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {meta.allowedConversions.map((tgt) => (
                              <span
                                key={tgt}
                                className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-mono font-semibold text-[#38BDF8]"
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

            <div className="p-4 border-t border-white/10 bg-[#070B13]/50 flex justify-end">
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
          <div className="glass-panel border-white/15 rounded-3xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl text-[#F5FAFF]">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F5FAFF] truncate">{previewBlob.name}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => saveAs(previewBlob.url, previewBlob.name)}
                  className="px-3.5 py-1.5 rounded-xl glass-btn-primary text-xs font-semibold shadow-md shadow-[#38BDF8]/20"
                >
                  Download
                </button>
                <button
                  onClick={() => {
                    URL.revokeObjectURL(previewBlob.url);
                    setPreviewBlob(null);
                  }}
                  className="px-3 py-1.5 rounded-xl glass-card text-[#A7B8CA] hover:text-[#F5FAFF] text-xs"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-[#070B13]/80">
              {previewBlob.type.startsWith('image/') ? (
                <img src={previewBlob.url} alt="Preview" className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-2xl" />
              ) : previewBlob.type === 'application/pdf' ? (
                <iframe src={previewBlob.url} className="w-full h-[65vh] rounded-xl border border-white/10" title="PDF preview" />
              ) : (
                <div className="text-center p-8 text-[#A7B8CA] space-y-2">
                  <FileCode className="w-10 h-10 mx-auto text-[#38BDF8] opacity-60" />
                  <p className="text-sm text-[#F5FAFF] font-semibold">Preview generated for this file format.</p>
                  <p className="text-xs text-[#A7B8CA] mt-1">Download to view and edit in your native application.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
