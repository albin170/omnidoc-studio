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

  const handleAdjustmentChange = (key: keyof ImageAdjustments, value: number) => {
    setAdjustments((prev) => ({ ...prev, [key]: value }));
  };

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

  // Quality slider
  const [quality, setQuality] = useState<number>(90);
  const [activeTool, setActiveTool] = useState<'none' | 'crop' | 'adjust' | 'filters' | 'layers'>('none');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<HTMLCanvasElement[]>([]);

  // Initialize demo artwork if no initial file provided
  useEffect(() => {
    if (!initialFile && !sourceImage) {
      const demoCanvas = document.createElement('canvas');
      demoCanvas.width = 600;
      demoCanvas.height = 600;
      const ctx = demoCanvas.getContext('2d');
      if (ctx) {
        // Deep background
        const bgGrad = ctx.createRadialGradient(300, 300, 40, 300, 300, 320);
        bgGrad.addColorStop(0, '#1a103c');
        bgGrad.addColorStop(0.7, '#0d0b24');
        bgGrad.addColorStop(1, '#060714');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 600, 600);

        // Ambient glow rings
        ctx.save();
        ctx.shadowBlur = 40;
        ctx.shadowColor = '#42D6E8';
        ctx.strokeStyle = 'rgba(66, 214, 232, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(300, 300, 240, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // 3 concentric layers of luminous petals
        const numPetals = 16;
        for (let layer = 3; layer >= 1; layer--) {
          const radius = layer * 60 + 50;
          for (let i = 0; i < numPetals; i++) {
            const angle = (i * 2 * Math.PI) / numPetals + (layer % 2 ? 0.2 : 0);
            ctx.save();
            ctx.translate(300, 300);
            ctx.rotate(angle);

            const petalGrad = ctx.createLinearGradient(0, 0, 0, radius);
            if (layer === 3) {
              petalGrad.addColorStop(0, '#6366F1');
              petalGrad.addColorStop(0.6, '#42D6E8');
              petalGrad.addColorStop(1, 'rgba(66, 214, 232, 0.3)');
            } else if (layer === 2) {
              petalGrad.addColorStop(0, '#8B7CFF');
              petalGrad.addColorStop(0.7, '#A855F7');
              petalGrad.addColorStop(1, 'rgba(139, 124, 255, 0.4)');
            } else {
              petalGrad.addColorStop(0, '#FFFFFF');
              petalGrad.addColorStop(0.5, '#C084FC');
              petalGrad.addColorStop(1, '#8B7CFF');
            }

            ctx.fillStyle = petalGrad;
            ctx.beginPath();
            ctx.ellipse(0, radius / 2, 32 - layer * 5, radius / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }

        // Flower golden core
        const centerGrad = ctx.createRadialGradient(300, 300, 4, 300, 300, 45);
        centerGrad.addColorStop(0, '#FEF08A');
        centerGrad.addColorStop(0.5, '#F59E0B');
        centerGrad.addColorStop(1, '#7C3AED');
        ctx.fillStyle = centerGrad;
        ctx.beginPath();
        ctx.arc(300, 300, 42, 0, Math.PI * 2);
        ctx.fill();

        const img = new Image();
        img.src = demoCanvas.toDataURL();
        img.onload = () => {
          setSourceImage(img);
          setImageName('aurora_flower.png');
          setResizeWidth(600);
          setResizeHeight(600);
        };
      }
    }
  }, [initialFile]);

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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#080B18]/60 text-[#F4F5FF]">
      {/* Top Header matching reference */}
      <div className="h-14 border-b border-white/10 bg-[#11152A]/85 backdrop-blur-2xl px-5 flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#8B7CFF] to-[#42D6E8] flex items-center justify-center p-0.5 shadow-md shadow-[#8B7CFF]/20">
            <div className="w-full h-full bg-[#080B18] rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#8B7CFF]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#F4F5FF] tracking-tight">Image Studio</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#8B7CFF]/20 text-[#8B7CFF] font-semibold border border-[#8B7CFF]/30">
                AURORA CANVAS
              </span>
            </div>
            <p className="text-[11px] text-[#9BA3BD]">Edit, enhance and optimize images</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            className="p-2 rounded-xl glass-card hover:bg-white/10 text-[#9BA3BD] hover:text-[#F4F5FF] transition-colors"
            title="Undo"
          >
            <Undo className="w-4 h-4" />
          </button>

          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card hover:border-[#8B7CFF]/50 text-[#F4F5FF] text-xs font-semibold cursor-pointer transition-all">
            <Upload className="w-3.5 h-3.5 text-[#8B7CFF]" />
            <span>Open Photo</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && loadImageFile(e.target.files[0])} />
          </label>

          {onSaveToProjects && (
            <button
              onClick={() => onSaveToProjects(imageName, { adjustments, hasBackgroundRemoved, bgReplacementType, bgValue, layers })}
              className="p-2 rounded-xl glass-card hover:border-[#8B7CFF]/50 text-[#9BA3BD] hover:text-[#8B7CFF] cursor-pointer transition-all"
              title="Save Image Project"
            >
              <Save className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 3-Column Studio Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Tool Buttons in Rounded Glass Pills */}
        <div className="w-44 border-r border-white/10 bg-[#11152A]/40 backdrop-blur-xl p-3 flex flex-col gap-2 shrink-0 select-none custom-scrollbar overflow-y-auto">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#9BA3BD] px-2 pt-1">
            Tools
          </span>

          {/* Crop */}
          <button
            onClick={() => {
              setIsCropActive(!isCropActive);
              setActiveTool(isCropActive ? 'none' : 'crop');
            }}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isCropActive ? 'bg-[#8B7CFF]/25 text-[#F4F5FF] border border-[#8B7CFF]/40 shadow-sm' : 'glass-card text-[#9BA3BD] hover:text-[#F4F5FF] hover:border-white/20'
            }`}
          >
            <CropIcon className="w-4 h-4 text-[#8B7CFF]" />
            <span>Crop</span>
          </button>

          {/* Resize */}
          <button
            onClick={() => setShowResizeModal(true)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold glass-card text-[#9BA3BD] hover:text-[#F4F5FF] hover:border-white/20 transition-all cursor-pointer"
          >
            <Maximize2 className="w-4 h-4 text-[#42D6E8]" />
            <span>Resize</span>
          </button>

          {/* Rotate */}
          <button
            onClick={() => handleRotate(90)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold glass-card text-[#9BA3BD] hover:text-[#F4F5FF] hover:border-white/20 transition-all cursor-pointer"
          >
            <RotateCw className="w-4 h-4 text-[#8B7CFF]" />
            <span>Rotate</span>
          </button>

          {/* Filters */}
          <button
            onClick={() => setActiveTool(activeTool === 'filters' ? 'none' : 'filters')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTool === 'filters' ? 'bg-[#8B7CFF]/25 text-[#F4F5FF] border border-[#8B7CFF]/40' : 'glass-card text-[#9BA3BD] hover:text-[#F4F5FF] hover:border-white/20'
            }`}
          >
            <Palette className="w-4 h-4 text-pink-400" />
            <span>Filters</span>
          </button>

          {/* Adjust */}
          <button
            onClick={() => setActiveTool(activeTool === 'adjust' ? 'none' : 'adjust')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTool === 'adjust' ? 'bg-[#8B7CFF]/25 text-[#F4F5FF] border border-[#8B7CFF]/40' : 'glass-card text-[#9BA3BD] hover:text-[#F4F5FF] hover:border-white/20'
            }`}
          >
            <Sliders className="w-4 h-4 text-[#42D6E8]" />
            <span>Adjust</span>
          </button>

          {/* Remove BG */}
          <button
            onClick={handleRemoveBackground}
            disabled={isProcessing}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold glass-card text-[#9BA3BD] hover:text-emerald-300 hover:border-emerald-400/40 transition-all cursor-pointer"
          >
            <Scissors className="w-4 h-4 text-emerald-400" />
            <span>Remove BG</span>
          </button>

          <div className="h-px bg-white/10 my-2" />

          {/* Overlays */}
          <button
            onClick={handleAddTextLayer}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold glass-card text-[#9BA3BD] hover:text-[#F4F5FF] hover:border-white/20 transition-all cursor-pointer"
          >
            <Type className="w-4 h-4 text-[#8B7CFF]" />
            <span>Add Text</span>
          </button>

          <button
            onClick={handleAddSticker}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold glass-card text-[#9BA3BD] hover:text-amber-300 hover:border-amber-400/40 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Sticker</span>
          </button>
        </div>

        {/* Center Canvas Viewport */}
        <div className="flex-1 overflow-auto p-4 md:p-8 flex items-center justify-center bg-[#080B18]/60 relative select-none custom-scrollbar">
          {/* Ambient Glow Aura */}
          <div className="absolute w-[450px] h-[450px] rounded-full bg-gradient-to-tr from-[#8B7CFF]/20 to-[#42D6E8]/20 blur-3xl pointer-events-none" />

          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className={`max-w-full max-h-[70vh] object-contain rounded-2xl shadow-2xl border border-white/20 z-10 transition-all ${
              isEraserActive ? 'cursor-crosshair' : 'cursor-default'
            }`}
            style={{
              boxShadow: '0 0 60px rgba(66, 214, 232, 0.25), 0 20px 40px rgba(0,0,0,0.6)',
            }}
          />
        </div>

        {/* Right Column: Export Settings Panel */}
        <div className="w-72 border-l border-white/10 bg-[#11152A]/50 backdrop-blur-2xl p-5 flex flex-col gap-5 shrink-0 custom-scrollbar overflow-y-auto select-none">
          <div className="border-b border-white/10 pb-2">
            <h3 className="text-xs font-bold text-[#F4F5FF] uppercase tracking-wider">
              Export Settings
            </h3>
          </div>

          {/* Format Selector */}
          <div className="space-y-2">
            <label className="text-[11px] text-[#9BA3BD] font-medium">Format</label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as any)}
              className="w-full glass-input rounded-xl px-3 py-2 text-xs font-semibold text-[#F4F5FF] outline-none cursor-pointer"
            >
              <option value="png" className="bg-[#11152A] text-white">PNG</option>
              <option value="jpg" className="bg-[#11152A] text-white">JPG</option>
              <option value="webp" className="bg-[#11152A] text-white">WEBP</option>
              <option value="pdf" className="bg-[#11152A] text-white">PDF</option>
            </select>
          </div>

          {/* Quality Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-[#9BA3BD] font-medium">Quality</label>
              <span className="text-xs font-mono font-bold text-[#42D6E8]">{quality}%</span>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              value={quality}
              onChange={(e) => setQuality(parseInt(e.target.value))}
              className="w-full accent-[#8B7CFF] cursor-pointer"
            />
          </div>

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={isProcessing}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#8B7CFF] to-[#6366F1] hover:brightness-110 text-white text-xs font-bold shadow-lg shadow-[#8B7CFF]/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <DownloadCloud className="w-4 h-4" />
            <span>Export Image</span>
          </button>

          {/* Active Tool Subpanels (Adjustments / Filters) */}
          {activeTool === 'adjust' && (
            <div className="space-y-3 pt-3 border-t border-white/10">
              <h4 className="text-[11px] font-bold text-[#F4F5FF] uppercase tracking-wider">
                Adjustments
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-[11px] text-[#9BA3BD]">
                  <span>Brightness</span>
                  <span className="font-mono">{adjustments.brightness}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={adjustments.brightness}
                  onChange={(e) => handleAdjustmentChange('brightness', parseInt(e.target.value))}
                  className="w-full accent-[#8B7CFF]"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[11px] text-[#9BA3BD]">
                  <span>Contrast</span>
                  <span className="font-mono">{adjustments.contrast}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={adjustments.contrast}
                  onChange={(e) => handleAdjustmentChange('contrast', parseInt(e.target.value))}
                  className="w-full accent-[#8B7CFF]"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[11px] text-[#9BA3BD]">
                  <span>Saturation</span>
                  <span className="font-mono">{adjustments.saturation}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={adjustments.saturation}
                  onChange={(e) => handleAdjustmentChange('saturation', parseInt(e.target.value))}
                  className="w-full accent-[#8B7CFF]"
                />
              </div>
            </div>
          )}

          {activeTool === 'filters' && (
            <div className="space-y-3 pt-3 border-t border-white/10">
              <h4 className="text-[11px] font-bold text-[#F4F5FF] uppercase tracking-wider">
                Presets &amp; Filters
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAdjustmentChange('grayscale', adjustments.grayscale > 0 ? 0 : 100)}
                  className="py-1.5 px-2 rounded-xl glass-card text-xs font-semibold text-[#F4F5FF] hover:border-white/20 cursor-pointer"
                >
                  Grayscale
                </button>
                <button
                  onClick={() => handleAdjustmentChange('sepia', adjustments.sepia > 0 ? 0 : 100)}
                  className="py-1.5 px-2 rounded-xl glass-card text-xs font-semibold text-[#F4F5FF] hover:border-white/20 cursor-pointer"
                >
                  Sepia
                </button>
                <button
                  onClick={() => handleAdjustmentChange('invert', adjustments.invert > 0 ? 0 : 100)}
                  className="py-1.5 px-2 rounded-xl glass-card text-xs font-semibold text-[#F4F5FF] hover:border-white/20 cursor-pointer"
                >
                  Invert
                </button>
                <button
                  onClick={() => handleAdjustmentChange('blur', adjustments.blur > 0 ? 0 : 4)}
                  className="py-1.5 px-2 rounded-xl glass-card text-xs font-semibold text-[#F4F5FF] hover:border-white/20 cursor-pointer"
                >
                  Blur
                </button>
              </div>
            </div>
          )}
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
