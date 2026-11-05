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
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#8B7CFF]/20 text-[#8B7CFF] border border-[#8B7CFF]/30">INFO</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080B18]/80 backdrop-blur-xl animate-fadeIn">
      <div className="w-full max-w-4xl max-h-[90vh] glass-panel border-white/15 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-[#F4F5FF] select-none">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Binary className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base text-[#F4F5FF] tracking-tight">
                  Document Forensics &amp; Threat Lab
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  DEEP SCAN
                </span>
              </div>
              <p className="text-xs text-[#9BA3BD]">
                Inspect binary headers, weaponized macros, MIME-spoofing, and metadata leakage
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* File Picker Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
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
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#080B18] font-extrabold text-xs transition-colors cursor-pointer shadow-md shadow-amber-500/20"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Document to Inspect</span>
              </button>

              <span className="text-xs text-[#9BA3BD] font-medium">
                {file ? file.name : 'No document selected'}
              </span>
            </div>

            {report && (
              <div className="flex items-center gap-3">
                {getRiskBadge(report.overallRisk)}
                <button
                  onClick={handleExportJson}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-[#F4F5FF] border border-white/15 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>
              </div>
            )}
          </div>

          {isScanning && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-[#9BA3BD]">
              <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium">Executing deep binary forensics analysis...</p>
            </div>
          )}

          {!isScanning && report && (
            <>
              {/* File Diagnostics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                  <div className="text-[11px] text-[#9BA3BD]">Declared vs Actual</div>
                  <div className="font-mono text-xs font-bold text-[#F4F5FF] mt-1">
                    .{report.declaredExtension} → {report.actualFormat?.toUpperCase() || 'UNKNOWN'}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                  <div className="text-[11px] text-[#9BA3BD]">File Size</div>
                  <div className="font-mono text-xs font-bold text-[#F4F5FF] mt-1">
                    {(report.fileSizeBytes / 1024).toFixed(1)} KB
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                  <div className="text-[11px] text-[#9BA3BD]">Embedded Resources</div>
                  <div className="font-mono text-xs font-bold text-[#F4F5FF] mt-1">
                    {report.embeddedResourcesCount} items
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                  <div className="text-[11px] text-[#9BA3BD]">SHA-256 Checksum</div>
                  <div className="font-mono text-[10px] text-amber-300 mt-1 truncate" title={report.sha256}>
                    {report.sha256.slice(0, 16)}...
                  </div>
                </div>
              </div>

              {/* Findings & Vulnerabilities */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#9BA3BD] uppercase tracking-wider flex items-center gap-2">
                  <FileSearch className="w-4 h-4 text-amber-400" />
                  <span>Structural &amp; Security Findings ({report.findings.length})</span>
                </h3>

                {report.findings.length === 0 ? (
                  <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-xs">
                    No structural anomalies, active macros, or obfuscated payloads detected.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {report.findings.map((finding) => (
                      <div
                        key={finding.id}
                        className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getSeverityPill(finding.level)}
                            <span className="font-mono text-xs font-bold text-[#F4F5FF]">
                              {finding.rule}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-[#9BA3BD]">{finding.description}</p>

                        {finding.technicalDetails && (
                          <div className="p-2 rounded bg-black/40 font-mono text-[10px] text-[#9BA3BD] select-text overflow-x-auto border border-white/5">
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
                <h3 className="text-xs font-bold text-[#9BA3BD] uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#8B7CFF]" />
                  <span>Metadata Leakage Audit</span>
                </h3>

                {Object.keys(report.metadataSummary).length === 0 ? (
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-[#9BA3BD]">
                    No exposed author, corporate, or toolchain metadata identified.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {Object.entries(report.metadataSummary).map(([key, val]) => (
                      <div key={key} className="p-2.5 rounded-lg bg-white/[0.03] border border-white/10 flex justify-between">
                        <span className="text-[#9BA3BD] capitalize">{key}:</span>
                        <span className="font-medium text-[#F4F5FF] truncate ml-2">{val}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {!isScanning && !report && (
            <div className="py-16 text-center text-[#9BA3BD] text-xs space-y-2">
              <Binary className="w-10 h-10 mx-auto text-[#9BA3BD]/40 mb-2" />
              <p className="font-bold text-[#F4F5FF]">Select a document above to begin forensic threat screening.</p>
              <p className="text-[#9BA3BD]">Supports PDF, DOCX, XLSX, PPTX, and binary document packages.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
