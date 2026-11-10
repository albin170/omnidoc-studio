import React, { useState, useRef, useMemo } from 'react';
import { LineageManifest, LineageFieldNode } from '../../types';
import {
  extractDocumentLineage,
  exportLineageManifestJson,
  exportLineageCsv
} from '../../services/lineageService';
import {
  GitCommit,
  Upload,
  Download,
  X,
  Search,
  Filter,
  AlertCircle,
  CheckCircle,
  FileText,
  Clock,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { saveAs } from 'file-saver';

interface DataLineageModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultFile?: File | null;
}

export const DataLineageModal: React.FC<DataLineageModalProps> = ({
  isOpen,
  onClose,
  defaultFile,
}) => {
  const [file, setFile] = useState<File | null>(defaultFile || null);
  const [manifest, setManifest] = useState<LineageManifest | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (defaultFile && isOpen) {
      setFile(defaultFile);
      handleExtract(defaultFile);
    }
  }, [defaultFile, isOpen]);

  const handleExtract = async (selected: File) => {
    setIsExtracting(true);
    try {
      const result = await extractDocumentLineage(selected, selected.name);
      setManifest(result);
    } catch (err) {
      console.error('Lineage extraction error:', err);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      handleExtract(selected);
    }
  };

  const handleExportJson = () => {
    if (!manifest) return;
    const jsonStr = exportLineageManifestJson(manifest);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    saveAs(blob, `lineage-manifest-${manifest.documentTitle}.json`);
  };

  const handleExportCsv = () => {
    if (!manifest) return;
    const csvStr = exportLineageCsv(manifest);
    const blob = new Blob([csvStr], { type: 'text/csv' });
    saveAs(blob, `lineage-data-${manifest.documentTitle}.csv`);
  };

  const filteredFields = useMemo(() => {
    if (!manifest) return [];
    return manifest.fields.filter((field) => {
      if (onlyFlagged && !field.isFlaggedForReview) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          field.fieldName.toLowerCase().includes(q) ||
          String(field.extractedValue).toLowerCase().includes(q) ||
          field.contextSnippet.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [manifest, searchQuery, onlyFlagged]);

  const flaggedCount = manifest?.fields.filter((f) => f.isFlaggedForReview).length || 0;
  const avgConfidence = manifest?.fields.length
    ? Math.round(
      (manifest.fields.reduce((acc, f) => acc + f.confidence, 0) / manifest.fields.length) * 100
    )
    : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070B13]/80 backdrop-blur-xl animate-fadeIn">
      <div className="w-full max-w-5xl max-h-[90vh] glass-panel border-white/15 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-[#F5FAFF] select-none">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#38BDF8]/15 border border-[#38BDF8]/30 text-[#38BDF8]">
              <GitCommit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base text-[#F5FAFF] tracking-tight">
                  Document Data Lineage &amp; Provenance
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30">
                  v2.1 TRACEABILITY
                </span>
              </div>
              <p className="text-xs text-[#A7B8CA]">
                Audit extracted business numbers, totals, and fields anchored with confidence metrics
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#A7B8CA] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action / Toolbar */}
        <div className="p-5 border-b border-white/10 bg-white/[0.02] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isExtracting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl glass-btn-primary text-white font-extrabold text-xs transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4 text-[#38BDF8]" />
              <span>Select Document</span>
            </button>
            <span className="text-xs text-[#A7B8CA] font-medium truncate max-w-[200px]">
              {file ? file.name : 'No document selected'}
            </span>
          </div>

          {manifest && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportJson}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-[#F5FAFF] border border-white/15 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Manifest JSON</span>
              </button>
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-[#F5FAFF] border border-white/15 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>Export CSV</span>
              </button>
            </div>
          )}
        </div>

        {/* Stats Strip */}
        {manifest && (
          <div className="px-6 py-3 bg-white/[0.02] border-b border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[#A7B8CA]">Extracted Fields:</span>
              <span className="ml-2 font-mono font-bold text-[#F5FAFF]">{manifest.fields.length}</span>
            </div>
            <div>
              <span className="text-[#A7B8CA]">Mean Confidence:</span>
              <span className="ml-2 font-mono font-bold text-[#38BDF8]">{avgConfidence}%</span>
            </div>
            <div>
              <span className="text-[#A7B8CA]">Flagged For Review:</span>
              <span className={`ml-2 font-mono font-bold ${flaggedCount > 0 ? 'text-amber-400' : 'text-[#A7B8CA]'}`}>
                {flaggedCount}
              </span>
            </div>
            <div className="truncate">
              <span className="text-[#A7B8CA]">Source Hash:</span>
              <span className="ml-2 font-mono text-[10px] text-[#A7B8CA]" title={manifest.documentHash}>
                {manifest.documentHash.slice(0, 10)}...
              </span>
            </div>
          </div>
        )}

        {/* Filter & Search Bar */}
        {manifest && (
          <div className="px-6 py-2.5 bg-white/[0.02] border-b border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 max-w-sm bg-white/[0.04] px-3 py-1.5 rounded-xl border border-white/15">
              <Search className="w-3.5 h-3.5 text-[#A7B8CA]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search extracted fields or values..."
                className="bg-transparent border-none text-xs text-[#F5FAFF] placeholder:text-[#A7B8CA]/50 outline-none w-full"
              />
            </div>

            <button
              onClick={() => setOnlyFlagged(!onlyFlagged)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${onlyFlagged
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-white/10 text-[#A7B8CA] border-white/15 hover:text-white'
                }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Flagged Items Only ({flaggedCount})</span>
            </button>
          </div>
        )}

        {/* Content Table / Cards */}
        <div className="flex-1 overflow-y-auto p-6">
          {isExtracting && (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-[#A7B8CA]">
              <div className="w-8 h-8 border-2 border-[#38BDF8] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium">Extracting field lineage and confidence scores...</p>
            </div>
          )}

          {!isExtracting && manifest && filteredFields.length === 0 && (
            <div className="py-16 text-center text-[#A7B8CA] text-xs">
              No lineage fields match your filter criteria.
            </div>
          )}

          {!isExtracting && manifest && filteredFields.length > 0 && (
            <div className="space-y-3">
              {filteredFields.map((field) => {
                const confPercent = Math.round(field.confidence * 100);
                let confColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
                if (confPercent < 70) {
                  confColor = 'text-red-400 bg-red-500/10 border-red-500/30';
                } else if (confPercent < 85) {
                  confColor = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
                }

                return (
                  <div
                    key={field.id}
                    className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#F5FAFF]">{field.fieldName}</span>
                        {field.pageNumber && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 text-[#A7B8CA] border border-white/10">
                            Page {field.pageNumber}
                          </span>
                        )}
                        {field.isFlaggedForReview && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            <AlertCircle className="w-3 h-3" />
                            REVIEW REQUIRED
                          </span>
                        )}
                      </div>

                      <div className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${confColor}`}>
                        Confidence: {confPercent}%
                      </div>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-[11px] text-[#A7B8CA]">Extracted Value:</span>
                      <span className="font-mono text-sm font-extrabold text-[#38BDF8] select-text">
                        {String(field.extractedValue)}
                      </span>
                    </div>

                    {/* Context Snippet */}
                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 font-mono text-[11px] text-[#F5FAFF] select-text leading-relaxed">
                      {field.contextSnippet}
                    </div>

                    {/* Transformation Pipeline */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-[#A7B8CA]">
                      <span className="text-[#A7B8CA]">Transformations:</span>
                      {field.transformations.map((t, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-white/10 text-[#F5FAFF] font-mono">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!isExtracting && !manifest && (
            <div className="py-16 text-center text-[#A7B8CA] text-xs space-y-2">
              <GitCommit className="w-10 h-10 mx-auto text-[#A7B8CA]/40 mb-2" />
              <p className="font-bold text-[#F5FAFF]">Select or drop a document to inspect its data provenance.</p>
              <p className="text-[#A7B8CA]">Extracts totals, dates, IDs, and rates with verifiable confidence scoring.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
