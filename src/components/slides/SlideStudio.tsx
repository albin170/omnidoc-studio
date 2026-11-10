import React, { useState, useEffect } from 'react';
import { 
  Presentation, 
  Plus, 
  Trash2, 
  Copy, 
  Play, 
  DownloadCloud, 
  Upload,
  Palette, 
  Type, 
  ArrowUp, 
  ArrowDown, 
  X, 
  ChevronLeft, 
  ChevronRight,
  Save
} from 'lucide-react';
import { SlideItem } from '../../types';
import { createPresentationBlob, convertSlidesToPdf, extractTextFromPptxFile } from '../../services/pptxService';
import saveAs from 'file-saver';
import confetti from 'canvas-confetti';

interface SlideStudioProps {
  initialTitle?: string;
  initialSlides?: SlideItem[];
  onSaveToProjects?: (title: string, data: any) => void;
}

export const SlideStudio: React.FC<SlideStudioProps> = ({
  initialTitle,
  initialSlides,
  onSaveToProjects,
}) => {
  const [deckTitle, setDeckTitle] = useState(initialTitle || 'Strategic Presentation');
  const [slides, setSlides] = useState<SlideItem[]>(
    initialSlides || [
      {
        id: 's-1',
        title: 'Title Slide',
        bgColor: '#0f172a',
        layout: 'title',
        elements: [
          {
            id: 'el-1',
            type: 'title',
            content: 'OmniDoc Studio',
            x: 10,
            y: 25,
            width: 80,
            height: 25,
            fontSize: 44,
            fontColor: '#ffffff',
          },
          {
            id: 'el-2',
            type: 'text',
            content: 'Universal Document & Conversion Platform\nCreate, edit, and present with high-fidelity formatting.',
            x: 10,
            y: 55,
            width: 80,
            height: 30,
            fontSize: 20,
            fontColor: '#94a3b8',
          },
        ],
      },
      {
        id: 's-2',
        title: 'Executive Highlights',
        bgColor: '#1e1b4b',
        layout: 'content',
        elements: [
          {
            id: 'el-3',
            type: 'title',
            content: 'Core Product Capabilities',
            x: 8,
            y: 12,
            width: 84,
            height: 18,
            fontSize: 32,
            fontColor: '#ffffff',
          },
          {
            id: 'el-4',
            type: 'text',
            content: '• Multi-format conversion: PDF, DOCX, PPTX, XLSX, and Images.\n• True Client-Side Architecture: 100% private and offline-capable.\n• Full-fidelity presentation generator powered by OpenXML standards.\n• Instant single-click export to PPTX or presentation PDF.',
            x: 8,
            y: 35,
            width: 84,
            height: 55,
            fontSize: 18,
            fontColor: '#c7d2fe',
          },
        ],
      },
    ]
  );

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isPresenting, setIsPresenting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (initialTitle) setDeckTitle(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    if (initialSlides && Array.isArray(initialSlides) && initialSlides.length > 0) {
      setSlides(initialSlides);
      setActiveSlideIndex(0);
    }
  }, [initialSlides]);

  const activeSlide = slides[activeSlideIndex] || slides[0];

  // Slide management
  const addSlide = () => {
    const newSlide: SlideItem = {
      id: `slide-${Date.now()}`,
      title: `Slide ${slides.length + 1}`,
      bgColor: activeSlide?.bgColor || '#0f172a',
      layout: 'content',
      elements: [
        {
          id: `el-${Date.now()}-1`,
          type: 'title',
          content: 'New Slide Heading',
          x: 10,
          y: 15,
          width: 80,
          height: 20,
          fontSize: 32,
          fontColor: '#ffffff',
        },
        {
          id: `el-${Date.now()}-2`,
          type: 'text',
          content: 'Add your bullet points and details here...',
          x: 10,
          y: 40,
          width: 80,
          height: 45,
          fontSize: 18,
          fontColor: '#94a3b8',
        },
      ],
    };

    setSlides((prev) => [...prev, newSlide]);
    setActiveSlideIndex(slides.length);
  };

  const deleteSlide = (idx: number) => {
    if (slides.length <= 1) return;
    setSlides((prev) => prev.filter((_, i) => i !== idx));
    setActiveSlideIndex((curr) => Math.max(0, Math.min(curr, slides.length - 2)));
  };

  const duplicateSlide = (idx: number) => {
    const target = slides[idx];
    const copy: SlideItem = {
      ...target,
      id: `slide-${Date.now()}`,
      title: `${target.title} (Copy)`,
      elements: target.elements.map((el) => ({ ...el, id: `el-${Date.now()}-${Math.random()}` })),
    };

    const next = [...slides];
    next.splice(idx + 1, 0, copy);
    setSlides(next);
    setActiveSlideIndex(idx + 1);
  };

  const moveSlide = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= slides.length) return;
    const next = [...slides];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setSlides(next);
    setActiveSlideIndex(toIdx);
  };

  // Modify active slide elements
  const updateElementContent = (elId: string, newContent: string) => {
    setSlides((prev) =>
      prev.map((slide, i) => {
        if (i !== activeSlideIndex) return slide;
        return {
          ...slide,
          elements: slide.elements.map((el) =>
            el.id === elId ? { ...el, content: newContent } : el
          ),
        };
      })
    );
  };

  const updateSlideBgColor = (color: string) => {
    setSlides((prev) =>
      prev.map((slide, i) => (i === activeSlideIndex ? { ...slide, bgColor: color } : slide))
    );
  };

  const handleImportPptx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setDeckTitle(file.name.replace(/\.[^/.]+$/, ''));
      const slidesText = await extractTextFromPptxFile(file);
      const parsedSlides: SlideItem[] = slidesText.map((slideContent, idx) => {
        const lines = slideContent.split('\n').filter(Boolean);
        const titleLine = lines[0] || `Slide ${idx + 1}`;
        const bodyLines = lines.slice(1).join('\n') || '';

        return {
          id: `slide-imported-${idx}-${Date.now()}`,
          title: titleLine.length > 30 ? titleLine.slice(0, 28) + '…' : titleLine,
          bgColor: '#0f172a',
          layout: idx === 0 ? 'title' : 'content',
          elements: [
            {
              id: `el-title-${idx}`,
              type: 'title',
              content: titleLine,
              x: 8,
              y: idx === 0 ? 25 : 12,
              width: 84,
              height: 20,
              fontSize: idx === 0 ? 40 : 32,
              fontColor: '#ffffff',
            },
            ...(bodyLines ? [{
              id: `el-body-${idx}`,
              type: 'text' as const,
              content: bodyLines,
              x: 8,
              y: idx === 0 ? 50 : 35,
              width: 84,
              height: 55,
              fontSize: 18,
              fontColor: '#cbd5e1',
            }] : []),
          ],
        };
      });

      if (parsedSlides.length > 0) {
        setSlides(parsedSlides);
        setActiveSlideIndex(0);
        confetti({ particleCount: 35, spread: 55 });
      }
    } catch (err: any) {
      console.error('PPTX Import error:', err);
      alert('Failed to import presentation: ' + (err.message || 'Unknown error'));
    }
  };

  // Export handlers
  const handleExportPptx = async () => {
    setIsExporting(true);
    try {
      const blob = await createPresentationBlob(deckTitle, slides);
      saveAs(blob, `${deckTitle}.pptx`);
      confetti({ particleCount: 50, spread: 60 });
    } catch (err) {
      console.error('PPTX export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const pdfBytes = await convertSlidesToPdf(deckTitle, slides);
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      saveAs(blob, `${deckTitle}_slides.pdf`);
      confetti({ particleCount: 50, spread: 60 });
    } catch (err) {
      console.error('PDF presentation export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#070B13]/60 text-[#F5FAFF]">
      {/* Top Header */}
      <div className="h-14 border-b border-white/10 bg-[#0B1420]/85 backdrop-blur-2xl px-4 flex items-center justify-between shrink-0 gap-3 overflow-x-auto">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={deckTitle}
            onChange={(e) => setDeckTitle(e.target.value)}
            className="bg-transparent text-sm font-bold text-[#F5FAFF] border-b border-transparent hover:border-white/20 focus:border-amber-400 px-1 py-0.5 outline-none w-52 md:w-64 transition-colors"
            placeholder="Presentation Title"
          />
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-semibold border border-amber-400/30">
            PPTX 16:9
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card hover:border-amber-400/50 text-[#F5FAFF] text-xs font-semibold cursor-pointer transition-all">
            <Upload className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Import PPTX</span>
            <input type="file" accept=".pptx" className="hidden" onChange={handleImportPptx} />
          </label>

          {onSaveToProjects && (
            <button
              onClick={() => onSaveToProjects(deckTitle, { slides })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card hover:border-[#A8DEFA]/50 text-[#F5FAFF] text-xs font-semibold cursor-pointer transition-all"
            >
              <Save className="w-3.5 h-3.5 text-[#A8DEFA]" />
              <span>Save</span>
            </button>
          )}

          <button
            onClick={() => setIsPresenting(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card hover:border-amber-400/50 text-amber-300 text-xs font-semibold cursor-pointer transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
            <span>Present</span>
          </button>

          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card hover:border-rose-400/50 text-[#F5FAFF] text-xs font-semibold cursor-pointer transition-all"
          >
            <DownloadCloud className="w-3.5 h-3.5 text-rose-400" />
            <span>PDF</span>
          </button>

          <button
            onClick={handleExportPptx}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl glass-btn-primary text-xs font-semibold shadow-lg shadow-[#A8DEFA]/20 cursor-pointer"
          >
            <DownloadCloud className="w-3.5 h-3.5" />
            <span>Export .PPTX</span>
          </button>
        </div>
      </div>

      {/* Main Studio Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Slide Thumbnails */}
        <div className="w-56 border-r border-white/10 bg-[#0B1420]/40 backdrop-blur-xl p-3 overflow-y-auto space-y-3 shrink-0 hidden sm:block custom-scrollbar">
          <div className="flex items-center justify-between text-xs font-bold text-[#A7B8CA] uppercase tracking-wider mb-2">
            <span>Slides ({slides.length})</span>
            <button
              onClick={addSlide}
              className="p-1 rounded-lg glass-btn-primary text-white"
              title="Add Slide"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {slides.map((s, idx) => (
            <div
              key={s.id}
              onClick={() => setActiveSlideIndex(idx)}
              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer group ${
                activeSlideIndex === idx
                  ? 'border-amber-400/60 bg-amber-400/15 shadow-lg shadow-amber-400/20'
                  : 'border-white/10 glass-card hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold text-[#F5FAFF] mb-1">
                <span>Slide {idx + 1}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveSlide(idx, idx - 1);
                    }}
                    disabled={idx === 0}
                    className="p-0.5 hover:text-white disabled:opacity-30"
                    title="Move up"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveSlide(idx, idx + 1);
                    }}
                    disabled={idx === slides.length - 1}
                    className="p-0.5 hover:text-white disabled:opacity-30"
                    title="Move down"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateSlide(idx);
                    }}
                    className="p-0.5 hover:text-white"
                    title="Duplicate slide"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  {slides.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSlide(idx);
                      }}
                      className="p-0.5 hover:text-rose-400"
                      title="Delete slide"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Mini Preview Box */}
              <div
                className="w-full h-18 rounded-xl border border-white/15 p-1.5 overflow-hidden text-[8px] flex flex-col justify-between shadow-sm"
                style={{ backgroundColor: s.bgColor }}
              >
                <div className="font-bold truncate text-[#F5FAFF]">
                  {s.elements.find((e) => e.type === 'title')?.content || 'Untitled'}
                </div>
                <div className="text-[#A7B8CA] truncate">
                  {s.elements.find((e) => e.type === 'text')?.content?.split('\n')[0] || ''}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Center Canvas / Active Slide Viewport */}
        <div className="flex-1 overflow-auto p-4 md:p-8 flex flex-col items-center justify-center bg-[#070B13]/60 custom-scrollbar">
          {/* Slide Theme Palettes */}
          <div className="mb-4 flex items-center gap-2 glass-card px-3.5 py-1.5 rounded-2xl border-white/10 text-xs text-[#A7B8CA]">
            <Palette className="w-3.5 h-3.5 text-amber-400" />
            <span>Theme:</span>
            {[
              { label: 'Dark Navy', color: '#0f172a' },
              { label: 'Deep Indigo', color: '#1e1b4b' },
              { label: 'Emerald', color: '#042f2e' },
              { label: 'Slate', color: '#1e293b' },
              { label: 'Midnight', color: '#09090b' },
            ].map((th) => (
              <button
                key={th.color}
                onClick={() => updateSlideBgColor(th.color)}
                className={`w-5 h-5 rounded-full border cursor-pointer transition-transform hover:scale-110 ${
                  activeSlide.bgColor === th.color ? 'ring-2 ring-amber-400 border-white' : 'border-white/20'
                }`}
                style={{ backgroundColor: th.color }}
                title={th.label}
              />
            ))}
          </div>

          {/* 16:9 Aspect Ratio Slide Canvas */}
          <div
            className="w-full max-w-4xl aspect-[16/9] rounded-3xl border border-white/20 shadow-2xl p-8 md:p-14 flex flex-col justify-between relative overflow-hidden transition-colors"
            style={{ backgroundColor: activeSlide.bgColor }}
          >
            {activeSlide.elements.map((el) => {
              if (el.type === 'title') {
                return (
                  <textarea
                    key={el.id}
                    value={el.content || ''}
                    onChange={(e) => updateElementContent(el.id, e.target.value)}
                    rows={2}
                    className="w-full bg-transparent font-extrabold text-2xl md:text-4xl text-white outline-none resize-none tracking-tight border-b border-transparent hover:border-slate-700/60 focus:border-amber-500/80 transition-colors"
                    placeholder="Enter slide title..."
                  />
                );
              }

              if (el.type === 'text') {
                return (
                  <textarea
                    key={el.id}
                    value={el.content || ''}
                    onChange={(e) => updateElementContent(el.id, e.target.value)}
                    rows={8}
                    className="w-full flex-1 bg-transparent text-sm md:text-lg text-slate-300 outline-none resize-none leading-relaxed border border-transparent hover:border-slate-700/60 focus:border-amber-500/80 rounded-lg p-2 transition-colors mt-4"
                    placeholder="Enter presentation details, bullets, or metrics..."
                  />
                );
              }

              return null;
            })}

            {/* Slide footer metadata */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-white/10">
              <span>{deckTitle}</span>
              <span>Slide {activeSlideIndex + 1} of {slides.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Presentation Mode */}
      {isPresenting && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-8">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase tracking-widest font-semibold">{deckTitle}</span>
            <button
              onClick={() => setIsPresenting(false)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div
            className="w-full max-w-5xl mx-auto aspect-[16/9] rounded-2xl p-12 flex flex-col justify-between shadow-2xl"
            style={{ backgroundColor: activeSlide.bgColor }}
          >
            <div>
              <h2 className="text-3xl md:text-5xl font-extrabold text-white">
                {activeSlide.elements.find((e) => e.type === 'title')?.content}
              </h2>
              <div className="text-lg md:text-2xl text-slate-300 mt-8 whitespace-pre-line leading-relaxed">
                {activeSlide.elements.find((e) => e.type === 'text')?.content}
              </div>
            </div>

            <div className="text-sm text-slate-400 text-right">
              {activeSlideIndex + 1} / {slides.length}
            </div>
          </div>

          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setActiveSlideIndex((i) => Math.max(0, i - 1))}
              disabled={activeSlideIndex === 0}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white cursor-pointer"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <span className="text-slate-400 text-sm font-mono">
              {activeSlideIndex + 1} of {slides.length}
            </span>
            <button
              onClick={() => setActiveSlideIndex((i) => Math.min(slides.length - 1, i + 1))}
              disabled={activeSlideIndex === slides.length - 1}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white cursor-pointer"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
