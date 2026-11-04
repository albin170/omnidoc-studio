import React, { useEffect, useRef, useState } from 'react';
import { 
  FileText, 
  Upload, 
  RotateCw, 
  Trash2, 
  Copy, 
  DownloadCloud, 
  Type, 
  Highlighter, 
  ShieldAlert, 
  Stamp, 
  ZoomIn, 
  ZoomOut, 
  Save, 
  PenTool, 
  X
} from 'lucide-react';
import { PDFAnnotation } from '../../types';
import { 
  applyPdfModifications, 
  loadPdfForViewing, 
  manipulatePdfPages, 
  mergePdfFiles, 
  renderPdfPageToCanvas, 
  splitPdfByRange 
} from '../../services/pdfService';
import saveAs from 'file-saver';
import confetti from 'canvas-confetti';

interface PdfStudioProps {
  initialFile?: File | null;
  onSaveToProjects?: (title: string, data: any) => void;
}

export const PdfStudio: React.FC<PdfStudioProps> = ({
  initialFile,
  onSaveToProjects,
}) => {
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pdfJsDoc, setPdfJsDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomScale, setZoomScale] = useState<number>(1.25);
  const [fileName, setFileName] = useState<string>('document.pdf');
  const [isProcessing, setIsProcessing] = useState(false);

  // Annotations & modifications
  const [annotations, setAnnotations] = useState<PDFAnnotation[]>([]);
  const [watermarkText, setWatermarkText] = useState<string>('');
  const [addPageNumbers, setAddPageNumbers] = useState<boolean>(false);

  // Active Tool Mode
  const [activeTool, setActiveTool] = useState<'select' | 'text' | 'redact' | 'highlight' | 'signature'>('select');

  // Modals
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [splitRange, setSplitRange] = useState({ start: 1, end: 1 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingSignatureRef = useRef(false);

  const loadFile = async (file: File) => {
    try {
      setIsProcessing(true);
      setFileName(file.name);
      const buffer = await file.arrayBuffer();
      setPdfBytes(buffer);
      const doc = await loadPdfForViewing(buffer);
      setPdfJsDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(1);
      setAnnotations([]);
      setSplitRange({ start: 1, end: doc.numPages });
    } catch (err) {
      console.error('Failed to load PDF:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Load initial file if provided
  useEffect(() => {
    if (initialFile) {
      loadFile(initialFile);
    }
  }, [initialFile]);

  // Render current page when page or zoom changes
  useEffect(() => {
    if (!pdfJsDoc || !canvasRef.current) return;
    renderPdfPageToCanvas(pdfJsDoc, currentPage, canvasRef.current, zoomScale);
  }, [pdfJsDoc, currentPage, zoomScale]);

  // Handle page manipulation (Rotate, Delete, Duplicate)
  const handleRotatePage = async (pageIdx: number) => {
    if (!pdfBytes) return;
    try {
      setIsProcessing(true);
      const updated = await manipulatePdfPages(pdfBytes, [
        { pageIndex: pageIdx, rotationDelta: 90 },
      ]);
      const newBuffer = updated.buffer as ArrayBuffer;
      setPdfBytes(newBuffer);
      const doc = await loadPdfForViewing(newBuffer);
      setPdfJsDoc(doc);
    } catch (e) {
      console.error('Rotate failed:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeletePage = async (pageIdx: number) => {
    if (!pdfBytes || numPages <= 1) return;
    try {
      setIsProcessing(true);
      const updated = await manipulatePdfPages(pdfBytes, [
        { pageIndex: pageIdx, delete: true },
      ]);
      const newBuffer = updated.buffer as ArrayBuffer;
      setPdfBytes(newBuffer);
      const doc = await loadPdfForViewing(newBuffer);
      setPdfJsDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(Math.min(currentPage, doc.numPages));
    } catch (e) {
      console.error('Delete failed:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDuplicatePage = async (pageIdx: number) => {
    if (!pdfBytes) return;
    try {
      setIsProcessing(true);
      const updated = await manipulatePdfPages(pdfBytes, [
        { pageIndex: pageIdx, duplicate: true },
      ]);
      const newBuffer = updated.buffer as ArrayBuffer;
      setPdfBytes(newBuffer);
      const doc = await loadPdfForViewing(newBuffer);
      setPdfJsDoc(doc);
      setNumPages(doc.numPages);
    } catch (e) {
      console.error('Duplicate failed:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Canvas click to place text, redact box, or highlight
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || activeTool === 'select') return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / zoomScale;
    const clickY = (e.clientY - rect.top) / zoomScale;

    if (activeTool === 'text') {
      const text = prompt('Enter text to place on page:', 'Sample Text');
      if (text) {
        setAnnotations((prev) => [
          ...prev,
          {
            id: `ann-${Date.now()}`,
            pageIndex: currentPage - 1,
            type: 'text',
            text,
            x: clickX,
            y: clickY,
            fontSize: 14,
            color: '#000000',
          },
        ]);
      }
    } else if (activeTool === 'redact') {
      setAnnotations((prev) => [
        ...prev,
        {
          id: `ann-${Date.now()}`,
          pageIndex: currentPage - 1,
          type: 'redact',
          x: clickX,
          y: clickY,
          width: 140,
          height: 24,
        },
      ]);
    } else if (activeTool === 'highlight') {
      setAnnotations((prev) => [
        ...prev,
        {
          id: `ann-${Date.now()}`,
          pageIndex: currentPage - 1,
          type: 'highlight',
          x: clickX,
          y: clickY,
          width: 160,
          height: 20,
          color: '#fef08a',
        },
      ]);
    }

    setActiveTool('select');
  };

  // Signature Pad Logic
  const startDrawingSignature = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawingSignatureRef.current = true;
    const canvas = signaturePadCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const drawSignature = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingSignatureRef.current) return;
    const canvas = signaturePadCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawingSignature = () => {
    isDrawingSignatureRef.current = false;
  };

  const applySignature = () => {
    const canvas = signaturePadCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');

    setAnnotations((prev) => [
      ...prev,
      {
        id: `sig-${Date.now()}`,
        pageIndex: currentPage - 1,
        type: 'signature',
        dataUrl,
        x: 100,
        y: 200,
        width: 150,
        height: 60,
      },
    ]);

    setIsSignatureModalOpen(false);
  };

  // Export modified PDF
  const handleExportPdf = async () => {
    if (!pdfBytes) return;
    try {
      setIsProcessing(true);
      const modifiedBytes = await applyPdfModifications(pdfBytes, annotations, {
        watermarkText: watermarkText.trim() || undefined,
        addPageNumbers,
      });

      const blob = new Blob([modifiedBytes as any], { type: 'application/pdf' });
      saveAs(blob, fileName.replace('.pdf', '_edited.pdf'));
      confetti({ particleCount: 50, spread: 60 });
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Split PDF
  const handleSplitPdf = async () => {
    if (!pdfBytes) return;
    try {
      setIsProcessing(true);
      const splitBytes = await splitPdfByRange(
        pdfBytes,
        splitRange.start,
        splitRange.end
      );
      const blob = new Blob([splitBytes as any], { type: 'application/pdf' });
      saveAs(blob, `${fileName.replace('.pdf', '')}_pages_${splitRange.start}-${splitRange.end}.pdf`);
      setIsSplitModalOpen(false);
    } catch (err) {
      console.error('Split failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Merge another PDF
  const handleMergePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !pdfBytes) return;

    try {
      setIsProcessing(true);
      const donorBuffer = await files[0].arrayBuffer();
      const mergedBytes = await mergePdfFiles([pdfBytes, donorBuffer]);
      const newBuffer = mergedBytes.buffer as ArrayBuffer;
      setPdfBytes(newBuffer);
      const doc = await loadPdfForViewing(newBuffer);
      setPdfJsDoc(doc);
      setNumPages(doc.numPages);
    } catch (err) {
      console.error('Merge failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      {/* Top Toolbar */}
      <div className="h-14 border-b border-slate-800 bg-slate-900/90 px-4 flex items-center justify-between shrink-0 overflow-x-auto gap-3">
        {/* Left: Tools */}
        <div className="flex items-center gap-1.5 shrink-0">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer shadow-sm">
            <Upload className="w-3.5 h-3.5" />
            <span>Open PDF</span>
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
            />
          </label>

          <div className="h-5 w-px bg-slate-800 mx-1" />

          <button
            onClick={() => setActiveTool(activeTool === 'text' ? 'select' : 'text')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              activeTool === 'text' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="Click on page to place text"
          >
            <Type className="w-3.5 h-3.5" />
            <span>Add Text</span>
          </button>

          <button
            onClick={() => setActiveTool(activeTool === 'highlight' ? 'select' : 'highlight')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              activeTool === 'highlight' ? 'bg-yellow-600/30 text-yellow-300 border border-yellow-500/40' : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="Highlight area on page"
          >
            <Highlighter className="w-3.5 h-3.5 text-yellow-400" />
            <span>Highlight</span>
          </button>

          <button
            onClick={() => setActiveTool(activeTool === 'redact' ? 'select' : 'redact')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              activeTool === 'redact' ? 'bg-red-600/30 text-red-300 border border-red-500/40' : 'hover:bg-slate-800 text-slate-300'
            }`}
            title="Visual Redaction Overlay: Draws an opaque black box over visual content. (Note: Visual overlay; underlying PDF font text streams should be rasterized for destructive removal)"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            <span>Visual Redaction</span>
          </button>

          <button
            onClick={() => setIsSignatureModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
            title="Draw or place signature stamp"
          >
            <PenTool className="w-3.5 h-3.5 text-indigo-400" />
            <span>Sign</span>
          </button>

          <button
            onClick={() => {
              const text = prompt('Enter watermark text (e.g. CONFIDENTIAL, DRAFT):', watermarkText || 'CONFIDENTIAL');
              if (text !== null) setWatermarkText(text);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
              watermarkText ? 'bg-slate-800 text-indigo-400 border border-indigo-500/40' : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Stamp className="w-3.5 h-3.5" />
            <span>Watermark {watermarkText && `("${watermarkText}")`}</span>
          </button>

          <button
            onClick={() => setAddPageNumbers(!addPageNumbers)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
              addPageNumbers ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40' : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            <span>Page Numbers: {addPageNumbers ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Right: Zoom & Export */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 text-xs text-slate-300">
            <button
              onClick={() => setZoomScale((s) => Math.max(0.5, s - 0.25))}
              className="p-1 hover:text-white cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px]">{Math.round(zoomScale * 100)}%</span>
            <button
              onClick={() => setZoomScale((s) => Math.min(2.5, s + 0.25))}
              className="p-1 hover:text-white cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setIsSplitModalOpen(true)}
            disabled={!pdfBytes}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-medium cursor-pointer"
          >
            Split
          </button>

          <label className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer">
            <span>Merge</span>
            <input type="file" accept=".pdf" className="hidden" onChange={handleMergePdfUpload} />
          </label>

          {onSaveToProjects && (
            <button
              onClick={() => onSaveToProjects(fileName, { annotations, watermarkText, addPageNumbers, fileName })}
              disabled={!pdfBytes}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
              title="Save PDF project state"
            >
              <Save className="w-3.5 h-3.5 text-indigo-400" />
              <span>Save</span>
            </button>
          )}

          <button
            onClick={handleExportPdf}
            disabled={!pdfBytes || isProcessing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold shadow-md shadow-emerald-600/25 cursor-pointer"
          >
            <DownloadCloud className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Main Studio Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Page Thumbnails Strip */}
        {pdfJsDoc && (
          <div className="w-48 border-r border-slate-800 bg-slate-900/40 p-3 overflow-y-auto space-y-3 shrink-0 hidden sm:block">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Pages ({numPages})</span>
              <span className="text-slate-500 text-[10px]">Page {currentPage}</span>
            </div>

            {Array.from({ length: numPages }, (_, i) => i + 1).map((pNum) => (
              <div
                key={pNum}
                onClick={() => setCurrentPage(pNum)}
                className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                  currentPage === pNum
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-md ring-1 ring-indigo-500/30'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold text-slate-300 mb-1.5">Page {pNum}</div>
                <div className="flex items-center justify-center gap-1 text-slate-400">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRotatePage(pNum - 1);
                    }}
                    className="p-1 rounded hover:bg-slate-800 hover:text-white"
                    title="Rotate 90°"
                  >
                    <RotateCw className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicatePage(pNum - 1);
                    }}
                    className="p-1 rounded hover:bg-slate-800 hover:text-white"
                    title="Duplicate Page"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  {numPages > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePage(pNum - 1);
                      }}
                      className="p-1 rounded hover:bg-slate-800 hover:text-red-400"
                      title="Delete Page"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Center PDF Canvas Viewport */}
        <div className="flex-1 overflow-auto p-4 md:p-8 flex flex-col items-center justify-start bg-slate-950">
          {!pdfBytes ? (
            <div className="text-center py-24 space-y-4 max-w-sm">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">No PDF Loaded</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Upload an existing PDF document to edit pages, add text, watermarks, highlights, signatures, and redacting.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer shadow-lg shadow-indigo-600/30">
                <Upload className="w-4 h-4" />
                <span>Upload PDF Document</span>
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
                />
              </label>
            </div>
          ) : (
            <div className="relative shadow-2xl rounded-lg overflow-hidden border border-slate-700/80 bg-white">
              {activeTool !== 'select' && (
                <div className="absolute top-3 left-3 z-20 px-3 py-1 rounded-full bg-slate-900/90 text-white text-[11px] font-semibold border border-indigo-500/40 shadow-lg flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                  <span>Click anywhere on the document to place {activeTool}</span>
                </div>
              )}

              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className={`block ${activeTool !== 'select' ? 'cursor-crosshair' : 'cursor-default'}`}
              />

              {/* Render dynamic annotations on the active page for visual feedback */}
              {annotations
                .filter((ann) => ann.pageIndex === currentPage - 1)
                .map((ann) => (
                  <div
                    key={ann.id}
                    className="absolute pointer-events-none"
                    style={{
                      left: ann.x * zoomScale,
                      top: ann.y * zoomScale,
                      width: ann.width ? ann.width * zoomScale : 'auto',
                      height: ann.height ? ann.height * zoomScale : 'auto',
                    }}
                  >
                    {ann.type === 'text' && (
                      <span
                        style={{
                          fontSize: (ann.fontSize || 14) * zoomScale,
                          color: ann.color || '#000',
                          fontWeight: 600,
                        }}
                      >
                        {ann.text}
                      </span>
                    )}
                    {ann.type === 'redact' && (
                      <div className="w-full h-full bg-black border border-red-500/50" />
                    )}
                    {ann.type === 'highlight' && (
                      <div
                        className="w-full h-full bg-yellow-300/50 border border-yellow-400"
                      />
                    )}
                    {ann.type === 'signature' && ann.dataUrl && (
                      <img src={ann.dataUrl} alt="sig" className="w-full h-full object-contain" />
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Signature Modal */}
      {isSignatureModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PenTool className="w-4 h-4 text-indigo-400" />
                <span>Draw Your Signature</span>
              </h3>
              <button
                onClick={() => setIsSignatureModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Draw inside the box below to generate a transparent digital signature stamp.
            </p>

            <div className="border border-slate-700 rounded-xl bg-white overflow-hidden">
              <canvas
                ref={signaturePadCanvasRef}
                width={380}
                height={160}
                onMouseDown={startDrawingSignature}
                onMouseMove={drawSignature}
                onMouseUp={stopDrawingSignature}
                onMouseLeave={stopDrawingSignature}
                className="w-full cursor-crosshair block"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => {
                  const canvas = signaturePadCanvasRef.current;
                  if (canvas) {
                    const ctx = canvas.getContext('2d');
                    ctx?.clearRect(0, 0, canvas.width, canvas.height);
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Clear
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSignatureModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={applySignature}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                >
                  Apply Signature
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Split Modal */}
      {isSplitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Split PDF by Range</h3>
            <p className="text-xs text-slate-400">
              Extract a specific set of pages into a new standalone PDF document.
            </p>

            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-[11px] text-slate-400 font-semibold">From Page</label>
                <input
                  type="number"
                  min="1"
                  max={numPages}
                  value={splitRange.start}
                  onChange={(e) =>
                    setSplitRange((prev) => ({ ...prev, start: parseInt(e.target.value) || 1 }))
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-xs"
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-[11px] text-slate-400 font-semibold">To Page</label>
                <input
                  type="number"
                  min={splitRange.start}
                  max={numPages}
                  value={splitRange.end}
                  onChange={(e) =>
                    setSplitRange((prev) => ({ ...prev, end: parseInt(e.target.value) || 1 }))
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsSplitModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSplitPdf}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                Extract Pages
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
