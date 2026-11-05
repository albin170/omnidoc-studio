import React, { useState, useEffect, useRef } from 'react';
import { 
  ScanText, 
  Upload, 
  Copy, 
  Check, 
  Loader2, 
  Sparkles, 
  PenTool, 
  Clock, 
  Gauge, 
  FileText,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { OCRResult } from '../../types';
import { performOcr, renderPdfPageToCanvas } from '../../services/ocrService';
import { createDocxBlob, convertTextOrDocxToPdf } from '../../services/docxService';
import saveAs from 'file-saver';
import confetti from 'canvas-confetti';

interface OcrStudioProps {
  onSendToWordEditor?: (text: string, title: string) => void;
}

export const OcrStudio: React.FC<OcrStudioProps> = ({
  onSendToWordEditor,
}) => {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState<boolean>(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfPageCount, setPdfPageCount] = useState<number>(0);
  const [currentPdfPage, setCurrentPdfPage] = useState<number>(1);

  const [selectedLanguage, setSelectedLanguage] = useState<string>('eng');
  const [isRecognizing, setIsRecognizing] = useState<boolean>(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [progressPct, setProgressPct] = useState<number>(0);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [editableText, setEditableText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);

  const handleSelectFile = async (file: File) => {
    setSourceFile(file);
    setOcrResult(null);
    setEditableText('');

    const isPdfFile = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    setIsPdf(isPdfFile);

    if (isPdfFile) {
      setImagePreviewUrl(null);
      try {
        const buffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: buffer });
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setPdfPageCount(doc.numPages);
        setCurrentPdfPage(1);
      } catch (err) {
        console.error('Failed to load PDF preview:', err);
      }
    } else {
      setPdfDoc(null);
      setPdfPageCount(0);
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  };

  // Render PDF page whenever pdfDoc or currentPdfPage changes
  useEffect(() => {
    if (!isPdf || !pdfDoc || !pdfCanvasRef.current) return;

    let isMounted = true;
    (async () => {
      try {
        const tempCanvas = await renderPdfPageToCanvas(pdfDoc, currentPdfPage, 1.3);
        if (!isMounted || !pdfCanvasRef.current) return;
        const targetCanvas = pdfCanvasRef.current;
        targetCanvas.width = tempCanvas.width;
        targetCanvas.height = tempCanvas.height;
        const ctx = targetCanvas.getContext('2d')!;
        ctx.drawImage(tempCanvas, 0, 0);
      } catch (e) {
        console.error('Render PDF page error:', e);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isPdf, pdfDoc, currentPdfPage]);

  const handleRunOcr = async () => {
    if (!sourceFile) return;

    setIsRecognizing(true);
    setProgressStatus('Initializing OCR engine...');
    setProgressPct(5);

    try {
      const res = await performOcr(sourceFile, selectedLanguage, (status, pct) => {
        setProgressStatus(status);
        setProgressPct(pct);
      });

      setOcrResult(res);
      setEditableText(res.text);
      confetti({ particleCount: 35, spread: 60 });
    } catch (err: any) {
      console.error('OCR Error:', err);
      alert('OCR extraction failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsRecognizing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editableText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportTxt = () => {
    const blob = new Blob([editableText], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `${sourceFile?.name.replace(/\.[^/.]+$/, '')}_ocr.txt`);
  };

  const handleExportDocx = async () => {
    const paragraphs = editableText.split('\n\n').filter(Boolean).map((p) => ({
      type: 'paragraph' as const,
      text: p,
    }));
    const blob = await createDocxBlob('OCR Scanned Document', paragraphs);
    saveAs(blob, `${sourceFile?.name.replace(/\.[^/.]+$/, '')}_ocr.docx`);
  };

  const handleExportPdf = async () => {
    const pdfBytes = await convertTextOrDocxToPdf('OCR Scanned Document', editableText);
    const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
    saveAs(blob, `${sourceFile?.name.replace(/\.[^/.]+$/, '')}_searchable.pdf`);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#080B18]/60 text-[#F4F5FF]">
      {/* Top Header */}
      <div className="h-14 border-b border-white/10 bg-[#11152A]/85 backdrop-blur-2xl px-4 flex items-center justify-between shrink-0 gap-3 overflow-x-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ScanText className="w-5 h-5 text-[#42D6E8]" />
            <h2 className="text-sm font-bold text-[#F4F5FF] tracking-tight">OCR Document Scanner</h2>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#42D6E8]/20 text-[#42D6E8] font-semibold border border-[#42D6E8]/30">
            TESSERACT AI · PDF &amp; IMAGES
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-[#9BA3BD]">
            <span>Language:</span>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="glass-input rounded-xl px-2.5 py-1 text-[#F4F5FF] cursor-pointer font-semibold outline-none"
            >
              <option value="eng" className="bg-[#11152A] text-white">English</option>
              <option value="spa" className="bg-[#11152A] text-white">Spanish (Español)</option>
              <option value="fra" className="bg-[#11152A] text-white">French (Français)</option>
              <option value="deu" className="bg-[#11152A] text-white">German (Deutsch)</option>
              <option value="ita" className="bg-[#11152A] text-white">Italian (Italiano)</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card hover:border-[#42D6E8]/50 text-[#F4F5FF] text-xs font-semibold cursor-pointer transition-all">
            <Upload className="w-3.5 h-3.5 text-[#42D6E8]" />
            <span>Select PDF / Image</span>
            <input
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleSelectFile(e.target.files[0])}
            />
          </label>

          <button
            onClick={handleRunOcr}
            disabled={!sourceFile || isRecognizing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl glass-btn-primary disabled:opacity-40 text-xs font-semibold shadow-lg shadow-[#8B7CFF]/20 cursor-pointer"
          >
            {isRecognizing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Scan Document</span>
          </button>
        </div>
      </div>

      {/* Main OCR Split Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left: Original Scanned Image or PDF */}
        <div className="w-full md:w-1/2 border-r border-white/10 bg-[#11152A]/30 backdrop-blur-xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/10 text-xs font-bold text-[#9BA3BD] uppercase tracking-wider flex items-center justify-between">
            <span>Original Scanned Source</span>
            {sourceFile && (
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-[#9BA3BD] font-mono truncate max-w-[150px]">{sourceFile.name}</span>
                {isPdf && pdfPageCount > 1 && (
                  <div className="flex items-center gap-1 text-[11px] text-[#F4F5FF] font-normal">
                    <button
                      onClick={() => setCurrentPdfPage((p) => Math.max(1, p - 1))}
                      disabled={currentPdfPage <= 1}
                      className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono">{currentPdfPage} / {pdfPageCount}</span>
                    <button
                      onClick={() => setCurrentPdfPage((p) => Math.min(pdfPageCount, p + 1))}
                      disabled={currentPdfPage >= pdfPageCount}
                      className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30"
                      title="Next Page"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-[#080B18]/50 custom-scrollbar">
            {isPdf ? (
              <canvas
                ref={pdfCanvasRef}
                className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-2xl border border-white/15"
              />
            ) : imagePreviewUrl ? (
              <img
                src={imagePreviewUrl}
                alt="Source scan"
                className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-2xl border border-white/15"
              />
            ) : (
              <div className="text-center py-16 space-y-3 max-w-xs">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#42D6E8]/15 border border-[#42D6E8]/30 flex items-center justify-center text-[#42D6E8] glow-cyan">
                  <ScanText className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-[#F4F5FF]">No Document Uploaded</h4>
                <p className="text-xs text-[#9BA3BD]">
                  Upload a scanned PDF, document photo, certificate, invoice, receipt, or image note to extract editable text.
                </p>
                <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl glass-btn-primary text-xs font-semibold cursor-pointer shadow-md shadow-[#8B7CFF]/20">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose PDF / Image</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleSelectFile(e.target.files[0])}
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Right: Recognized Text & Proofreader */}
        <div className="w-full md:w-1/2 flex flex-col bg-[#080B18]/60 overflow-hidden">
          <div className="p-3 border-b border-white/10 text-xs font-bold text-[#9BA3BD] uppercase tracking-wider flex items-center justify-between bg-[#11152A]/50 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <span className="text-[#F4F5FF]">Recognized Text</span>
              {ocrResult && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                  {ocrResult.confidence}% confidence
                </span>
              )}
            </div>

            {/* Export Toolbar */}
            {editableText && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 cursor-pointer"
                  title="Copy text"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>

                {onSendToWordEditor && (
                  <button
                    onClick={() =>
                      onSendToWordEditor(
                        editableText,
                        sourceFile?.name.replace(/\.[^/.]+$/, '') || 'OCR Document'
                      )
                    }
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 text-xs flex items-center gap-1 cursor-pointer"
                    title="Send into Word Document Editor"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>Open in Word</span>
                  </button>
                )}

                <button
                  onClick={handleExportTxt}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                  title="Download as TXT"
                >
                  TXT
                </button>

                <button
                  onClick={handleExportDocx}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs cursor-pointer"
                  title="Download as DOCX"
                >
                  DOCX
                </button>

                <button
                  onClick={handleExportPdf}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-red-300 text-xs cursor-pointer"
                  title="Download as Searchable PDF"
                >
                  PDF
                </button>
              </div>
            )}
          </div>

          {/* Progress Banner */}
          {isRecognizing && (
            <div className="p-4 bg-cyan-950/30 border-b border-cyan-800/40 space-y-2">
              <div className="flex justify-between text-xs text-cyan-300">
                <span className="font-semibold">{progressStatus || 'Processing OCR recognition...'}</span>
                <span className="font-mono">{progressPct}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Text Editor Area */}
          <div className="flex-1 p-4 flex flex-col overflow-hidden">
            <textarea
              value={editableText}
              onChange={(e) => setEditableText(e.target.value)}
              placeholder="OCR extracted text will appear here. You can directly edit, fix errors, or export to DOCX/PDF/TXT."
              className="w-full flex-1 bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 text-slate-100 font-sans text-sm leading-relaxed outline-none focus:border-cyan-500/60 resize-none font-mono"
            />
          </div>

          {/* Footer Metrics */}
          {ocrResult && (
            <div className="h-10 border-t border-slate-800 bg-slate-900/60 px-4 flex items-center justify-between text-[11px] text-slate-400 font-mono shrink-0">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  {ocrResult.wordsCount} words
                </span>
                <span className="flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                  {ocrResult.confidence}% confidence
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  {ocrResult.processingTimeMs}ms
                </span>
              </div>
              <span className="text-slate-500 uppercase">{ocrResult.language} MODEL</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
