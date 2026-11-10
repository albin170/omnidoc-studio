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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in">
      <div 
        className="w-full max-w-2xl glass-panel rounded-[28px] border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-[#F5FAFF]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#0B1420]/80">
          <div className="flex items-center gap-3">
            <OmniDocLogo size={34} />
            <div>
              <h2 className="text-base font-extrabold text-[#F5FAFF] leading-tight flex items-center gap-2">
                <span>OmniDoc Studio Help &amp; Shortcuts</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#A8DEFA]/20 text-[#A8DEFA] border border-[#A8DEFA]/30 font-bold">
                  v2.0
                </span>
              </h2>
              <p className="text-xs text-[#A7B8CA]">
                Quick guide and hotkeys for power productivity
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 text-[#A7B8CA] hover:text-[#F5FAFF] flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-[#A7B8CA] custom-scrollbar">
          {/* Shortcuts Grid */}
          <div>
            <div className="font-bold text-[#F5FAFF] mb-3 flex items-center gap-2 text-sm">
              <Keyboard className="w-4 h-4 text-[#A8DEFA]" />
              <span>Keyboard Shortcuts</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {shortcuts.map((s, idx) => (
                <div key={idx} className="p-3 rounded-2xl glass-card border-white/10 flex items-center justify-between gap-3">
                  <span className="text-[#A7B8CA] font-medium">{s.desc}</span>
                  <kbd className="px-2 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-[#F5FAFF] shadow-sm shrink-0">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Privacy & Architecture Features */}
          <div>
            <div className="font-bold text-[#F5FAFF] mb-3 flex items-center gap-2 text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Key Architecture &amp; Privacy Rules</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {features.map((f, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl glass-card border-white/10 space-y-1">
                  <div className="font-bold text-[#F5FAFF] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#A8DEFA]" />
                    <span>{f.title}</span>
                  </div>
                  <p className="text-[11px] text-[#A7B8CA] leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#0B1420]/90 border-t border-white/10 flex items-center justify-between text-xs">
          <span className="text-[#A7B8CA]">Need more assistance? Drop feedback in Settings.</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl glass-btn-primary font-bold cursor-pointer transition-all shadow-md shadow-[#A8DEFA]/20"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
