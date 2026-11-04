import React, { useState, useRef } from 'react';
import { ForensicsReport, ForensicsFinding } from '../../types';
import { inspectDocumentForensics } from '../../services/forensicsService';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  FileSearch,
  Upload,
  Download,
  X,
  Lock,
  Binary,
  Layers,
  Info
} from 'lucide-react';
import { saveAs } from 'file-saver';

interface DocumentForensicsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultFile?: File | null;
}

export const DocumentForensicsModal: React.FC<DocumentForensicsModalProps> = ({
  isOpen,
  onClose,
  defaultFile,
}) => {
  const [file, setFile] = useState<File | null>(defaultFile || null);
  const [report, setReport] = useState<ForensicsReport | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (defaultFile && isOpen) {
      setFile(defaultFile);
      handleScan(defaultFile);
    }
  }, [defaultFile, isOpen]);

  if (!isOpen) return null;

  const handleScan = async (selected: File) => {
    setIsScanning(true);
    try {
      const rep = await inspectDocumentForensics(selected);
      setReport(rep);
    } catch (err) {
      console.error('Forensics scan failed:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      handleScan(selected);
    }
  };

  const handleExportJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    saveAs(blob, `forensics-report-${report.fileName}.json`);
  };

  const getRiskBadge = (risk: 'LOW' | 'MEDIUM' | 'HIGH') => {
    switch (risk) {
      case 'HIGH':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-500/20 text-red-400 border border-red-500/40">
            <ShieldAlert className="w-4 h-4" />
            HIGH RISK
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-400 border border-amber-500/40">
            <AlertTriangle className="w-4 h-4" />
            ELEVATED RISK
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <ShieldCheck className="w-4 h-4" />
            CLEAN / LOW RISK
          </span>
        );
    }
  };

  const getSeverityPill = (level: ForensicsFinding['level']) => {
    switch (level) {
      case 'HIGH_RISK':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">CRITICAL</span>;
      case 'WARNING':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">WARNING</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">INFO</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100 select-none">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Binary className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base text-white tracking-tight">
                  Document Forensics &amp; Threat Lab
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                  DEEP SCAN
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Inspect binary headers, weaponized macros, MIME-spoofing, and metadata leakage
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* File Picker Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
            <div className="flex items-center gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Document to Inspect</span>
              </button>

              <span className="text-xs text-slate-400 font-medium">
                {file ? file.name : 'No document selected'}
              </span>
            </div>

            {report && (
              <div className="flex items-center gap-3">
                {getRiskBadge(report.overallRisk)}
                <button
                  onClick={handleExportJson}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>
              </div>
            )}
          </div>

          {isScanning && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium">Executing deep binary forensics analysis...</p>
            </div>
          )}

          {!isScanning && report && (
            <>
              {/* File Diagnostics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
                  <div className="text-[11px] text-slate-400">Declared vs Actual</div>
                  <div className="font-mono text-xs font-bold text-white mt-1">
                    .{report.declaredExtension} → {report.actualFormat?.toUpperCase() || 'UNKNOWN'}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
                  <div className="text-[11px] text-slate-400">File Size</div>
                  <div className="font-mono text-xs font-bold text-white mt-1">
                    {(report.fileSizeBytes / 1024).toFixed(1)} KB
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
                  <div className="text-[11px] text-slate-400">Embedded Resources</div>
                  <div className="font-mono text-xs font-bold text-white mt-1">
                    {report.embeddedResourcesCount} items
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
                  <div className="text-[11px] text-slate-400">SHA-256 Checksum</div>
                  <div className="font-mono text-[10px] text-amber-300 mt-1 truncate" title={report.sha256}>
                    {report.sha256.slice(0, 16)}...
                  </div>
                </div>
              </div>

              {/* Findings & Vulnerabilities */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <FileSearch className="w-4 h-4 text-amber-400" />
                  <span>Structural &amp; Security Findings ({report.findings.length})</span>
                </h3>

                {report.findings.length === 0 ? (
                  <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 text-xs">
                    No structural anomalies, active macros, or obfuscated payloads detected.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {report.findings.map((finding) => (
                      <div
                        key={finding.id}
                        className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getSeverityPill(finding.level)}
                            <span className="font-mono text-xs font-bold text-slate-200">
                              {finding.rule}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-300">{finding.description}</p>

                        {finding.technicalDetails && (
                          <div className="p-2 rounded bg-black/40 font-mono text-[10px] text-slate-400 select-text overflow-x-auto">
                            {finding.technicalDetails}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Metadata Exposure */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>Metadata Leakage Audit</span>
                </h3>

                {Object.keys(report.metadataSummary).length === 0 ? (
                  <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/40 text-xs text-slate-400">
                    No exposed author, corporate, or toolchain metadata identified.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {Object.entries(report.metadataSummary).map(([key, val]) => (
                      <div key={key} className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700 flex justify-between">
                        <span className="text-slate-400 capitalize">{key}:</span>
                        <span className="font-medium text-slate-200 truncate ml-2">{val}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {!isScanning && !report && (
            <div className="py-16 text-center text-slate-500 text-xs space-y-2">
              <Binary className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="font-bold text-slate-400">Select a document above to begin forensic threat screening.</p>
              <p className="text-slate-500">Supports PDF, DOCX, XLSX, PPTX, and binary document packages.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

