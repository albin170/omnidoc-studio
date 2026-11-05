import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  X,
  Search,
  Plus,
  Square,
  Underline as UnderlineIcon,
  Strikethrough as StrikeIcon,
  Check,
  Undo2,
  Redo2,
  Image as ImageIcon,
  MessageSquare,
  Scissors
} from 'lucide-react';
import { PDFAnnotation, PdfTextEdit, PdfTextItem } from '../../types';
import { 
  applyPdfModifications, 
  deletePdfPage, 
  duplicatePdfPage, 
  extractPageTextItems, 
  insertBlankPage, 
  loadPdfForViewing, 
  mergePdfFiles, 
  renderPdfPageToCanvas, 
  rotatePdfPage, 
  splitPdfByRange, 
  verifyPdfIntegrity 
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
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Page text extraction & interactive editing (Module 4A)
  const [pageTextItems, setPageTextItems] = useState<PdfTextItem[]>([]);
  const [textEdits, setTextEdits] = useState<Record<string, PdfTextEdit>>({});
  const [selectedTextItem, setSelectedTextItem] = useState<PdfTextItem | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editDraftText, setEditDraftText] = useState<string>('');
  const [editFontSize, setEditFontSize] = useState<number>(14);
  const [editFontColor, setEditFontColor] = useState<string>('#000000');
  const [editFontWeight, setEditFontWeight] = useState<'normal' | 'bold'>('normal');
  const [editFontStyle, setEditFontStyle] = useState<'normal' | 'italic'>('normal');

  // In-PDF Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResultsCount, setSearchResultsCount] = useState(0);

  // Annotations & modifications
  const [annotations, setAnnotations] = useState<PDFAnnotation[]>([]);
  const [watermarkText, setWatermarkText] = useState<string>('');
  const [addPageNumbers, setAddPageNumbers] = useState<boolean>(false);

  // Undo/Redo history stack
  const [historyStack, setHistoryStack] = useState<{ edits: Record<string, PdfTextEdit>; annos: PDFAnnotation[] }[]>([]);
  const [redoStack, setRedoStack] = useState<{ edits: Record<string, PdfTextEdit>; annos: PDFAnnotation[] }[]>([]);

  // Active Tool Mode
  const [activeTool, setActiveTool] = useState<
    'select' | 'text' | 'redact' | 'highlight' | 'underline' | 'strikethrough' | 'rectangle' | 'signature' | 'image' | 'comment'
  >('select');

  // Modals
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [splitRange, setSplitRange] = useState({ start: 1, end: 1 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const isDrawingSignatureRef = useRef(false);

  const saveToHistory = useCallback(() => {
    setHistoryStack((prev) => [...prev.slice(-15), { edits: { ...textEdits }, annos: [...annotations] }]);
    setRedoStack([]);
  }, [textEdits, annotations]);

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const prev = historyStack[historyStack.length - 1];
    setRedoStack((r) => [{ edits: { ...textEdits }, annos: [...annotations] }, ...r]);
    setHistoryStack((h) => h.slice(0, h.length - 1));
    setTextEdits(prev.edits);
    setAnnotations(prev.annos);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setHistoryStack((h) => [...h, { edits: { ...textEdits }, annos: [...annotations] }]);
    setRedoStack((r) => r.slice(1));
    setTextEdits(next.edits);
    setAnnotations(next.annos);
  };

  const loadFile = async (file: File) => {
    try {
      setIsProcessing(true);
      setStatusMessage('Loading PDF document...');
      setFileName(file.name);
      const buffer = await file.arrayBuffer();
      setPdfBytes(buffer);
      const doc = await loadPdfForViewing(buffer);
      setPdfJsDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(1);
      setAnnotations([]);
      setTextEdits({});
      setSelectedTextItem(null);
      setEditingTextId(null);
      setSplitRange({ start: 1, end: doc.numPages });
      setStatusMessage('PDF loaded successfully');
    } catch (err: any) {
      console.error('Failed to load PDF:', err);
      setStatusMessage('Error loading PDF: ' + (err.message || 'Corrupt file'));
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (initialFile) {
      loadFile(initialFile);
    }
  }, [initialFile]);

  // Render current page & extract text items
  useEffect(() => {
    if (!pdfJsDoc || !canvasRef.current) return;
    let isCancelled = false;

    const render = async () => {
      try {
        await renderPdfPageToCanvas(pdfJsDoc, currentPage, canvasRef.current!, zoomScale);
        if (isCancelled) return;
        const items = await extractPageTextItems(pdfJsDoc, currentPage, zoomScale);
        if (!isCancelled) {
          setPageTextItems(items);
        }
      } catch (err) {
        console.error('Failed to render PDF page:', err);
      }
    };

    render();
    return () => {
      isCancelled = true;
    };
  }, [pdfJsDoc, currentPage, zoomScale]);

  // Handle in-PDF Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResultsCount(0);
      return;
    }
    const q = searchQuery.toLowerCase();
    const count = pageTextItems.filter((it) => it.str.toLowerCase().includes(q)).length;
    setSearchResultsCount(count);
  }, [searchQuery, pageTextItems]);

  // Page manipulation actions
  const handleInsertBlankPage = async () => {
    if (!pdfBytes) return;
    try {
      setIsProcessing(true);
      saveToHistory();
      const updated = await insertBlankPage(pdfBytes, currentPage);
      const newBuffer = updated.buffer as ArrayBuffer;
      setPdfBytes(newBuffer);
      const doc = await loadPdfForViewing(newBuffer);
      setPdfJsDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(currentPage + 1);
      setStatusMessage(`Blank page inserted after page ${currentPage}`);
    } catch (e: any) {
      alert('Insert page failed: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteCurrentPage = async (pageIdx: number) => {
    if (!pdfBytes || numPages <= 1) {
      alert('Cannot delete the only page in document.');
      return;
    }
    try {
      setIsProcessing(true);
      saveToHistory();
      const updated = await deletePdfPage(pdfBytes, pageIdx);
      const newBuffer = updated.buffer as ArrayBuffer;
      setPdfBytes(newBuffer);
      const doc = await loadPdfForViewing(newBuffer);
      setPdfJsDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(Math.min(currentPage, doc.numPages));
      setStatusMessage(`Page ${pageIdx + 1} deleted`);
    } catch (e: any) {
      alert('Delete failed: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDuplicateCurrentPage = async (pageIdx: number) => {
    if (!pdfBytes) return;
    try {
      setIsProcessing(true);
      saveToHistory();
      const updated = await duplicatePdfPage(pdfBytes, pageIdx);
      const newBuffer = updated.buffer as ArrayBuffer;
      setPdfBytes(newBuffer);
      const doc = await loadPdfForViewing(newBuffer);
      setPdfJsDoc(doc);
      setNumPages(doc.numPages);
      setStatusMessage(`Page ${pageIdx + 1} duplicated`);
    } catch (e: any) {
      alert('Duplicate failed: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRotateCurrentPage = async (pageIdx: number, delta: number = 90) => {
    if (!pdfBytes) return;
    try {
      setIsProcessing(true);
      saveToHistory();
      const updated = await rotatePdfPage(pdfBytes, pageIdx, delta);
      const newBuffer = updated.buffer as ArrayBuffer;
      setPdfBytes(newBuffer);
      const doc = await loadPdfForViewing(newBuffer);
      setPdfJsDoc(doc);
      setStatusMessage(`Page ${pageIdx + 1} rotated by ${delta}°`);
    } catch (e: any) {
      alert('Rotate failed: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Text selection & editing triggers
  const handleSelectTextItem = (item: PdfTextItem) => {
    setSelectedTextItem(item);
    const existing = textEdits[item.id];
    setEditDraftText(existing ? existing.newText : item.str);
    setEditFontSize(existing?.fontSize || item.fontSize);
    setEditFontColor(existing?.fontColor || '#000000');
    setEditFontWeight(existing?.fontWeight || 'normal');
    setEditFontStyle(existing?.fontStyle || 'normal');
  };

  const handleDoubleClickTextItem = (item: PdfTextItem) => {
    handleSelectTextItem(item);
    setEditingTextId(item.id);
  };

  const commitTextEdit = () => {
    if (!selectedTextItem) return;
    saveToHistory();

    const newEdit: PdfTextEdit = {
      id: selectedTextItem.id,
      pageIndex: currentPage - 1,
      originalText: selectedTextItem.str,
      newText: editDraftText,
      pdfX: selectedTextItem.pdfX,
      pdfY: selectedTextItem.pdfY,
      width: selectedTextItem.width / zoomScale,
      height: selectedTextItem.height / zoomScale,
      fontSize: editFontSize,
      fontColor: editFontColor,
      fontWeight: editFontWeight,
      fontStyle: editFontStyle,
      isDeleted: false,
    };

    setTextEdits((prev) => ({ ...prev, [selectedTextItem.id]: newEdit }));
    setEditingTextId(null);
    setStatusMessage('Text modification saved in working document');
  };

  const handleDeleteSelectedText = () => {
    if (!selectedTextItem) return;
    saveToHistory();

    const deleteEdit: PdfTextEdit = {
      id: selectedTextItem.id,
      pageIndex: currentPage - 1,
      originalText: selectedTextItem.str,
      newText: '',
      pdfX: selectedTextItem.pdfX,
      pdfY: selectedTextItem.pdfY,
      width: selectedTextItem.width / zoomScale,
      height: selectedTextItem.height / zoomScale,
      isDeleted: true,
    };

    setTextEdits((prev) => ({ ...prev, [selectedTextItem.id]: deleteEdit }));
    setEditingTextId(null);
    setSelectedTextItem(null);
    setStatusMessage('Selected text removed');
  };

  const handleRedactSelectedText = () => {
    if (!selectedTextItem) return;
    saveToHistory();

    // 1. Mark underlying text as deleted
    const deleteEdit: PdfTextEdit = {
      id: selectedTextItem.id,
      pageIndex: currentPage - 1,
      originalText: selectedTextItem.str,
      newText: '',
      pdfX: selectedTextItem.pdfX,
      pdfY: selectedTextItem.pdfY,
      width: selectedTextItem.width / zoomScale,
      height: selectedTextItem.height / zoomScale,
      isDeleted: true,
    };
    setTextEdits((prev) => ({ ...prev, [selectedTextItem.id]: deleteEdit }));

    // 2. Place opaque black redaction box
    setAnnotations((prev) => [
      ...prev,
      {
        id: `redact-${Date.now()}`,
        pageIndex: currentPage - 1,
        type: 'redact',
        x: selectedTextItem.pdfX,
        y: selectedTextItem.viewportY / zoomScale,
        width: selectedTextItem.width / zoomScale,
        height: selectedTextItem.height / zoomScale,
        color: '#000000',
      },
    ]);

    setSelectedTextItem(null);
    setEditingTextId(null);
    setStatusMessage('Target text redacted & scrubbed from stream');
  };

  // Canvas click to place annotations
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || activeTool === 'select') return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / zoomScale;
    const clickY = (e.clientY - rect.top) / zoomScale;

    saveToHistory();

    if (activeTool === 'text') {
      const text = prompt('Enter text to place on page:', 'Custom Text Note');
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
    } else if (activeTool === 'underline') {
      setAnnotations((prev) => [
        ...prev,
        {
          id: `ann-${Date.now()}`,
          pageIndex: currentPage - 1,
          type: 'underline',
          x: clickX,
          y: clickY,
          width: 120,
          height: 16,
          color: '#2563eb',
        },
      ]);
    } else if (activeTool === 'strikethrough') {
      setAnnotations((prev) => [
        ...prev,
        {
          id: `ann-${Date.now()}`,
          pageIndex: currentPage - 1,
          type: 'strikethrough',
          x: clickX,
          y: clickY,
          width: 120,
          height: 16,
          color: '#ef4444',
        },
      ]);
    } else if (activeTool === 'rectangle') {
      setAnnotations((prev) => [
        ...prev,
        {
          id: `ann-${Date.now()}`,
          pageIndex: currentPage - 1,
          type: 'rectangle',
          x: clickX,
          y: clickY,
          width: 140,
          height: 60,
          color: '#3b82f6',
        },
      ]);
    } else if (activeTool === 'comment') {
      const comment = prompt('Enter page comment / annotation:', 'Review Note');
      if (comment) {
        setAnnotations((prev) => [
          ...prev,
          {
            id: `ann-${Date.now()}`,
            pageIndex: currentPage - 1,
            type: 'comment',
            text: comment,
            x: clickX,
            y: clickY,
            width: 24,
            height: 24,
          },
        ]);
      }
    }

    setActiveTool('select');
  };

  // Signature Pad Handlers
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

    saveToHistory();
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
    setStatusMessage('Signature placed on document');
  };

  // Image insertion handler
  const handleInsertImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      saveToHistory();
      setAnnotations((prev) => [
        ...prev,
        {
          id: `img-${Date.now()}`,
          pageIndex: currentPage - 1,
          type: 'image',
          dataUrl,
          x: 100,
          y: 150,
          width: 140,
          height: 90,
        },
      ]);
      setStatusMessage('Image embedded onto page');
    };
    reader.readAsDataURL(file);
  };

  // Export & Save with verification
  const handleExportPdf = async () => {
    if (!pdfBytes) return;
    try {
      setIsProcessing(true);
      setStatusMessage('Applying text replacements, redactions, and annotations...');

      const textEditsArray = Object.values(textEdits);
      const modifiedBytes = await applyPdfModifications(pdfBytes, annotations, {
        watermarkText: watermarkText.trim() || undefined,
        addPageNumbers,
        textEdits: textEditsArray,
      });

      // Post-save verification: Reopen and check structural integrity (Module 4A)
      setStatusMessage('Reopening and verifying output PDF integrity...');
      const verifyReport = await verifyPdfIntegrity(modifiedBytes);
      if (!verifyReport.valid) {
        throw new Error(verifyReport.error || 'Failed to verify output PDF structure');
      }

      // Re-load the verified bytes into current view
      const newBuffer = modifiedBytes.buffer as ArrayBuffer;
      setPdfBytes(newBuffer);
      const doc = await loadPdfForViewing(newBuffer);
      setPdfJsDoc(doc);
      setTextEdits({});

      const blob = new Blob([modifiedBytes as any], { type: 'application/pdf' });
      saveAs(blob, fileName.replace('.pdf', '_edited.pdf'));
      confetti({ particleCount: 50, spread: 60 });
      setStatusMessage(`Verified: Reopened cleanly with ${verifyReport.pageCount} pages. Download started.`);
    } catch (err: any) {
      console.error('Failed to export PDF:', err);
      alert('PDF export failed: ' + err.message);
      setStatusMessage('Export error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSplitPdf = async () => {
    if (!pdfBytes) return;
    try {
      setIsProcessing(true);
      const splitBytes = await splitPdfByRange(pdfBytes, splitRange.start, splitRange.end);
      const blob = new Blob([splitBytes as any], { type: 'application/pdf' });
      saveAs(blob, `${fileName.replace('.pdf', '')}_pages_${splitRange.start}-${splitRange.end}.pdf`);
      setIsSplitModalOpen(false);
      setStatusMessage(`Extracted pages ${splitRange.start} through ${splitRange.end}`);
    } catch (err: any) {
      alert('Split failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMergePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pdfBytes) return;

    try {
      setIsProcessing(true);
      setStatusMessage(`Merging "${file.name}" with current document...`);
      const secondBuffer = await file.arrayBuffer();
      const mergedBytes = await mergePdfFiles([pdfBytes, secondBuffer]);

      const newBuffer = mergedBytes.buffer as ArrayBuffer;
      setPdfBytes(newBuffer);
      const doc = await loadPdfForViewing(newBuffer);
      setPdfJsDoc(doc);
      setNumPages(doc.numPages);
      setStatusMessage(`Merged! Total pages now: ${doc.numPages}`);
      confetti({ particleCount: 40, spread: 50 });
    } catch (err: any) {
      alert('Merge failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#080B18]/60 text-[#F4F5FF]">
      {/* 1. Primary Top Navigation & File Bar */}
      <div className="h-14 border-b border-white/10 bg-[#11152A]/85 backdrop-blur-2xl px-4 flex items-center justify-between shrink-0 gap-3 overflow-x-auto">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            className="bg-transparent text-sm font-bold text-[#F4F5FF] border-b border-transparent hover:border-white/20 focus:border-[#8B7CFF] px-1 py-0.5 outline-none w-48 md:w-64 transition-colors"
            placeholder="Document Name"
          />
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
            PDF STUDIO PRO
          </span>
          {statusMessage && (
            <span className="text-[11px] text-[#9BA3BD] font-medium truncate max-w-xs hidden xl:block">
              {statusMessage}
            </span>
          )}
        </div>

        {/* Action Controls & Export */}
        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <div className="flex items-center glass-card rounded-lg p-0.5 text-xs text-[#9BA3BD]">
            <button
              onClick={handleUndo}
              disabled={historyStack.length === 0}
              className="p-1 hover:text-[#F4F5FF] disabled:opacity-30 cursor-pointer"
              title="Undo"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="p-1 hover:text-[#F4F5FF] disabled:opacity-30 cursor-pointer"
              title="Redo"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card hover:border-[#8B7CFF]/50 text-[#F4F5FF] text-xs font-semibold cursor-pointer transition-all">
            <Upload className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Upload PDF</span>
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
            />
          </label>

          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card hover:border-[#8B7CFF]/50 text-[#F4F5FF] text-xs font-semibold cursor-pointer transition-all">
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Merge PDF</span>
            <input type="file" accept=".pdf" className="hidden" onChange={handleMergePdfUpload} />
          </label>

          <button
            onClick={() => setIsSplitModalOpen(true)}
            disabled={!pdfBytes}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card hover:border-amber-400/50 disabled:opacity-40 text-[#F4F5FF] text-xs font-semibold cursor-pointer transition-all"
          >
            <Scissors className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Split</span>
          </button>

          {onSaveToProjects && (
            <button
              onClick={() => onSaveToProjects(fileName, { annotations, textEdits, watermarkText, addPageNumbers, fileName })}
              disabled={!pdfBytes}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card hover:border-[#8B7CFF]/50 disabled:opacity-40 text-[#F4F5FF] text-xs font-semibold cursor-pointer transition-all"
            >
              <Save className="w-3.5 h-3.5 text-[#8B7CFF]" />
              <span>Save</span>
            </button>
          )}

          <button
            onClick={handleExportPdf}
            disabled={!pdfBytes || isProcessing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl glass-btn-primary disabled:opacity-40 text-xs font-semibold shadow-lg shadow-[#8B7CFF]/20 cursor-pointer"
          >
            <DownloadCloud className="w-4 h-4" />
            <span>Save &amp; Export</span>
          </button>
        </div>
      </div>

      {/* 2. Secondary Editing & Annotation Toolbar */}
      <div className="h-11 border-b border-white/10 bg-[#11152A]/60 backdrop-blur-xl px-4 flex items-center justify-between shrink-0 overflow-x-auto gap-2 text-[#9BA3BD]">
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setActiveTool(activeTool === 'text' ? 'select' : 'text')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
              activeTool === 'text' ? 'bg-[#8B7CFF]/25 text-[#F4F5FF] border border-[#8B7CFF]/40 glow-purple' : 'hover:bg-white/[0.06] text-[#9BA3BD]'
            }`}
            title="Add new text note"
          >
            <Type className="w-3.5 h-3.5" />
            <span>Add Text</span>
          </button>

          <button
            onClick={() => setActiveTool(activeTool === 'highlight' ? 'select' : 'highlight')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
              activeTool === 'highlight' ? 'bg-amber-400/25 text-amber-300 border border-amber-400/40' : 'hover:bg-white/[0.06] text-[#9BA3BD]'
            }`}
            title="Highlight region"
          >
            <Highlighter className="w-3.5 h-3.5 text-amber-400" />
            <span>Highlight</span>
          </button>

          <button
            onClick={() => setActiveTool(activeTool === 'redact' ? 'select' : 'redact')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
              activeTool === 'redact' ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40 glow-rose' : 'hover:bg-white/[0.06] text-[#9BA3BD]'
            }`}
            title="True Redaction: Blackout + Stream Scrubbing"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Redact Area</span>
          </button>

          <button
            onClick={() => setActiveTool(activeTool === 'underline' ? 'select' : 'underline')}
            className={`p-1.5 rounded-xl transition-all cursor-pointer ${
              activeTool === 'underline' ? 'bg-[#42D6E8]/25 text-[#42D6E8] border border-[#42D6E8]/40' : 'hover:bg-white/[0.06] text-[#9BA3BD]'
            }`}
            title="Underline"
          >
            <UnderlineIcon className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveTool(activeTool === 'strikethrough' ? 'select' : 'strikethrough')}
            className={`p-1.5 rounded-xl transition-all cursor-pointer ${
              activeTool === 'strikethrough' ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40' : 'hover:bg-white/[0.06] text-[#9BA3BD]'
            }`}
            title="Strikethrough"
          >
            <StrikeIcon className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveTool(activeTool === 'rectangle' ? 'select' : 'rectangle')}
            className={`p-1.5 rounded-xl transition-all cursor-pointer ${
              activeTool === 'rectangle' ? 'bg-white/20 text-[#F4F5FF]' : 'hover:bg-white/[0.06] text-[#9BA3BD]'
            }`}
            title="Draw Rectangle Box"
          >
            <Square className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsSignatureModalOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-xl hover:bg-white/[0.06] text-[#9BA3BD] hover:text-[#F4F5FF] cursor-pointer transition-colors"
            title="Draw Signature"
          >
            <PenTool className="w-3.5 h-3.5 text-[#8B7CFF]" />
            <span>Sign</span>
          </button>

          <label className="flex items-center gap-1 px-2 py-1 rounded-xl hover:bg-white/[0.06] text-[#9BA3BD] hover:text-[#F4F5FF] cursor-pointer transition-colors">
            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span>Image</span>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleInsertImage} />
          </label>

          <button
            onClick={() => setActiveTool(activeTool === 'comment' ? 'select' : 'comment')}
            className={`p-1.5 rounded-xl transition-all cursor-pointer ${
              activeTool === 'comment' ? 'bg-amber-400/25 text-amber-300 border border-amber-400/40' : 'hover:bg-white/[0.06] text-[#9BA3BD]'
            }`}
            title="Add Review Comment"
          >
            <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
          </button>

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Watermark toggle */}
          <button
            onClick={() => {
              const text = prompt('Enter watermark text (e.g. CONFIDENTIAL, DRAFT):', watermarkText || 'CONFIDENTIAL');
              if (text !== null) setWatermarkText(text);
            }}
            className={`px-2 py-1 rounded-xl text-xs cursor-pointer transition-colors ${
              watermarkText ? 'bg-[#8B7CFF]/20 text-[#8B7CFF] border border-[#8B7CFF]/40' : 'hover:bg-white/[0.06] text-[#9BA3BD]'
            }`}
          >
            <Stamp className="w-3.5 h-3.5 inline mr-1" />
            <span>{watermarkText ? `Watermark: "${watermarkText}"` : 'Watermark'}</span>
          </button>

          <button
            onClick={() => setAddPageNumbers(!addPageNumbers)}
            className={`px-2 py-1 rounded-xl text-xs cursor-pointer transition-colors ${
              addPageNumbers ? 'bg-[#42D6E8]/20 text-[#42D6E8] border border-[#42D6E8]/40' : 'hover:bg-white/[0.06] text-[#9BA3BD]'
            }`}
          >
            <span>Page Numbers: {addPageNumbers ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Right Search & Zoom Bar */}
        <div className="flex items-center gap-2">
          {/* In-PDF Search */}
          <div className="flex items-center glass-card border-white/10 rounded-xl px-2.5 py-1 gap-1.5 text-xs text-[#F4F5FF]">
            <Search className="w-3.5 h-3.5 text-[#42D6E8]" />
            <input
              type="text"
              placeholder="Search PDF text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none w-28 md:w-36 text-xs text-[#F4F5FF] placeholder:text-[#9BA3BD]/60"
            />
            {searchQuery && (
              <span className="text-[10px] text-[#42D6E8] font-mono font-bold">
                {searchResultsCount} found
              </span>
            )}
          </div>

          {/* Zoom */}
          <div className="flex items-center glass-card border-white/10 rounded-xl p-0.5 text-xs text-[#9BA3BD]">
            <button
              onClick={() => setZoomScale((s) => Math.max(0.6, s - 0.2))}
              className="p-1 hover:text-[#F4F5FF] cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] text-[#F4F5FF]">{Math.round(zoomScale * 100)}%</span>
            <button
              onClick={() => setZoomScale((s) => Math.min(2.5, s + 0.2))}
              className="p-1 hover:text-[#F4F5FF] cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Floating In-Place Text Editor Toolbar (when a text span is selected) */}
      {selectedTextItem && (
        <div className="bg-[#11152A]/95 backdrop-blur-2xl border-b border-[#8B7CFF]/40 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-[#F4F5FF] shadow-2xl animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-[#8B7CFF]">Editing Text:</span>
            <input
              type="text"
              value={editDraftText}
              onChange={(e) => setEditDraftText(e.target.value)}
              placeholder="Edit text..."
              className="px-2.5 py-1 rounded-xl glass-input text-[#F4F5FF] text-xs w-64 md:w-80 outline-none focus:border-[#8B7CFF]"
            />
            <button
              onClick={commitTextEdit}
              className="px-3 py-1 rounded-xl glass-btn-primary font-bold flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Font size */}
            <div className="flex items-center gap-1">
              <span className="text-[#9BA3BD]">Size:</span>
              <input
                type="number"
                min={8}
                max={72}
                value={editFontSize}
                onChange={(e) => setEditFontSize(Number(e.target.value))}
                className="w-12 glass-input rounded-lg px-1.5 py-0.5 text-xs text-[#F4F5FF] text-center"
              />
            </div>

            {/* Font color */}
            <div className="flex items-center gap-1">
              <span className="text-[#9BA3BD]">Color:</span>
              <input
                type="color"
                value={editFontColor}
                onChange={(e) => setEditFontColor(e.target.value)}
                className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
              />
            </div>

            {/* Bold/Italic */}
            <button
              onClick={() => setEditFontWeight(editFontWeight === 'bold' ? 'normal' : 'bold')}
              className={`px-2 py-0.5 rounded-lg font-bold ${editFontWeight === 'bold' ? 'bg-[#8B7CFF] text-[#080B18]' : 'glass-card text-[#9BA3BD]'}`}
            >
              B
            </button>
            <button
              onClick={() => setEditFontStyle(editFontStyle === 'italic' ? 'normal' : 'italic')}
              className={`px-2 py-0.5 rounded-lg italic font-serif ${editFontStyle === 'italic' ? 'bg-[#8B7CFF] text-[#080B18]' : 'glass-card text-[#9BA3BD]'}`}
            >
              I
            </button>

            {/* Redact or Delete */}
            <button
              onClick={handleRedactSelectedText}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/40 text-xs font-semibold cursor-pointer transition-colors"
              title="Redact this exact word/phrase"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Redact</span>
            </button>

            <button
              onClick={handleDeleteSelectedText}
              className="p-1 rounded-lg glass-card hover:bg-rose-500/20 text-[#9BA3BD] hover:text-rose-400 cursor-pointer transition-colors"
              title="Delete text item"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setSelectedTextItem(null)}
              className="p-1 rounded-lg hover:bg-white/10 text-[#9BA3BD] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 4. Main Body: Thumbnail Sidebar + Document Canvas Viewport */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Page Thumbnails & Operations Strip */}
        {pdfJsDoc && (
          <div className="w-48 border-r border-white/10 bg-[#11152A]/40 backdrop-blur-xl p-3 overflow-y-auto space-y-3 shrink-0 hidden sm:block custom-scrollbar">
            <div className="flex items-center justify-between pb-1 border-b border-white/10">
              <span className="text-[11px] font-bold text-[#9BA3BD] uppercase tracking-wider">Pages ({numPages})</span>
              <button
                onClick={handleInsertBlankPage}
                className="p-1 rounded-lg glass-card hover:border-[#8B7CFF]/50 text-[#9BA3BD] hover:text-[#F4F5FF] transition-all"
                title="Insert Blank Page after active page"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {Array.from({ length: numPages }, (_, i) => i + 1).map((pNum) => (
              <div
                key={pNum}
                onClick={() => setCurrentPage(pNum)}
                className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                  currentPage === pNum
                    ? 'border-[#8B7CFF]/60 bg-[#8B7CFF]/15 shadow-lg shadow-[#8B7CFF]/20 glow-purple'
                    : 'border-white/10 glass-card hover:border-white/20'
                }`}
              >
                <div className="text-xs font-bold text-[#F4F5FF] mb-1.5 flex items-center justify-between">
                  <span>Page {pNum}</span>
                  {currentPage === pNum && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8B7CFF] glow-purple" />
                  )}
                </div>

                <div className="flex items-center justify-center gap-1 text-[#9BA3BD]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRotateCurrentPage(pNum - 1, 90);
                    }}
                    className="p-1 rounded-lg hover:bg-white/10 hover:text-[#F4F5FF] transition-colors"
                    title="Rotate page 90°"
                  >
                    <RotateCw className="w-3 h-3" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateCurrentPage(pNum - 1);
                    }}
                    className="p-1 rounded-lg hover:bg-white/10 hover:text-[#F4F5FF] transition-colors"
                    title="Duplicate page"
                  >
                    <Copy className="w-3 h-3" />
                  </button>

                  {numPages > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCurrentPage(pNum - 1);
                      }}
                      className="p-1 rounded-lg hover:bg-rose-500/20 text-[#9BA3BD] hover:text-rose-400 transition-colors"
                      title="Delete page"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Viewport Canvas with Interactive Text Layer */}
        <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center items-start bg-[#080B18]/60 custom-scrollbar">
          {!pdfJsDoc ? (
            <div className="max-w-md w-full my-auto text-center p-8 rounded-[24px] glass-panel border border-dashed border-white/15 space-y-4 shadow-2xl">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 glow-rose">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#F4F5FF]">No PDF Loaded</h3>
                <p className="text-xs text-[#9BA3BD] mt-1 leading-relaxed">
                  Upload an existing PDF document to edit existing text, redact sensitive terms, add annotations, signatures, and manage pages.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl glass-btn-primary text-xs font-semibold cursor-pointer shadow-lg shadow-[#8B7CFF]/25">
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
            <div className="relative shadow-2xl rounded-xl overflow-hidden border border-white/20 bg-white">
              {/* Interactive Cursor Banner when a tool is armed */}
              {activeTool !== 'select' && (
                <div className="absolute top-3 left-3 z-30 px-3 py-1 rounded-full bg-slate-900/90 text-white text-[11px] font-semibold border border-indigo-500/40 shadow-lg flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                  <span>Click on document to place {activeTool}</span>
                </div>
              )}

              {/* Underlying Rendered Canvas */}
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className={`block ${activeTool !== 'select' ? 'cursor-crosshair' : 'cursor-default'}`}
              />

              {/* Module 4A: Genuine Selectable & Clickable PDF Text Layer */}
              <div className="absolute inset-0 z-10 pointer-events-auto">
                {pageTextItems.map((item) => {
                  const edit = textEdits[item.id];
                  const isEditing = editingTextId === item.id;
                  const isSelected = selectedTextItem?.id === item.id;
                  const displayText = edit ? (edit.isDeleted ? '' : edit.newText) : item.str;
                  const isDeleted = edit?.isDeleted;

                  // In-PDF Search Match
                  const isSearchMatch = searchQuery.trim() && item.str.toLowerCase().includes(searchQuery.toLowerCase());

                  if (isDeleted) {
                    return (
                      <div
                        key={item.id}
                        style={{
                          position: 'absolute',
                          left: item.viewportX,
                          top: item.viewportY,
                          width: item.width,
                          height: item.height,
                          backgroundColor: '#ffffff',
                        }}
                        className="opacity-95"
                      />
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      style={{
                        position: 'absolute',
                        left: item.viewportX,
                        top: item.viewportY,
                        width: item.width,
                        minHeight: item.height,
                        backgroundColor: edit ? '#ffffff' : (isSearchMatch ? 'rgba(254, 240, 138, 0.7)' : 'transparent'),
                      }}
                      className={`group transition-all select-text cursor-pointer ${
                        isSelected ? 'ring-2 ring-indigo-500 z-20' : 'hover:bg-blue-500/15'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeTool === 'select') {
                          handleSelectTextItem(item);
                        }
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleDoubleClickTextItem(item);
                      }}
                      title="Double-click to edit text"
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          type="text"
                          value={editDraftText}
                          onChange={(e) => setEditDraftText(e.target.value)}
                          onBlur={commitTextEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitTextEdit();
                            if (e.key === 'Escape') setEditingTextId(null);
                          }}
                          className="w-full h-full bg-white text-slate-900 outline-none px-0.5 border border-indigo-500 shadow-lg rounded"
                          style={{
                            fontSize: `${(editFontSize || item.fontSize) * (zoomScale / 1.25)}px`,
                            color: editFontColor || '#000000',
                            fontWeight: editFontWeight,
                            fontStyle: editFontStyle,
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: `${(edit?.fontSize || item.fontSize) * (zoomScale / 1.25)}px`,
                            color: edit ? (edit.fontColor || '#000000') : 'transparent',
                            fontWeight: edit?.fontWeight || 'normal',
                            fontStyle: edit?.fontStyle || 'normal',
                          }}
                          className={`block truncate ${edit ? 'text-slate-900' : 'text-transparent group-hover:text-slate-900/30'}`}
                        >
                          {displayText}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Render dynamic annotations (redactions, highlights, signatures, images) */}
              {annotations
                .filter((ann) => ann.pageIndex === currentPage - 1)
                .map((ann) => (
                  <div
                    key={ann.id}
                    className="absolute z-20 pointer-events-none"
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
                          color: ann.color || '#000000',
                          fontWeight: 600,
                        }}
                      >
                        {ann.text}
                      </span>
                    )}
                    {ann.type === 'redact' && (
                      <div className="w-full h-full bg-black border border-red-500/80 shadow-md" />
                    )}
                    {ann.type === 'highlight' && (
                      <div className="w-full h-full bg-yellow-300/40 border border-yellow-400" />
                    )}
                    {ann.type === 'underline' && (
                      <div className="w-full h-0.5 bg-blue-600 mt-3" />
                    )}
                    {ann.type === 'strikethrough' && (
                      <div className="w-full h-0.5 bg-red-600 mt-2" />
                    )}
                    {ann.type === 'rectangle' && (
                      <div className="w-full h-full border-2 border-blue-500 rounded-sm" />
                    )}
                    {ann.type === 'comment' && (
                      <div className="w-6 h-6 rounded bg-amber-400 text-slate-900 text-xs font-bold flex items-center justify-center shadow-lg border border-amber-600">
                        💬
                      </div>
                    )}
                    {ann.type === 'signature' && ann.dataUrl && (
                      <img src={ann.dataUrl} alt="sig" className="w-full h-full object-contain" />
                    )}
                    {ann.type === 'image' && ann.dataUrl && (
                      <img src={ann.dataUrl} alt="embedded" className="w-full h-full object-contain shadow-md" />
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Signature Modal */}
      {isSignatureModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-[#F4F5FF]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#F4F5FF] flex items-center gap-2">
                <PenTool className="w-4 h-4 text-[#8B7CFF]" />
                <span>Draw Your Signature</span>
              </h3>
              <button
                onClick={() => setIsSignatureModalOpen(false)}
                className="text-[#9BA3BD] hover:text-[#F4F5FF] p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#9BA3BD]">
              Draw inside the pad below to generate a transparent digital signature stamp.
            </p>

            <div className="border border-white/20 rounded-xl bg-white overflow-hidden shadow-inner">
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
                className="px-3 py-1.5 rounded-xl text-xs text-[#9BA3BD] hover:text-[#F4F5FF] hover:bg-white/10 transition-colors"
              >
                Clear Pad
              </button>

              <button
                onClick={applySignature}
                className="px-4 py-1.5 rounded-xl glass-btn-primary text-xs font-semibold shadow-lg shadow-[#8B7CFF]/20"
              >
                Apply Signature
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split PDF Modal */}
      {isSplitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-[#F4F5FF]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#F4F5FF] flex items-center gap-2">
                <Scissors className="w-4 h-4 text-amber-400" />
                <span>Split PDF Document</span>
              </h3>
              <button onClick={() => setIsSplitModalOpen(false)} className="text-[#9BA3BD] hover:text-[#F4F5FF] p-1 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#9BA3BD]">
              Choose the page range to extract into a standalone PDF file:
            </p>

            <div className="flex items-center gap-4 text-xs text-[#F4F5FF]">
              <div className="flex-1 space-y-1">
                <label className="text-[#9BA3BD]">From Page:</label>
                <input
                  type="number"
                  min={1}
                  max={numPages}
                  value={splitRange.start}
                  onChange={(e) => setSplitRange({ ...splitRange, start: Math.max(1, Number(e.target.value)) })}
                  className="w-full px-3 py-1.5 rounded-xl glass-input text-[#F4F5FF]"
                />
              </div>

              <div className="flex-1 space-y-1">
                <label className="text-[#9BA3BD]">To Page:</label>
                <input
                  type="number"
                  min={splitRange.start}
                  max={numPages}
                  value={splitRange.end}
                  onChange={(e) => setSplitRange({ ...splitRange, end: Math.min(numPages, Number(e.target.value)) })}
                  className="w-full px-3 py-1.5 rounded-xl glass-input text-[#F4F5FF]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsSplitModalOpen(false)}
                className="px-3 py-1.5 rounded-xl text-xs text-[#9BA3BD] hover:text-[#F4F5FF] hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSplitPdf}
                className="px-4 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold shadow-md transition-colors"
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
