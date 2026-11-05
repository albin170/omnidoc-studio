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
  Scissors,
  ChevronUp,
  ChevronDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Layers,
  ListTree,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Maximize2
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
  verifyPdfIntegrity,
  reorderPdfPages
} from '../../services/pdfService';
import { sanitizeAndRedactPdf, RedactionTarget } from '../../services/pdfSanitizerService';
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

  // 3-Panel Layout State
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [leftTab, setLeftTab] = useState<'pages' | 'outline'>('pages');
  const [rightTab, setRightTab] = useState<'inspector' | 'annotations' | 'diagnostics'>('inspector');
  const [outlineItems, setOutlineItems] = useState<any[]>([]);

  // Page text extraction & interactive editing (Module 4A)
  const [pageTextItems, setPageTextItems] = useState<PdfTextItem[]>([]);
  const [textEdits, setTextEdits] = useState<Record<string, PdfTextEdit>>({});
  const [selectedTextItem, setSelectedTextItem] = useState<PdfTextItem | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editDraftText, setEditDraftText] = useState<string>('');
  const [editFontSize, setEditFontSize] = useState<number>(14);
  const [editFontColor, setEditFontColor] = useState<string>('#000000');
  const [editFontFamily, setEditFontFamily] = useState<'Helvetica' | 'TimesRoman' | 'Courier'>('Helvetica');
  const [editFontWeight, setEditFontWeight] = useState<'normal' | 'bold'>('normal');
  const [editFontStyle, setEditFontStyle] = useState<'normal' | 'italic'>('normal');
  const [editTextAlign, setEditTextAlign] = useState<'left' | 'center' | 'right'>('left');

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

      // Extract outline/bookmarks if available
      try {
        const outline = await doc.getOutline();
        setOutlineItems(outline || []);
      } catch {
        setOutlineItems([]);
      }

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

  // Page reordering actions
  const applyPageReorder = async (newOrder: number[], targetPage: number) => {
    if (!pdfBytes) return;
    try {
      setIsProcessing(true);
      saveToHistory();
      const reorderedBytes = await reorderPdfPages(pdfBytes, newOrder);
      const newBuffer = reorderedBytes.buffer as ArrayBuffer;
      setPdfBytes(newBuffer);
      const doc = await loadPdfForViewing(newBuffer);
      setPdfJsDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(Math.min(Math.max(1, targetPage), doc.numPages));
      setStatusMessage('Page reordering applied');
    } catch (err: any) {
      alert('Failed to reorder pages: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMovePageUp = async (pageIdx: number) => {
    if (pageIdx <= 0 || !pdfBytes) return;
    const newOrder = Array.from({ length: numPages }, (_, i) => i);
    const temp = newOrder[pageIdx];
    newOrder[pageIdx] = newOrder[pageIdx - 1];
    newOrder[pageIdx - 1] = temp;
    await applyPageReorder(newOrder, pageIdx);
  };

  const handleMovePageDown = async (pageIdx: number) => {
    if (pageIdx >= numPages - 1 || !pdfBytes) return;
    const newOrder = Array.from({ length: numPages }, (_, i) => i);
    const temp = newOrder[pageIdx];
    newOrder[pageIdx] = newOrder[pageIdx + 1];
    newOrder[pageIdx + 1] = temp;
    await applyPageReorder(newOrder, pageIdx + 2);
  };

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
    setEditFontSize(existing?.fontSize || item.fontSize || 14);
    setEditFontColor(existing?.fontColor || '#000000');
    setEditFontFamily(existing?.fontFamily || 'Helvetica');
    setEditFontWeight(existing?.fontWeight || 'normal');
    setEditFontStyle(existing?.fontStyle || 'normal');
    setEditTextAlign(existing?.textAlign || 'left');
    setRightTab('inspector');
    if (!isRightPanelOpen) setIsRightPanelOpen(true);
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
      fontFamily: editFontFamily,
      fontWeight: editFontWeight,
      fontStyle: editFontStyle,
      textAlign: editTextAlign,
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
    setStatusMessage('Selected text removed with opaque clean patch');
  };

  const handleRedactSelectedText = () => {
    if (!selectedTextItem) return;
    saveToHistory();

    // 1. Mark underlying text as deleted & redacted
    const redactEdit: PdfTextEdit = {
      id: selectedTextItem.id,
      pageIndex: currentPage - 1,
      originalText: selectedTextItem.str,
      newText: '',
      pdfX: selectedTextItem.pdfX,
      pdfY: selectedTextItem.pdfY,
      width: selectedTextItem.width / zoomScale,
      height: selectedTextItem.height / zoomScale,
      isDeleted: true,
      isRedaction: true,
    };
    setTextEdits((prev) => ({ ...prev, [selectedTextItem.id]: redactEdit }));

    // 2. Place opaque black redaction box annotation
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
        text: selectedTextItem.str,
      },
    ]);

    setSelectedTextItem(null);
    setEditingTextId(null);
    setStatusMessage('Target text redacted & added to stream scrubbing queue');
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
          width: 120,
          height: 80,
          color: '#3b82f6',
        },
      ]);
    } else if (activeTool === 'comment') {
      const comment = prompt('Enter your document review comment:', 'Review feedback');
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
          },
        ]);
      }
    }

    setActiveTool('select');
  };

  // Signature drawing pad
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
    ctx.strokeStyle = '#000000';
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
        x: 50,
        y: 100,
        width: 150,
        height: 60,
        dataUrl,
      },
    ]);

    setIsSignatureModalOpen(false);
    setStatusMessage('Signature stamp attached to page. Drag or position as desired.');
  };

  const handleInsertImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      saveToHistory();
      setAnnotations((prev) => [
        ...prev,
        {
          id: `img-${Date.now()}`,
          pageIndex: currentPage - 1,
          type: 'image',
          x: 60,
          y: 80,
          width: 180,
          height: 120,
          dataUrl,
        },
      ]);
      setStatusMessage(`Image "${file.name}" placed on page`);
    };
    reader.readAsDataURL(file);
  };

  // Export & Save with verified destructive redaction + zero-leak verification
  const handleExportPdf = async () => {
    if (!pdfBytes) return;
    try {
      setIsProcessing(true);
      setStatusMessage('Applying text replacements, redactions, and annotations...');

      const textEditsArray = Object.values(textEdits);
      let modifiedBytes = await applyPdfModifications(pdfBytes, annotations, {
        watermarkText: watermarkText.trim() || undefined,
        addPageNumbers,
        textEdits: textEditsArray,
      });

      // Collect all redactions for destructive sanitization
      const redactionTargets: RedactionTarget[] = [];
      annotations.filter((a) => a.type === 'redact').forEach((a) => {
        redactionTargets.push({
          pageNumber: a.pageIndex + 1,
          x: a.x,
          y: a.y,
          width: a.width || 120,
          height: a.height || 24,
          textToRedact: a.text,
        });
      });
      textEditsArray.filter((e) => e.isRedaction || e.isDeleted).forEach((e) => {
        redactionTargets.push({
          pageNumber: e.pageIndex + 1,
          x: e.pdfX,
          y: e.pdfY,
          width: e.width,
          height: e.height,
          textToRedact: e.originalText,
        });
      });

      let zeroLeakVerified = false;
      if (redactionTargets.length > 0) {
        setStatusMessage('Executing verified destructive redaction & metadata clearing...');
        const sanitizationResult = await sanitizeAndRedactPdf(modifiedBytes, redactionTargets);
        modifiedBytes = sanitizationResult.pdfBytes;
        zeroLeakVerified = !sanitizationResult.report.residualTextFound;
      }

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
      setStatusMessage(
        `Verified: ${verifyReport.pageCount} pages.${zeroLeakVerified ? ' Zero-leak verification confirmed.' : ''} Download started.`
      );
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

  // Structural Diagnostic computations for current page
  const pageFontNames = Array.from(new Set(pageTextItems.map((i) => i.fontName).filter(Boolean)));
  const isScannedOrRasterPage = pageTextItems.length === 0;
  const hasType3Fonts = pageFontNames.some((f) => (f || '').toLowerCase().includes('type3') || (f || '').toLowerCase().includes('raster'));
  const activePageAnnotations = annotations.filter((a) => a.pageIndex === currentPage - 1);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#080B18]/60 text-[#F4F5FF]">
      {/* 1. Primary Top Navigation & File Bar */}
      <div className="h-14 border-b border-white/10 bg-[#11152A]/85 backdrop-blur-2xl px-4 flex items-center justify-between shrink-0 gap-3 overflow-x-auto">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            className="bg-transparent text-sm font-bold text-[#F4F5FF] border-b border-transparent hover:border-white/20 focus:border-[#8B7CFF] px-1 py-0.5 outline-none w-44 md:w-60 transition-colors"
            placeholder="Document Name"
          />
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30 whitespace-nowrap">
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
          {/* Panel toggles */}
          <button
            onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${isLeftPanelOpen ? 'bg-[#8B7CFF]/20 text-[#8B7CFF] border-[#8B7CFF]/30' : 'glass-card text-[#9BA3BD] hover:text-[#F4F5FF]'
              }`}
            title={isLeftPanelOpen ? 'Collapse Left Panel' : 'Expand Left Panel'}
          >
            {isLeftPanelOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setActiveTool(activeTool === 'text' ? 'select' : 'text')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${activeTool === 'text' ? 'bg-[#8B7CFF]/25 text-[#F4F5FF] border border-[#8B7CFF]/40 glow-purple' : 'hover:bg-white/[0.06] text-[#9BA3BD]'
              }`}
            title="Add new text note"
          >
            <Type className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Add Text</span>
          </button>

          <button
            onClick={() => setActiveTool(activeTool === 'highlight' ? 'select' : 'highlight')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${activeTool === 'highlight' ? 'bg-amber-400/25 text-amber-300 border border-amber-400/40' : 'hover:bg-white/[0.06] text-[#9BA3BD]'
              }`}
            title="Highlight region"
          >
            <Highlighter className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Highlight</span>
          </button>

          <button
            onClick={() => setActiveTool(activeTool === 'redact' ? 'select' : 'redact')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${activeTool === 'redact' ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40 glow-rose' : 'hover:bg-white/[0.06] text-[#9BA3BD]'
              }`}
            title="True Redaction: Blackout + Stream Scrubbing"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden md:inline">Redact</span>
          </button>

          <button
            onClick={() => setActiveTool(activeTool === 'underline' ? 'select' : 'underline')}
            className={`p-1.5 rounded-xl transition-all cursor-pointer ${activeTool === 'underline' ? 'bg-[#42D6E8]/25 text-[#42D6E8] border border-[#42D6E8]/40' : 'hover:bg-white/[0.06] text-[#9BA3BD]'
              }`}
            title="Underline"
          >
            <UnderlineIcon className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveTool(activeTool === 'strikethrough' ? 'select' : 'strikethrough')}
            className={`p-1.5 rounded-xl transition-all cursor-pointer ${activeTool === 'strikethrough' ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40' : 'hover:bg-white/[0.06] text-[#9BA3BD]'
              }`}
            title="Strikethrough"
          >
            <StrikeIcon className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setActiveTool(activeTool === 'rectangle' ? 'select' : 'rectangle')}
            className={`p-1.5 rounded-xl transition-all cursor-pointer ${activeTool === 'rectangle' ? 'bg-white/20 text-[#F4F5FF]' : 'hover:bg-white/[0.06] text-[#9BA3BD]'
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
            <span className="hidden lg:inline">Sign</span>
          </button>

          <label className="flex items-center gap-1 px-2 py-1 rounded-xl hover:bg-white/[0.06] text-[#9BA3BD] hover:text-[#F4F5FF] cursor-pointer transition-colors">
            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden lg:inline">Image</span>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleInsertImage} />
          </label>

          <button
            onClick={() => setActiveTool(activeTool === 'comment' ? 'select' : 'comment')}
            className={`p-1.5 rounded-xl transition-all cursor-pointer ${activeTool === 'comment' ? 'bg-amber-400/25 text-amber-300 border border-amber-400/40' : 'hover:bg-white/[0.06] text-[#9BA3BD]'
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
            className={`px-2 py-1 rounded-xl text-xs cursor-pointer transition-colors hidden sm:flex items-center gap-1 ${watermarkText ? 'bg-[#8B7CFF]/20 text-[#8B7CFF] border border-[#8B7CFF]/40' : 'hover:bg-white/[0.06] text-[#9BA3BD]'
              }`}
          >
            <Stamp className="w-3.5 h-3.5 inline" />
            <span>{watermarkText ? `"${watermarkText}"` : 'Watermark'}</span>
          </button>

          <button
            onClick={() => setAddPageNumbers(!addPageNumbers)}
            className={`px-2 py-1 rounded-xl text-xs cursor-pointer transition-colors hidden sm:block ${addPageNumbers ? 'bg-[#42D6E8]/20 text-[#42D6E8] border border-[#42D6E8]/40' : 'hover:bg-white/[0.06] text-[#9BA3BD]'
              }`}
          >
            <span>Pg #{addPageNumbers ? ': ON' : ''}</span>
          </button>
        </div>

        {/* Right Search, Zoom & Panel Toggle */}
        <div className="flex items-center gap-2">
          {/* In-PDF Search */}
          <div className="flex items-center glass-card border-white/10 rounded-xl px-2.5 py-1 gap-1.5 text-xs text-[#F4F5FF]">
            <Search className="w-3.5 h-3.5 text-[#42D6E8]" />
            <input
              type="text"
              placeholder="Search PDF..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none w-20 md:w-32 text-xs text-[#F4F5FF] placeholder:text-[#9BA3BD]/60"
            />
            {searchQuery && (
              <span className="text-[10px] text-[#42D6E8] font-mono font-bold">
                {searchResultsCount}
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
            <button
              onClick={() => setZoomScale(1.25)}
              className="px-1.5 font-mono text-[11px] text-[#F4F5FF] hover:text-[#8B7CFF] transition-colors"
              title="Reset Zoom"
            >
              {Math.round(zoomScale * 100)}%
            </button>
            <button
              onClick={() => setZoomScale((s) => Math.min(2.5, s + 0.2))}
              className="p-1 hover:text-[#F4F5FF] cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${isRightPanelOpen ? 'bg-[#8B7CFF]/20 text-[#8B7CFF] border-[#8B7CFF]/30' : 'glass-card text-[#9BA3BD] hover:text-[#F4F5FF]'
              }`}
            title={isRightPanelOpen ? 'Collapse Right Inspector' : 'Expand Right Inspector'}
          >
            {isRightPanelOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 3. Main 3-Panel Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* ========================================================= */}
        {/* LEFT PANEL: Thumbnails, Reordering & Document Outline   */}
        {/* ========================================================= */}
        {isLeftPanelOpen && pdfJsDoc && (
          <div className="w-56 border-r border-white/10 bg-[#11152A]/50 backdrop-blur-xl flex flex-col shrink-0 custom-scrollbar animate-in slide-in-from-left duration-200">
            {/* Left Tabs: Pages / Outline */}
            <div className="flex items-center border-b border-white/10 px-2 pt-2 gap-1 bg-[#080B18]/30">
              <button
                onClick={() => setLeftTab('pages')}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-t-lg transition-colors flex items-center justify-center gap-1.5 ${leftTab === 'pages'
                    ? 'bg-[#11152A]/80 text-[#8B7CFF] border-t-2 border-[#8B7CFF]'
                    : 'text-[#9BA3BD] hover:text-[#F4F5FF]'
                  }`}
              >
                <Layers className="w-3 h-3" />
                <span>Pages ({numPages})</span>
              </button>
              <button
                onClick={() => setLeftTab('outline')}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-t-lg transition-colors flex items-center justify-center gap-1.5 ${leftTab === 'outline'
                    ? 'bg-[#11152A]/80 text-[#8B7CFF] border-t-2 border-[#8B7CFF]'
                    : 'text-[#9BA3BD] hover:text-[#F4F5FF]'
                  }`}
              >
                <ListTree className="w-3 h-3" />
                <span>Bookmarks</span>
              </button>
            </div>

            {leftTab === 'pages' ? (
              <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                <div className="flex items-center justify-between pb-1 border-b border-white/10">
                  <span className="text-[10px] font-bold text-[#9BA3BD] uppercase tracking-wider">Page Order</span>
                  <button
                    onClick={handleInsertBlankPage}
                    className="p-1 rounded-lg glass-card hover:border-[#8B7CFF]/50 text-[#9BA3BD] hover:text-[#F4F5FF] transition-all flex items-center gap-1 text-[10px] px-2"
                    title="Insert Blank Page after active page"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Blank</span>
                  </button>
                </div>

                {Array.from({ length: numPages }, (_, i) => i + 1).map((pNum, idx) => (
                  <div
                    key={pNum}
                    onClick={() => setCurrentPage(pNum)}
                    className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${currentPage === pNum
                        ? 'border-[#8B7CFF]/60 bg-[#8B7CFF]/15 shadow-lg shadow-[#8B7CFF]/20 glow-purple'
                        : 'border-white/10 glass-card hover:border-white/20'
                      }`}
                  >
                    <div className="text-xs font-bold text-[#F4F5FF] mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-white/10 text-[10px] flex items-center justify-center">
                          {pNum}
                        </span>
                        <span>Page {pNum}</span>
                      </span>
                      {currentPage === pNum && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#8B7CFF] glow-purple" />
                      )}
                    </div>

                    {/* Reorder and Page Operation Controls */}
                    <div className="flex items-center justify-between gap-1 text-[#9BA3BD] pt-1 border-t border-white/5">
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMovePageUp(idx);
                          }}
                          disabled={idx === 0}
                          className="p-1 rounded hover:bg-white/10 disabled:opacity-20 hover:text-[#F4F5FF] transition-colors"
                          title="Move page up"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMovePageDown(idx);
                          }}
                          disabled={idx === numPages - 1}
                          className="p-1 rounded hover:bg-white/10 disabled:opacity-20 hover:text-[#F4F5FF] transition-colors"
                          title="Move page down"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRotateCurrentPage(pNum - 1, 90);
                          }}
                          className="p-1 rounded hover:bg-white/10 hover:text-[#F4F5FF] transition-colors"
                          title="Rotate 90°"
                        >
                          <RotateCw className="w-3 h-3" />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateCurrentPage(pNum - 1);
                          }}
                          className="p-1 rounded hover:bg-white/10 hover:text-[#F4F5FF] transition-colors"
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
                            className="p-1 rounded hover:bg-rose-500/20 text-[#9BA3BD] hover:text-rose-400 transition-colors"
                            title="Delete page"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar text-xs">
                {outlineItems.length === 0 ? (
                  <div className="text-center py-8 text-[#9BA3BD] space-y-2">
                    <ListTree className="w-8 h-8 mx-auto opacity-40 text-[#8B7CFF]" />
                    <p className="text-[11px]">No bookmarks or table of contents found in this PDF.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {outlineItems.map((item, i) => (
                      <button
                        key={i}
                        onClick={async () => {
                          if (item.dest && pdfJsDoc) {
                            try {
                              let explicitDest = item.dest;
                              if (typeof explicitDest === 'string') {
                                explicitDest = await pdfJsDoc.getDestination(explicitDest);
                              }
                              if (Array.isArray(explicitDest) && explicitDest.length > 0) {
                                const ref = explicitDest[0];
                                if (typeof ref === 'object' && ref !== null) {
                                  const pIdx = await pdfJsDoc.getPageIndex(ref);
                                  setCurrentPage(pIdx + 1);
                                } else if (typeof ref === 'number') {
                                  setCurrentPage(ref + 1);
                                }
                              }
                            } catch (e) {
                              console.warn('Navigation failed:', e);
                            }
                          }
                        }}
                        className="w-full text-left p-2 rounded-xl glass-card hover:border-[#8B7CFF]/50 text-[#F4F5FF] transition-all block truncate text-[11px]"
                        title={item.title}
                      >
                        • {item.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* CENTER PANEL: Large Canvas Viewport & Interactive Layer   */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center items-start bg-[#080B18]/60 custom-scrollbar relative">
          {!pdfJsDoc ? (
            <div className="max-w-md w-full my-auto text-center p-8 rounded-[24px] glass-panel border border-dashed border-white/15 space-y-4 shadow-2xl">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 glow-rose">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#F4F5FF]">No PDF Loaded</h3>
                <p className="text-xs text-[#9BA3BD] mt-1 leading-relaxed">
                  Upload an existing PDF document to edit text, apply verified destructive redactions, add signatures, and reorganize pages in the 3-panel studio.
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
              {/* Interactive Tool Banner */}
              {activeTool !== 'select' && (
                <div className="absolute top-3 left-3 z-30 px-3 py-1 rounded-full bg-slate-900/90 text-white text-[11px] font-semibold border border-indigo-500/40 shadow-lg flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                  <span>Click on document to place {activeTool}</span>
                </div>
              )}

              {/* Rendered Canvas */}
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className={`block ${activeTool !== 'select' ? 'cursor-crosshair' : 'cursor-default'}`}
              />

              {/* Interactive PDF Text Layer */}
              <div className="absolute inset-0 z-10 pointer-events-auto">
                {pageTextItems.map((item) => {
                  const edit = textEdits[item.id];
                  const isEditing = editingTextId === item.id;
                  const isSelected = selectedTextItem?.id === item.id;
                  const displayText = edit ? (edit.isDeleted ? '' : edit.newText) : item.str;
                  const isDeleted = edit?.isDeleted;
                  const isRedaction = edit?.isRedaction;

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
                          backgroundColor: isRedaction ? '#000000' : '#ffffff',
                        }}
                        className={isRedaction ? 'opacity-100' : 'opacity-95'}
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
                      className={`group transition-all select-text cursor-pointer ${isSelected ? 'ring-2 ring-indigo-500 z-20' : 'hover:bg-blue-500/15'
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
                      {/* Floating Aurora Glass Formatting Bar matching reference image */}
                      {(isSelected || isEditing) && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute -top-11 left-0 z-30 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#11152A]/90 backdrop-blur-2xl border border-white/20 shadow-2xl text-xs text-[#F4F5FF] select-none pointer-events-auto"
                        >
                          <button
                            onClick={() => setEditFontWeight(editFontWeight === 'bold' ? 'normal' : 'bold')}
                            className={`w-6 h-6 rounded-lg font-bold flex items-center justify-center transition-colors ${
                              editFontWeight === 'bold' ? 'bg-[#8B7CFF]/30 text-[#8B7CFF]' : 'hover:bg-white/10 text-[#9BA3BD]'
                            }`}
                            title="Bold"
                          >
                            B
                          </button>
                          <button
                            onClick={() => setEditFontStyle(editFontStyle === 'italic' ? 'normal' : 'italic')}
                            className={`w-6 h-6 rounded-lg italic flex items-center justify-center transition-colors ${
                              editFontStyle === 'italic' ? 'bg-[#8B7CFF]/30 text-[#8B7CFF]' : 'hover:bg-white/10 text-[#9BA3BD]'
                            }`}
                            title="Italic"
                          >
                            I
                          </button>
                          <button
                            className="w-6 h-6 rounded-lg underline flex items-center justify-center hover:bg-white/10 text-[#9BA3BD] transition-colors"
                            title="Underline"
                          >
                            U
                          </button>

                          <div className="h-3.5 w-px bg-white/20 mx-1" />

                          {/* Font Family Selector */}
                          <select
                            value={editFontFamily}
                            onChange={(e) => setEditFontFamily(e.target.value as any)}
                            className="bg-transparent text-[11px] font-semibold text-[#F4F5FF] outline-none cursor-pointer pr-1"
                          >
                            <option value="Helvetica" className="bg-[#11152A] text-white">Inter</option>
                            <option value="TimesRoman" className="bg-[#11152A] text-white">Times</option>
                            <option value="Courier" className="bg-[#11152A] text-white">Courier</option>
                          </select>

                          <div className="h-3.5 w-px bg-white/20 mx-1" />

                          {/* Font Size Selector */}
                          <select
                            value={editFontSize}
                            onChange={(e) => setEditFontSize(parseInt(e.target.value))}
                            className="bg-transparent text-[11px] font-semibold text-[#F4F5FF] outline-none cursor-pointer"
                          >
                            <option value="12" className="bg-[#11152A] text-white">12</option>
                            <option value="14" className="bg-[#11152A] text-white">14</option>
                            <option value="16" className="bg-[#11152A] text-white">16</option>
                            <option value="18" className="bg-[#11152A] text-white">18</option>
                            <option value="24" className="bg-[#11152A] text-white">24</option>
                          </select>
                        </div>
                      )}

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
                            textAlign: editTextAlign,
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: `${(edit?.fontSize || item.fontSize) * (zoomScale / 1.25)}px`,
                            color: edit ? (edit.fontColor || '#000000') : 'transparent',
                            fontWeight: edit?.fontWeight || 'normal',
                            fontStyle: edit?.fontStyle || 'normal',
                            textAlign: edit?.textAlign || 'left',
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

              {/* Dynamic Annotations Layer */}
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

        {/* ========================================================= */}
        {/* RIGHT PANEL: Inspector, Annotations & Structural Detector */}
        {/* ========================================================= */}
        {isRightPanelOpen && pdfJsDoc && (
          <div className="w-72 border-l border-white/10 bg-[#11152A]/60 backdrop-blur-2xl flex flex-col shrink-0 custom-scrollbar animate-in slide-in-from-right duration-200">
            {/* Right Tabs */}
            <div className="flex items-center border-b border-white/10 px-2 pt-2 gap-1 bg-[#080B18]/30">
              <button
                onClick={() => setRightTab('inspector')}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-t-lg transition-colors flex items-center justify-center gap-1 ${rightTab === 'inspector'
                    ? 'bg-[#11152A]/90 text-[#8B7CFF] border-t-2 border-[#8B7CFF]'
                    : 'text-[#9BA3BD] hover:text-[#F4F5FF]'
                  }`}
              >
                <Sliders className="w-3 h-3" />
                <span>Properties</span>
              </button>
              <button
                onClick={() => setRightTab('annotations')}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-t-lg transition-colors flex items-center justify-center gap-1 ${rightTab === 'annotations'
                    ? 'bg-[#11152A]/90 text-[#8B7CFF] border-t-2 border-[#8B7CFF]'
                    : 'text-[#9BA3BD] hover:text-[#F4F5FF]'
                  }`}
              >
                <Layers className="w-3 h-3" />
                <span>Annos ({activePageAnnotations.length})</span>
              </button>
              <button
                onClick={() => setRightTab('diagnostics')}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-t-lg transition-colors flex items-center justify-center gap-1 ${rightTab === 'diagnostics'
                    ? 'bg-[#11152A]/90 text-[#42D6E8] border-t-2 border-[#42D6E8]'
                    : 'text-[#9BA3BD] hover:text-[#F4F5FF]'
                  }`}
              >
                <Cpu className="w-3 h-3" />
                <span>Structure</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
              {/* TAB 1: PROPERTIES / INSPECTOR */}
              {rightTab === 'inspector' && (
                <>
                  {selectedTextItem ? (
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between pb-1 border-b border-white/10">
                        <span className="text-[11px] font-bold text-[#8B7CFF] uppercase tracking-wider">
                          Selected Text Run
                        </span>
                        <button
                          onClick={() => setSelectedTextItem(null)}
                          className="p-1 rounded-lg hover:bg-white/10 text-[#9BA3BD] hover:text-[#F4F5FF]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Text Replacement Input */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#9BA3BD] uppercase tracking-wider font-semibold">
                          Replacement Text
                        </label>
                        <textarea
                          rows={2}
                          value={editDraftText}
                          onChange={(e) => setEditDraftText(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-xl glass-input text-[#F4F5FF] text-xs resize-none outline-none focus:border-[#8B7CFF]"
                          placeholder="Edit text..."
                        />
                      </div>

                      {/* Font Family */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#9BA3BD] uppercase tracking-wider font-semibold">
                          Font Family
                        </label>
                        <select
                          value={editFontFamily}
                          onChange={(e) => setEditFontFamily(e.target.value as any)}
                          className="w-full px-2 py-1.5 rounded-xl glass-input text-[#F4F5FF] text-xs outline-none bg-[#11152A]"
                        >
                          <option value="Helvetica">Helvetica (Sans-Serif)</option>
                          <option value="TimesRoman">Times Roman (Serif)</option>
                          <option value="Courier">Courier (Monospace)</option>
                        </select>
                      </div>

                      {/* Font Size & Weight & Style */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-[#9BA3BD] uppercase tracking-wider font-semibold">
                            Size (pt)
                          </label>
                          <input
                            type="number"
                            min={6}
                            max={72}
                            value={editFontSize}
                            onChange={(e) => setEditFontSize(Number(e.target.value))}
                            className="w-full px-2 py-1.5 rounded-xl glass-input text-[#F4F5FF] text-xs text-center"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-[#9BA3BD] uppercase tracking-wider font-semibold">
                            Style
                          </label>
                          <div className="flex items-center gap-1 pt-0.5">
                            <button
                              onClick={() => setEditFontWeight(editFontWeight === 'bold' ? 'normal' : 'bold')}
                              className={`flex-1 py-1 rounded-lg font-bold border transition-all ${editFontWeight === 'bold'
                                  ? 'bg-[#8B7CFF] text-[#080B18] border-[#8B7CFF]'
                                  : 'glass-card border-white/10 text-[#9BA3BD]'
                                }`}
                            >
                              B
                            </button>
                            <button
                              onClick={() => setEditFontStyle(editFontStyle === 'italic' ? 'normal' : 'italic')}
                              className={`flex-1 py-1 rounded-lg italic font-serif border transition-all ${editFontStyle === 'italic'
                                  ? 'bg-[#8B7CFF] text-[#080B18] border-[#8B7CFF]'
                                  : 'glass-card border-white/10 text-[#9BA3BD]'
                                }`}
                            >
                              I
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Text Alignment */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#9BA3BD] uppercase tracking-wider font-semibold">
                          Alignment
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditTextAlign('left')}
                            className={`flex-1 py-1 rounded-lg flex items-center justify-center border transition-all ${editTextAlign === 'left' ? 'bg-[#8B7CFF]/20 text-[#8B7CFF] border-[#8B7CFF]/40' : 'glass-card border-white/10 text-[#9BA3BD]'
                              }`}
                          >
                            <AlignLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditTextAlign('center')}
                            className={`flex-1 py-1 rounded-lg flex items-center justify-center border transition-all ${editTextAlign === 'center' ? 'bg-[#8B7CFF]/20 text-[#8B7CFF] border-[#8B7CFF]/40' : 'glass-card border-white/10 text-[#9BA3BD]'
                              }`}
                          >
                            <AlignCenter className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditTextAlign('right')}
                            className={`flex-1 py-1 rounded-lg flex items-center justify-center border transition-all ${editTextAlign === 'right' ? 'bg-[#8B7CFF]/20 text-[#8B7CFF] border-[#8B7CFF]/40' : 'glass-card border-white/10 text-[#9BA3BD]'
                              }`}
                          >
                            <AlignRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Font Color */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#9BA3BD] uppercase tracking-wider font-semibold">
                          Color
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editFontColor}
                            onChange={(e) => setEditFontColor(e.target.value)}
                            className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer shrink-0"
                          />
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {['#000000', '#334155', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6'].map((c) => (
                              <button
                                key={c}
                                onClick={() => setEditFontColor(c)}
                                style={{ backgroundColor: c }}
                                className="w-5 h-5 rounded-md border border-white/20 transition-transform hover:scale-110"
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="space-y-2 pt-2 border-t border-white/10">
                        <button
                          onClick={commitTextEdit}
                          className="w-full py-2 rounded-xl glass-btn-primary font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-[#8B7CFF]/20"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Apply Text Modification</span>
                        </button>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={handleRedactSelectedText}
                            className="py-1.5 px-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                            title="Destructive blackout + stream scrubbing"
                          >
                            <ShieldAlert className="w-3 h-3" />
                            <span>Redact</span>
                          </button>
                          <button
                            onClick={handleDeleteSelectedText}
                            className="py-1.5 px-2 rounded-xl glass-card hover:bg-rose-500/20 text-[#9BA3BD] hover:text-rose-400 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                            title="Remove text"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-3.5 rounded-2xl glass-card border-white/10 space-y-2">
                        <div className="flex items-center gap-2 text-[#8B7CFF] font-bold text-xs">
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Document Overview</span>
                        </div>
                        <div className="space-y-1.5 text-[11px] text-[#9BA3BD]">
                          <div className="flex justify-between">
                            <span>File Name:</span>
                            <span className="text-[#F4F5FF] font-medium truncate max-w-[120px]">{fileName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total Pages:</span>
                            <span className="text-[#F4F5FF] font-medium">{numPages}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Active Page:</span>
                            <span className="text-[#8B7CFF] font-bold">Page {currentPage}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Text Elements:</span>
                            <span className="text-[#42D6E8] font-bold">{pageTextItems.length}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl glass-card border-dashed border-white/15 text-[#9BA3BD] space-y-1.5 text-center">
                        <p className="font-semibold text-[#F4F5FF] text-[11px]">Select Text to Edit</p>
                        <p className="text-[10px] leading-relaxed">
                          Click or double-click any word or phrase on the document canvas to open typography controls and destructive redaction.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* TAB 2: ANNOTATIONS LIST */}
              {rightTab === 'annotations' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-white/10">
                    <span className="text-[11px] font-bold text-[#8B7CFF] uppercase tracking-wider">
                      Page {currentPage} Annotations
                    </span>
                    {activePageAnnotations.length > 0 && (
                      <button
                        onClick={() => {
                          saveToHistory();
                          setAnnotations((prev) => prev.filter((a) => a.pageIndex !== currentPage - 1));
                        }}
                        className="text-[10px] text-rose-400 hover:underline"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {activePageAnnotations.length === 0 ? (
                    <div className="text-center py-6 text-[#9BA3BD] space-y-1.5">
                      <Layers className="w-6 h-6 mx-auto opacity-40 text-[#8B7CFF]" />
                      <p className="text-[11px]">No annotations on this page.</p>
                      <p className="text-[10px]">Use the top toolbar to place highlights, text, or redactions.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activePageAnnotations.map((ann) => (
                        <div
                          key={ann.id}
                          className="p-2.5 rounded-xl glass-card border-white/10 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${ann.type === 'redact' ? 'bg-rose-500/20 text-rose-300' :
                                ann.type === 'highlight' ? 'bg-amber-400/20 text-amber-300' :
                                  ann.type === 'signature' ? 'bg-purple-500/20 text-purple-300' :
                                    'bg-blue-500/20 text-blue-300'
                              }`}>
                              {ann.type}
                            </span>
                            <span className="text-[11px] text-[#F4F5FF] truncate">
                              {ann.text || `${Math.round(ann.x)}, ${Math.round(ann.y)}`}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              saveToHistory();
                              setAnnotations((prev) => prev.filter((a) => a.id !== ann.id));
                            }}
                            className="p-1 rounded hover:bg-rose-500/20 text-[#9BA3BD] hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: STRUCTURAL LIMITATION DETECTOR */}
              {rightTab === 'diagnostics' && (
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2 pb-1 border-b border-white/10">
                    <Cpu className="w-3.5 h-3.5 text-[#42D6E8]" />
                    <span className="text-[11px] font-bold text-[#42D6E8] uppercase tracking-wider">
                      Structural Limitation Detector
                    </span>
                  </div>

                  {/* Classification Card */}
                  <div className={`p-3 rounded-2xl border ${isScannedOrRasterPage
                      ? 'border-amber-500/40 bg-amber-500/10'
                      : 'border-emerald-500/40 bg-emerald-500/10'
                    }`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      {isScannedOrRasterPage ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                      <span className="font-bold text-xs text-[#F4F5FF]">
                        {isScannedOrRasterPage ? 'Raster Scanned Page' : 'Selectable Vector Text Stream'}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#9BA3BD] leading-relaxed">
                      {isScannedOrRasterPage
                        ? 'This page contains flat raster bitmap image streams. Vector text spans cannot be directly edited. Use OCR in OmniDoc to transcribe this scanned page before vector replacement.'
                        : `Found ${pageTextItems.length} selectable text runs on Page ${currentPage}. In-place vector replacement and redaction are fully supported.`}
                    </p>
                  </div>

                  {/* Fonts Detected */}
                  <div className="p-3 rounded-2xl glass-card border-white/10 space-y-2">
                    <span className="text-[10px] font-bold text-[#9BA3BD] uppercase tracking-wider block">
                      Detected Fonts on Page
                    </span>
                    {pageFontNames.length === 0 ? (
                      <span className="text-[11px] text-[#9BA3BD] italic">No font streams embedded</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {pageFontNames.map((fn, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-mono text-[#F4F5FF]"
                          >
                            {fn}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Type 3 Warning */}
                  {hasType3Fonts && (
                    <div className="p-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 space-y-1">
                      <div className="flex items-center gap-1.5 text-rose-300 font-bold text-[11px]">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Type3 Custom Glyph Stream</span>
                      </div>
                      <p className="text-[10px] text-[#9BA3BD] leading-relaxed">
                        This page utilizes embedded Type3 or rasterized glyph sets without standard Unicode mapping. Direct editing may substitute with standard Helvetica/Times.
                      </p>
                    </div>
                  )}

                  {/* Technical Integrity Disclosure */}
                  <div className="p-3 rounded-2xl glass-card border-white/5 text-[10px] text-[#9BA3BD] space-y-1.5">
                    <span className="font-bold text-[#F4F5FF] block">Architectural Honesty Disclosure</span>
                    <p className="leading-relaxed">
                      PDF is a fixed-geometry output format, not a reflowing document like HTML or DOCX. OmniDoc Studio applies sub-pixel vector patches and permanent stream redactions with zero-leak verification, preserving document layout fidelity without degrading print quality.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
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
