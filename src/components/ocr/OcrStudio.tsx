import React, { useState } from 'react';
import { 
  ScanText, 
  Upload, 
  Copy, 
  Check, 
  DownloadCloud, 
  Loader2, 
  Sparkles, 
  PenTool, 
  Clock, 
  Gauge, 
  FileCheck,
  FileText
} from 'lucide-react';
import { OCRResult } from '../../types';
import { performOcr } from '../../services/ocrService';
import { createDocxBlob, convertTextOrDocxToPdf } from '../../services/docxService';
import saveAs from 'file-saver';
import confetti from 'canvas-confetti';

interface OcrStudioProps {
  onSendToWordEditor?: (text: string, title: string) => void;
}

export const OcrStudio: React.FC<OcrStudioProps> = ({
  onSendToWordEditor,
}) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('eng');
  const [isRecognizing, setIsRecognizing] = useState<boolean>(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [progressPct, setProgressPct] = useState<number>(0);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [editableText, setEditableText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const handleSelectImage = (file: File) => {
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setOcrResult(null);
    setEditableText('');
  };

  const handleRunOcr = async () => {
    if (!imageFile) return;

    setIsRecognizing(true);
    setProgressStatus('Initializing OCR engine...');
    setProgressPct(5);

    try {
      const res = await performOcr(imageFile, selectedLanguage, (status, pct) => {
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
    saveAs(blob, `${imageFile?.name.replace(/\.[^/.]+$/, '')}_ocr.txt`);
  };

  const handleExportDocx = async () => {
    const paragraphs = editableText.split('\n\n').filter(Boolean).map((p) => ({
      type: 'paragraph' as const,
      text: p,
    }));
    const blob = await createDocxBlob('OCR Scanned Document', paragraphs);
    saveAs(blob, `${imageFile?.name.replace(/\.[^/.]+$/, '')}_ocr.docx`);
  };

  const handleExportPdf = async () => {
    const pdfBytes = await convertTextOrDocxToPdf('OCR Scanned Document', editableText);
    const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
    saveAs(blob, `${imageFile?.name.replace(/\.[^/.]+$/, '')}_searchable.pdf`);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      {/* Top Header */}
      <div className="h-14 border-b border-slate-800 bg-slate-900/90 px-4 flex items-center justify-between shrink-0 gap-3 overflow-x-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ScanText className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-white tracking-tight">OCR Document Scanner</h2>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30">
            TESSERACT AI
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Language:</span>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 cursor-pointer font-semibold"
            >
              <option value="eng">English</option>
              <option value="spa">Spanish (Español)</option>
              <option value="fra">French (Français)</option>
              <option value="deu">German (Deutsch)</option>
              <option value="ita">Italian (Italiano)</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Select Image / Scan</span>
            <input
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleSelectImage(e.target.files[0])}
            />
          </label>

          <button
            onClick={handleRunOcr}
            disabled={!imageFile || isRecognizing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-semibold shadow-md shadow-cyan-600/30 cursor-pointer"
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
        {/* Left: Original Scanned Image */}
        <div className="w-full md:w-1/2 border-r border-slate-800 bg-slate-900/30 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Original Scanned Source</span>
            {imageFile && <span className="text-[10px] text-slate-500 font-mono">{imageFile.name}</span>}
          </div>

          <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950">
            {imagePreviewUrl ? (
              <img
                src={imagePreviewUrl}
                alt="Source scan"
                className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-xl border border-slate-800"
              />
            ) : (
              <div className="text-center py-16 space-y-3 max-w-xs">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <ScanText className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-200">No Image Uploaded</h4>
                <p className="text-xs text-slate-500">
                  Upload a photo of a document, certificate, invoice, receipt, or scanned note to extract editable text.
                </p>
                <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleSelectImage(e.target.files[0])}
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Right: Recognized Text & Proofreader */}
        <div className="w-full md:w-1/2 flex flex-col bg-slate-950 overflow-hidden">
          <div className="p-3 border-b border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between bg-slate-900/60">
            <div className="flex items-center gap-2">
              <span>Recognized Text</span>
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
                        imageFile?.name.replace(/\.[^/.]+$/, '') || 'OCR Document'
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

          {/* Recognition Progress Bar */}
          {isRecognizing && (
            <div className="p-4 bg-cyan-950/30 border-b border-cyan-800/40 space-y-2">
              <div className="flex items-center justify-between text-xs text-cyan-300">
                <span className="font-semibold">{progressStatus}...</span>
                <span className="font-mono">{progressPct}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-all duration-200"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Editable text area for manual proofreading */}
          <div className="flex-1 p-4 overflow-y-auto">
            {editableText ? (
              <textarea
                value={editableText}
                onChange={(e) => setEditableText(e.target.value)}
                className="w-full h-full bg-transparent text-slate-100 font-mono text-xs md:text-sm leading-relaxed outline-none resize-none"
                placeholder="OCR recognized text will appear here..."
              />
            ) : (
              <div className="text-center py-20 text-slate-600 text-xs">
                Run OCR scan to extract words, paragraphs, and tables into editable text.
              </div>
            )}
          </div>

          {/* Bottom stats footer */}
          {ocrResult && (
            <div className="p-3 border-t border-slate-800/80 bg-slate-900/40 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                {ocrResult.wordsCount} words extracted
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Processed in {ocrResult.processingTimeMs} ms
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
