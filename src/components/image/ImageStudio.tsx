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
  Layers
} from 'lucide-react';
import { ImageAdjustments, ImageLayer } from '../../types';
import { 
  applyAdjustmentsToCanvas, 
  convertImageToPdf, 
  removeBackgroundAlgorithm, 
  renderLayersOnCanvas
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const loadImageFile = (file: File) => {
    setImageName(file.name);
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      setSourceImage(img);
      setHasBackgroundRemoved(false);
      processedCanvasRef.current = null;
    };
    img.src = url;
  };

  const generateDemoArtwork = () => {
    // Generate a sleek modern demo image on a canvas
    const demo = document.createElement('canvas');
    demo.width = 800;
    demo.height = 600;
    const ctx = demo.getContext('2d')!;

    // Clean gradient background
    const grad = ctx.createLinearGradient(0, 0, 800, 600);
    grad.addColorStop(0, '#312e81');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 600);

    // Modern glowing spheres & artwork
    ctx.beginPath();
    ctx.arc(400, 300, 140, 0, Math.PI * 2);
    ctx.fillStyle = '#6366f1';
    ctx.shadowColor = '#818cf8';
    ctx.shadowBlur = 40;
    ctx.fill();

    const img = new Image();
    img.onload = () => setSourceImage(img);
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

  // Re-render canvas whenever source image, adjustments, background, or layers change
  useEffect(() => {
    if (!sourceImage || !canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = sourceImage.naturalWidth || 800;
    canvas.height = sourceImage.naturalHeight || 600;
    const ctx = canvas.getContext('2d')!;

    // 1. Draw background replacement if applicable
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

    // 2. Apply adjustments
    ctx.save();
    applyAdjustmentsToCanvas(ctx, adjustments);

    // Draw either bg-removed processed canvas or original source image
    if (processedCanvasRef.current) {
      ctx.drawImage(processedCanvasRef.current, 0, 0);
    } else {
      ctx.drawImage(sourceImage, 0, 0);
    }
    ctx.restore();

    // 3. Render layers and text overlays
    renderLayersOnCanvas(ctx, layers);
  }, [sourceImage, adjustments, bgReplacementType, bgValue, layers]);

  // Standout Feature: Remove Background
  const handleRemoveBackground = () => {
    if (!sourceImage || !canvasRef.current) return;
    setIsProcessing(true);

    setTimeout(() => {
      try {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sourceImage.naturalWidth || 800;
        tempCanvas.height = sourceImage.naturalHeight || 600;
        const ctx = tempCanvas.getContext('2d')!;
        ctx.drawImage(sourceImage, 0, 0);

        const cutoutCanvas = removeBackgroundAlgorithm(tempCanvas, 30);
        processedCanvasRef.current = cutoutCanvas;
        setHasBackgroundRemoved(true);
        setBgReplacementType('transparent');
        confetti({ particleCount: 30, spread: 50 });
      } catch (err) {
        console.error('BG removal failed:', err);
      } finally {
        setIsProcessing(false);
      }
    }, 50);
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
            <span>Remove BG (AI)</span>
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

      {/* Editor Main Canvas & Sidebar Controls */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center Canvas Viewport */}
        <div className="flex-1 overflow-auto p-4 md:p-8 flex items-center justify-center bg-slate-950 checkerboard-bg">
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-2xl border border-slate-800"
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
    </div>
  );
};
