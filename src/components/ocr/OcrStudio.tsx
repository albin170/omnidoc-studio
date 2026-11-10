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
  const [editableText, setEditableText] = useState<string>(
    'Turn images into editable text with advanced OCR technology.\n\nOmniDoc Studio extracts layout-preserved paragraphs, tables, and structural elements from documents and photos with near-instant client-side processing.'
  );
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#070B13]/60 text-[#F5FAFF]">
      {/* Top Header */}
      <div className="h-14 border-b border-white/10 bg-[#0B1420]/85 backdrop-blur-2xl px-4 flex items-center justify-between shrink-0 gap-3 overflow-x-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ScanText className="w-5 h-5 text-[#A8DEFA]" />
            <h2 className="text-sm font-bold text-[#F5FAFF] tracking-tight">OCR Document Scanner</h2>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#A8DEFA]/20 text-[#A8DEFA] font-semibold border border-[#A8DEFA]/30">
            TESSERACT AI · PDF &amp; IMAGES
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-[#A7B8CA]">
            <span>Language:</span>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="glass-input rounded-xl px-2.5 py-1 text-[#F5FAFF] cursor-pointer font-semibold outline-none"
            >
              <option value="eng" className="bg-[#0B1420] text-white">English</option>
              <option value="spa" className="bg-[#0B1420] text-white">Spanish (Español)</option>
              <option value="fra" className="bg-[#0B1420] text-white">French (Français)</option>
              <option value="deu" className="bg-[#0B1420] text-white">German (Deutsch)</option>
              <option value="ita" className="bg-[#0B1420] text-white">Italian (Italiano)</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card hover:border-[#A8DEFA]/50 text-[#F5FAFF] text-xs font-semibold cursor-pointer transition-all">
            <Upload className="w-3.5 h-3.5 text-[#A8DEFA]" />
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
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl glass-btn-primary disabled:opacity-40 text-xs font-semibold shadow-lg shadow-[#A8DEFA]/20 cursor-pointer"
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
      <div className="flex-1 p-6 md:p-8 flex flex-col md:flex-row gap-6 items-stretch justify-center max-w-7xl mx-auto w-full overflow-hidden select-none">
        {/* Left Card: Upload Document */}
        <label
          className="w-full md:w-1/2 rounded-3xl glass-panel border border-white/15 p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#A8DEFA]/50 transition-all group min-h-[380px] shadow-2xl relative overflow-hidden"
        >
          <input
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleSelectFile(e.target.files[0])}
          />

          {sourceFile && (imagePreviewUrl || isPdf) ? (
            <div className="flex flex-col items-center gap-3 w-full h-full justify-center">
              {isPdf ? (
                <canvas
                  ref={pdfCanvasRef}
                  className="max-h-56 object-contain rounded-xl border border-white/15 shadow-lg"
                />
              ) : (
                <img
                  src={imagePreviewUrl!}
                  alt="Scanned Preview"
                  className="max-h-56 object-contain rounded-xl border border-white/15 shadow-lg"
                />
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-[#F5FAFF] font-semibold truncate max-w-xs">{sourceFile.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  Ready
                </span>
              </div>
              <span className="text-[11px] text-[#A8DEFA] font-semibold underline mt-1">Change File</span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-[#A8DEFA]/10 border border-[#A8DEFA]/30 flex items-center justify-center text-[#A8DEFA] shadow-lg shadow-[#A8DEFA]/15 group-hover:scale-105 transition-all mb-4">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-[#F5FAFF]">Upload Document</h3>
              <p className="text-xs text-[#A7B8CA] mt-1">or drag and drop</p>
              <span className="text-[11px] text-[#A7B8CA]/70 mt-6 font-medium">Supports: JPG, PNG, PDF</span>
            </div>
          )}
        </label>

        {/* Right Card: Extracted Text */}
        <div className="w-full md:w-1/2 rounded-3xl glass-panel border border-white/15 p-6 flex flex-col justify-between min-h-[380px] shadow-2xl">
          <div className="flex flex-col flex-1 min-h-0">
            <div className="pb-3 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#F5FAFF] tracking-tight">Extracted Text</h3>
                <p className="text-xs text-[#A7B8CA] mt-0.5">
                  Turn images into editable text with advanced OCR technology...
                </p>
              </div>

              {/* Word Export Shortcut */}
              {onSendToWordEditor && editableText && (
                <button
                  onClick={() =>
                    onSendToWordEditor(
                      editableText,
                      sourceFile?.name.replace(/\.[^/.]+$/, '') || 'OCR Document'
                    )
                  }
                  className="p-1.5 rounded-xl glass-card text-[#A8DEFA] hover:border-[#A8DEFA]/50 text-xs flex items-center gap-1 cursor-pointer transition-all"
                  title="Open in Word Studio"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Word</span>
                </button>
              )}
            </div>

            {/* Editable Text Area */}
            <div className="flex-1 py-3 min-h-[180px] flex flex-col">
              <textarea
                value={editableText}
                onChange={(e) => setEditableText(e.target.value)}
                placeholder="OCR extracted text will appear here..."
                className="w-full flex-1 bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-[#F5FAFF] font-sans text-xs md:text-sm leading-relaxed outline-none focus:border-[#A8DEFA]/50 resize-none custom-scrollbar"
              />
            </div>
          </div>

          {/* Card Footer Bar */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold text-xs border border-emerald-500/30">
              <Check className="w-3.5 h-3.5" />
              <span>{ocrResult?.confidence || 98}% Confidence</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#A8DEFA] to-[#7CC4ED] hover:brightness-110 text-white text-xs font-semibold shadow-lg shadow-[#A8DEFA]/30 cursor-pointer transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
