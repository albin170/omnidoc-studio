import React from 'react';
import { X, Sparkles, Keyboard, ShieldCheck, Zap, HelpCircle } from 'lucide-react';
import { OmniDocLogo } from './OmniDocLogo';

interface HelpShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpShortcutsModal: React.FC<HelpShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Ctrl + K / ⌘K', desc: 'Open Command Palette & Quick Search across all studios' },
    { key: 'Ctrl + S / ⌘S', desc: 'Save current active document to local offline projects' },
    { key: 'Ctrl + D / ⌘D', desc: 'Quick return to main Dashboard' },
    { key: 'Esc', desc: 'Close any active modal, dialog, or search palette' },
    { key: 'Drag & Drop', desc: 'Drag any document anywhere into window to auto-open' },
    { key: '?', desc: 'Open this Help & Shortcuts cheat sheet' },
  ];

  const features = [
    { title: '100% Client-Side Privacy', desc: 'All operations run in WebAssembly & memory. No files are uploaded to third-party servers.' },
    { title: 'Multi-Format Conversion', desc: 'Convert seamlessly between PDF, DOCX, PPTX, XLSX, CSV, PNG, JPG, WEBP, and TXT.' },
    { title: 'Offline-First Storage', desc: 'Projects and histories are saved in your browser local storage and IndexedDB.' },
    { title: 'AI OCR & Background Eraser', desc: 'In-browser computer vision for text recognition and color-distance feathering.' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in">
      <div 
        className="w-full max-w-2xl bg-white rounded-[28px] border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <OmniDocLogo size={34} />
            <div>
              <h2 className="text-base font-extrabold text-slate-900 leading-tight flex items-center gap-2">
                <span>OmniDoc Studio Help &amp; Shortcuts</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 font-bold">
                  v2.0
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Quick guide and hotkeys for power productivity
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
          {/* Shortcuts Grid */}
          <div>
            <div className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-sm">
              <Keyboard className="w-4 h-4 text-blue-600" />
              <span>Keyboard Shortcuts</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {shortcuts.map((s, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                  <span className="text-slate-600 font-medium">{s.desc}</span>
                  <kbd className="px-2 py-1 rounded-lg bg-white border border-slate-300 font-mono text-[11px] font-bold text-slate-800 shadow-sm shrink-0">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Privacy & Architecture Features */}
          <div>
            <div className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Key Architecture &amp; Privacy Rules</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {features.map((f, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-blue-50/40 border border-blue-100/80 space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>{f.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">Need more assistance? Drop feedback in Settings.</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer transition-all"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
