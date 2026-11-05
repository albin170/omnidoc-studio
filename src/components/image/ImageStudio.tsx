import React, { useEffect, useRef, useState } from 'react';
import { 
  Upload, 
  DownloadCloud, 
  Scissors, 
  Sparkles, 
  Sliders, 
  Type, 
  Palette, 
  Save, 
  Layers,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Crop as CropIcon,
  Maximize2,
  Eraser,
  Check,
  X,
  Undo
} from 'lucide-react';
import { ImageAdjustments, ImageLayer } from '../../types';
import { 
  applyAdjustmentsToCanvas, 
  convertImageToPdf, 
  removeBackgroundAlgorithm, 
  renderLayersOnCanvas,
  rotateCanvas,
  flipCanvas,
  cropCanvas,
  resizeCanvas
} from '../../services/imageService';
import saveAs from 'file-saver';
import confetti from 'canvas-confetti';

interface ImageStudioProps {
  initialFile?: File | null;
  onSaveToProjects?: (title: string, data: any) => void;
}

export const ImageStudio: React.FC<ImageStudioProps> = ({
  initialFile,
  onSaveToProjects,
}) => {
  const [imageName, setImageName] = useState('photo_edit.png');
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [hasBackgroundRemoved, setHasBackgroundRemoved] = useState(false);
  const [bgReplacementType, setBgReplacementType] = useState<'transparent' | 'color' | 'gradient'>('transparent');
  const [bgValue, setBgValue] = useState<string>('#ffffff');

  // Adjustments
  const [adjustments, setAdjustments] = useState<ImageAdjustments>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    grayscale: 0,
    sepia: 0,
    invert: 0,
  });

  // Layers (text, stickers)
  const [layers, setLayers] = useState<ImageLayer[]>([]);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpg' | 'webp' | 'pdf'>('png');
  const [isProcessing, setIsProcessing] = useState(false);

  // Resize Modal State
  const [showResizeModal, setShowResizeModal] = useState(false);
  const [resizeWidth, setResizeWidth] = useState<number>(800);
  const [resizeHeight, setResizeHeight] = useState<number>(600);
  const [lockAspectRatio, setLockAspectRatio] = useState(true);

  // Crop Mode State
  const [isCropActive, setIsCropActive] = useState(false);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 10,
    y: 10,
    w: 80,
    h: 80,
  }); // percentage based 0-100

  // Erase Brush State
  const [isEraserActive, setIsEraserActive] = useState(false);
  const [eraserSize, setEraserSize] = useState<number>(24);
  const [isErasing, setIsErasing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<HTMLCanvasElement[]>([]);

  const loadImageFile = (file: File) => {
    setImageName(file.name);
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      setSourceImage(img);
      setResizeWidth(img.naturalWidth || 800);
      setResizeHeight(img.naturalHeight || 600);
      setHasBackgroundRemoved(false);
      processedCanvasRef.current = null;
      historyRef.current = [];
    };
    img.src = url;
  };

  const generateDemoArtwork = () => {
    const demo = document.createElement('canvas');
    demo.width = 800;
    demo.height = 600;
    const ctx = demo.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 800, 600);
    grad.addColorStop(0, '#312e81');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 600);

    ctx.beginPath();
    ctx.arc(400, 300, 140, 0, Math.PI * 2);
    ctx.fillStyle = '#6366f1';
    ctx.shadowColor = '#818cf8';
    ctx.shadowBlur = 40;
    ctx.fill();

    const img = new Image();
    img.onload = () => {
      setSourceImage(img);
      setResizeWidth(800);
      setResizeHeight(600);
    };
    img.src = demo.toDataURL();
  };

  // Load initial file or generate placeholder canvas
  useEffect(() => {
    if (initialFile) {
      loadImageFile(initialFile);
    } else {
      generateDemoArtwork();
    }
  }, [initialFile]);

  // Re-render canvas
  const renderCurrentCanvas = () => {
    if (!sourceImage || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const baseCanvas = processedCanvasRef.current;
    const targetW = baseCanvas ? baseCanvas.width : (sourceImage.naturalWidth || 800);
    const targetH = baseCanvas ? baseCanvas.height : (sourceImage.naturalHeight || 600);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d')!;

    // 1. Background
    if (bgReplacementType === 'color') {
      ctx.fillStyle = bgValue;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (bgReplacementType === 'gradient') {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#f97316');
      grad.addColorStop(1, '#ec4899');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Adjustments and image drawing
    ctx.save();
    applyAdjustmentsToCanvas(ctx, adjustments);

    if (baseCanvas) {
      ctx.drawImage(baseCanvas, 0, 0);
    } else {
      ctx.drawImage(sourceImage, 0, 0);
    }
    ctx.restore();

    // 3. Overlays
    renderLayersOnCanvas(ctx, layers);
  };

  useEffect(() => {
    renderCurrentCanvas();
  }, [sourceImage, adjustments, bgReplacementType, bgValue, layers]);

  const saveToHistory = () => {
    if (!canvasRef.current) return;
    const snapshot = document.createElement('canvas');
    snapshot.width = canvasRef.current.width;
    snapshot.height = canvasRef.current.height;
    const sctx = snapshot.getContext('2d')!;
    sctx.drawImage(canvasRef.current, 0, 0);
    historyRef.current.push(snapshot);
    if (historyRef.current.length > 10) historyRef.current.shift();
  };

  // Standout Feature: Remove Background
  const handleRemoveBackground = () => {
    if (!canvasRef.current) return;
    setIsProcessing(true);
    saveToHistory();

    setTimeout(() => {
      try {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvasRef.current!.width;
        tempCanvas.height = canvasRef.current!.height;
        const ctx = tempCanvas.getContext('2d')!;
        ctx.drawImage(canvasRef.current!, 0, 0);

        const cutoutCanvas = removeBackgroundAlgorithm(tempCanvas, 30);
        processedCanvasRef.current = cutoutCanvas;
        setHasBackgroundRemoved(true);
        setBgReplacementType('transparent');
        renderCurrentCanvas();
        confetti({ particleCount: 30, spread: 50 });
      } catch (err) {
        console.error('BG removal failed:', err);
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

  // Rotation
  const handleRotate = (degrees: number) => {
    if (!canvasRef.current) return;
    saveToHistory();
    const rotated = rotateCanvas(canvasRef.current, degrees);
    processedCanvasRef.current = rotated;
    setResizeWidth(rotated.width);
    setResizeHeight(rotated.height);
    renderCurrentCanvas();
  };

  // Flip
  const handleFlip = (horizontal: boolean, vertical: boolean) => {
    if (!canvasRef.current) return;
    saveToHistory();
    const flipped = flipCanvas(canvasRef.current, horizontal, vertical);
    processedCanvasRef.current = flipped;
    renderCurrentCanvas();
  };

  // Resize
  const handleApplyResize = () => {
    if (!canvasRef.current || resizeWidth <= 0 || resizeHeight <= 0) return;
    saveToHistory();
    const resized = resizeCanvas(canvasRef.current, resizeWidth, resizeHeight);
    processedCanvasRef.current = resized;
    setShowResizeModal(false);
    renderCurrentCanvas();
  };

  // Crop
  const handleApplyCrop = () => {
    if (!canvasRef.current) return;
    saveToHistory();
    const cw = canvasRef.current.width;
    const ch = canvasRef.current.height;

    const px = Math.round((cropRect.x / 100) * cw);
    const py = Math.round((cropRect.y / 100) * ch);
    const pw = Math.round((cropRect.w / 100) * cw);
    const ph = Math.round((cropRect.h / 100) * ch);

    const cropped = cropCanvas(canvasRef.current, px, py, pw, ph);
    processedCanvasRef.current = cropped;
    setResizeWidth(cropped.width);
    setResizeHeight(cropped.height);
    setIsCropActive(false);
    renderCurrentCanvas();
  };

  // Erase Brush event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEraserActive || !canvasRef.current) return;
    setIsErasing(true);
    saveToHistory();
    eraseAt(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEraserActive || !isErasing || !canvasRef.current) return;
    eraseAt(e);
  };

  const handleMouseUp = () => {
    if (isErasing) {
      setIsErasing(false);
      // Synchronize processed canvas with erased canvas
      if (canvasRef.current) {
        const copy = document.createElement('canvas');
        copy.width = canvasRef.current.width;
        copy.height = canvasRef.current.height;
        const ctx = copy.getContext('2d')!;
        ctx.drawImage(canvasRef.current, 0, 0);
        processedCanvasRef.current = copy;
      }
    }
  };

  const eraseAt = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const ctx = canvas.getContext('2d')!;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, eraserSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Add text layer
  const handleAddTextLayer = () => {
    const text = prompt('Enter text for overlay:', 'OmniDoc Studio');
    if (!text || !canvasRef.current) return;

    setLayers((prev) => [
      ...prev,
      {
        id: `layer-${Date.now()}`,
        type: 'text',
        text,
        x: canvasRef.current!.width / 4,
        y: canvasRef.current!.height / 2,
        fontSize: 36,
        fontColor: '#ffffff',
      },
    ]);
  };

  // Add sticker badge
  const handleAddSticker = () => {
    if (!canvasRef.current) return;
    setLayers((prev) => [
      ...prev,
      {
        id: `layer-${Date.now()}`,
        type: 'sticker',
        text: 'PRO CERTIFIED',
        x: canvasRef.current!.width / 2 - 80,
        y: canvasRef.current!.height / 4,
        bgColor: '#6366f1',
      },
    ]);
  };

  // Undo
  const handleUndo = () => {
    if (historyRef.current.length === 0) return;
    const previous = historyRef.current.pop()!;
    processedCanvasRef.current = previous;
    setResizeWidth(previous.width);
    setResizeHeight(previous.height);
    renderCurrentCanvas();
  };

  // Export
  const handleExport = async () => {
    if (!canvasRef.current) return;
    setIsProcessing(true);

    try {
      if (exportFormat === 'pdf') {
        const blob = await new Promise<Blob>((resolve) => {
          canvasRef.current!.toBlob((b) => resolve(b || new Blob([])), 'image/png');
        });
        const pdfBytes = await convertImageToPdf(blob, { pageSize: 'A4' });
        const pdfBlob = new Blob([pdfBytes as any], { type: 'application/pdf' });
        saveAs(pdfBlob, `${imageName.replace(/\.[^/.]+$/, '')}.pdf`);
      } else {
        const mime = exportFormat === 'jpg' ? 'image/jpeg' : `image/${exportFormat}`;
        canvasRef.current.toBlob((blob) => {
          if (blob) {
            saveAs(blob, `${imageName.replace(/\.[^/.]+$/, '')}.${exportFormat}`);
          }
        }, mime, 0.95);
      }

      confetti({ particleCount: 40, spread: 60 });
    } catch (err) {
      console.error('Image export failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      {/* Top Header */}
      <div className="h-14 border-b border-slate-800 bg-slate-900/90 px-4 flex items-center justify-between shrink-0 gap-3 overflow-x-auto">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={imageName}
            onChange={(e) => setImageName(e.target.value)}
            className="bg-transparent text-sm font-bold text-white border-b border-transparent hover:border-slate-700 focus:border-purple-500 px-1 py-0.5 outline-none w-48 md:w-60"
          />
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-semibold border border-purple-500/30">
            GRAPHICS STUDIO
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Open Photo</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && loadImageFile(e.target.files[0])} />
          </label>

          <button
            onClick={handleRemoveBackground}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/25 cursor-pointer"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Remove BG</span>
          </button>

          {onSaveToProjects && (
            <button
              onClick={() => onSaveToProjects(imageName, { adjustments, hasBackgroundRemoved, bgReplacementType, bgValue, layers })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
              title="Save Image Project"
            >
              <Save className="w-3.5 h-3.5 text-purple-400" />
              <span>Save</span>
            </button>
          )}

          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 text-xs">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as any)}
              className="bg-transparent text-slate-200 font-semibold px-2 py-1 outline-none uppercase text-xs cursor-pointer"
            >
              <option value="png">.PNG</option>
              <option value="jpg">.JPG</option>
              <option value="webp">.WEBP</option>
              <option value="pdf">.PDF</option>
            </select>
            <button
              onClick={handleExport}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-semibold cursor-pointer shadow-sm"
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Transform & Tool Ribbon */}
      <div className="h-11 border-b border-slate-800 bg-slate-900/60 px-4 flex items-center justify-between shrink-0 overflow-x-auto gap-2 text-xs text-slate-300">
        <div className="flex items-center gap-1.5">
          {/* Rotate */}
          <button
            onClick={() => handleRotate(270)}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 text-slate-300"
            title="Rotate Left 90°"
          >
            <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
            <span>90° L</span>
          </button>
          <button
            onClick={() => handleRotate(90)}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 text-slate-300"
            title="Rotate Right 90°"
          >
            <RotateCw className="w-3.5 h-3.5 text-purple-400" />
            <span>90° R</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Flip */}
          <button
            onClick={() => handleFlip(true, false)}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 text-slate-300"
            title="Flip Horizontal"
          >
            <FlipHorizontal className="w-3.5 h-3.5 text-indigo-400" />
            <span>Flip H</span>
          </button>
          <button
            onClick={() => handleFlip(false, true)}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 text-slate-300"
            title="Flip Vertical"
          >
            <FlipVertical className="w-3.5 h-3.5 text-indigo-400" />
            <span>Flip V</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Crop Tool */}
          <button
            onClick={() => {
              setIsCropActive(!isCropActive);
              if (isEraserActive) setIsEraserActive(false);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded ${isCropActive ? 'bg-purple-600 text-white font-semibold' : 'hover:bg-slate-800 text-slate-300'}`}
            title="Crop Image"
          >
            <CropIcon className="w-3.5 h-3.5" />
            <span>Crop</span>
          </button>

          {/* Resize Tool */}
          <button
            onClick={() => setShowResizeModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded hover:bg-slate-800 text-slate-300"
            title="Resize Dimensions"
          >
            <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Resize</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Erase Brush Tool */}
          <button
            onClick={() => {
              setIsEraserActive(!isEraserActive);
              if (isCropActive) setIsCropActive(false);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded ${isEraserActive ? 'bg-amber-600 text-white font-semibold' : 'hover:bg-slate-800 text-slate-300'}`}
            title="Eraser Brush"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Eraser</span>
          </button>

          {isEraserActive && (
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[10px] text-slate-400">Size:</span>
              <input
                type="range"
                min="5"
                max="60"
                value={eraserSize}
                onChange={(e) => setEraserSize(parseInt(e.target.value))}
                className="w-16 accent-amber-500"
              />
              <span className="text-[10px] font-mono text-slate-400">{eraserSize}px</span>
            </div>
          )}
        </div>

        {/* Undo */}
        <button
          onClick={handleUndo}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
          title="Undo Transformation"
        >
          <Undo className="w-3.5 h-3.5" />
          <span>Undo</span>
        </button>
      </div>

      {/* Crop Controls Banner */}
      {isCropActive && (
        <div className="bg-purple-950/60 border-b border-purple-800/60 px-4 py-2 flex items-center justify-between text-xs text-purple-200">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-white">Crop Area:</span>
            <div className="flex items-center gap-1.5">
              <span>X:</span>
              <input
                type="number"
                min="0"
                max="90"
                value={cropRect.x}
                onChange={(e) => setCropRect((prev) => ({ ...prev, x: parseInt(e.target.value) || 0 }))}
                className="w-12 bg-slate-900 border border-slate-700 px-1 py-0.5 rounded text-white"
              />
              <span>%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>Y:</span>
              <input
                type="number"
                min="0"
                max="90"
                value={cropRect.y}
                onChange={(e) => setCropRect((prev) => ({ ...prev, y: parseInt(e.target.value) || 0 }))}
                className="w-12 bg-slate-900 border border-slate-700 px-1 py-0.5 rounded text-white"
              />
              <span>%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>W:</span>
              <input
                type="number"
                min="10"
                max="100"
                value={cropRect.w}
                onChange={(e) => setCropRect((prev) => ({ ...prev, w: parseInt(e.target.value) || 10 }))}
                className="w-12 bg-slate-900 border border-slate-700 px-1 py-0.5 rounded text-white"
              />
              <span>%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>H:</span>
              <input
                type="number"
                min="10"
                max="100"
                value={cropRect.h}
                onChange={(e) => setCropRect((prev) => ({ ...prev, h: parseInt(e.target.value) || 10 }))}
                className="w-12 bg-slate-900 border border-slate-700 px-1 py-0.5 rounded text-white"
              />
              <span>%</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleApplyCrop}
              className="flex items-center gap-1 px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-semibold cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Crop</span>
            </button>
            <button
              onClick={() => setIsCropActive(false)}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Editor Main Canvas & Sidebar Controls */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center Canvas Viewport */}
        <div className="flex-1 overflow-auto p-4 md:p-8 flex items-center justify-center bg-slate-950 checkerboard-bg relative select-none">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className={`max-w-full max-h-[70vh] object-contain rounded-xl shadow-2xl border border-slate-800 ${
              isEraserActive ? 'cursor-crosshair' : 'cursor-default'
            }`}
          />
        </div>

        {/* Right Adjustments & Layers Panel */}
        <div className="w-72 border-l border-slate-800 bg-slate-900/60 p-4 overflow-y-auto space-y-6 shrink-0 hidden md:block">
          {/* Overlays */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Overlays &amp; Layers</span>
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleAddTextLayer}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
              >
                <Type className="w-3.5 h-3.5 text-indigo-400" />
                <span>Add Text</span>
              </button>
              <button
                onClick={handleAddSticker}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Sticker</span>
              </button>
            </div>
            {layers.length > 0 && (
              <button
                onClick={() => setLayers([])}
                className="w-full py-1 text-[11px] text-slate-500 hover:text-red-400 text-center cursor-pointer"
              >
                Clear all overlays ({layers.length})
              </button>
            )}
          </div>

          {/* Background Replacement */}
          {hasBackgroundRemoved && (
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-pink-400" />
                <span>Replace Background</span>
              </h4>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <button
                  onClick={() => setBgReplacementType('transparent')}
                  className={`py-1.5 rounded-lg border cursor-pointer ${
                    bgReplacementType === 'transparent' ? 'border-purple-500 bg-purple-500/20 text-white' : 'border-slate-800 text-slate-400'
                  }`}
                >
                  Alpha
                </button>
                <button
                  onClick={() => {
                    setBgReplacementType('color');
                    setBgValue('#ffffff');
                  }}
                  className={`py-1.5 rounded-lg border cursor-pointer ${
                    bgReplacementType === 'color' ? 'border-purple-500 bg-purple-500/20 text-white' : 'border-slate-800 text-slate-400'
                  }`}
                >
                  White
                </button>
                <button
                  onClick={() => {
                    setBgReplacementType('gradient');
                  }}
                  className={`py-1.5 rounded-lg border cursor-pointer ${
                    bgReplacementType === 'gradient' ? 'border-purple-500 bg-purple-500/20 text-white' : 'border-slate-800 text-slate-400'
                  }`}
                >
                  Sunset
                </button>
              </div>
            </div>
          )}

          {/* Filter Sliders */}
          <div className="space-y-4 pt-3 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span>Adjustments</span>
              </span>
              <button
                onClick={() =>
                  setAdjustments({
                    brightness: 100,
                    contrast: 100,
                    saturation: 100,
                    blur: 0,
                    grayscale: 0,
                    sepia: 0,
                    invert: 0,
                  })
                }
                className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                Reset
              </button>
            </h4>

            {/* Brightness */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Brightness</span>
                <span className="font-mono">{adjustments.brightness}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="200"
                value={adjustments.brightness}
                onChange={(e) =>
                  setAdjustments((prev) => ({ ...prev, brightness: parseInt(e.target.value) }))
                }
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            {/* Contrast */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Contrast</span>
                <span className="font-mono">{adjustments.contrast}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="200"
                value={adjustments.contrast}
                onChange={(e) =>
                  setAdjustments((prev) => ({ ...prev, contrast: parseInt(e.target.value) }))
                }
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            {/* Saturation */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Saturation</span>
                <span className="font-mono">{adjustments.saturation}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="250"
                value={adjustments.saturation}
                onChange={(e) =>
                  setAdjustments((prev) => ({ ...prev, saturation: parseInt(e.target.value) }))
                }
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            {/* Grayscale */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Grayscale (B&amp;W)</span>
                <span className="font-mono">{adjustments.grayscale}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={adjustments.grayscale}
                onChange={(e) =>
                  setAdjustments((prev) => ({ ...prev, grayscale: parseInt(e.target.value) }))
                }
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            {/* Blur */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Blur</span>
                <span className="font-mono">{adjustments.blur}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="15"
                value={adjustments.blur}
                onChange={(e) =>
                  setAdjustments((prev) => ({ ...prev, blur: parseInt(e.target.value) }))
                }
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Resize Modal */}
      {showResizeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-5 shadow-2xl flex flex-col gap-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-sm">Resize Image Dimensions</h3>
              <button onClick={() => setShowResizeModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Width (px)</label>
                <input
                  type="number"
                  value={resizeWidth}
                  onChange={(e) => {
                    const w = parseInt(e.target.value) || 0;
                    setResizeWidth(w);
                    if (lockAspectRatio && canvasRef.current && canvasRef.current.width > 0) {
                      const ratio = canvasRef.current.height / canvasRef.current.width;
                      setResizeHeight(Math.round(w * ratio));
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Height (px)</label>
                <input
                  type="number"
                  value={resizeHeight}
                  onChange={(e) => {
                    const h = parseInt(e.target.value) || 0;
                    setResizeHeight(h);
                    if (lockAspectRatio && canvasRef.current && canvasRef.current.height > 0) {
                      const ratio = canvasRef.current.width / canvasRef.current.height;
                      setResizeWidth(Math.round(h * ratio));
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={lockAspectRatio}
                onChange={(e) => setLockAspectRatio(e.target.checked)}
                className="accent-purple-500 rounded"
              />
              <span>Maintain aspect ratio</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowResizeModal(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyResize}
                className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold"
              >
                Apply Resize
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
