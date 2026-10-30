import React, { useEffect, useState } from 'react';
import { 
  Search, 
  FileText, 
  PenTool, 
  Presentation, 
  Table, 
  Image as ImageIcon, 
  ScanText, 
  RefreshCw, 
  Layers, 
  FolderArchive, 
  Settings, 
  Zap, 
  ArrowRight, 
  X,
  FileCheck,
  Sparkles
} from 'lucide-react';
import { WorkspaceTab } from '../../types';

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'Studios' | 'Actions' | 'Tools';
  icon: React.ComponentType<{ className?: string }>;
  tab?: WorkspaceTab;
  action?: () => void;
  shortcut?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: WorkspaceTab) => void;
  onNewDocx?: () => void;
  onNewSlides?: () => void;
  onNewSheet?: () => void;
  onOpenHelp?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onNewDocx,
  onNewSlides,
  onNewSheet,
  onOpenHelp,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: CommandItem[] = [
    // Studios
    {
      id: 'studio-pdf',
      title: 'PDF Studio',
      subtitle: 'Edit text, annotate, rotate, split, merge & sign documents',
      category: 'Studios',
      icon: FileText,
      tab: 'pdf',
      shortcut: 'P',
    },
    {
      id: 'studio-docx',
      title: 'Word Document Editor (DOCX)',
      subtitle: 'Rich text editing, word counters, find & replace, DOCX/PDF export',
      category: 'Studios',
      icon: PenTool,
      tab: 'docx',
      shortcut: 'W',
    },
    {
      id: 'studio-slides',
      title: 'PowerPoint Studio (PPTX)',
      subtitle: '16:9 presentation builder, slide master, shapes & PPTX export',
      category: 'Studios',
      icon: Presentation,
      tab: 'slides',
      shortcut: 'S',
    },
    {
      id: 'studio-sheets',
      title: 'Spreadsheet Studio (XLSX/CSV)',
      subtitle: 'Grid calculations, SUM/AVG formulas, CSV and Excel reports',
      category: 'Studios',
      icon: Table,
      tab: 'sheets',
      shortcut: 'X',
    },
    {
      id: 'studio-image',
      title: 'Photo & Graphic Studio',
      subtitle: 'AI background removal, color filters, stickers & image-to-PDF',
      category: 'Studios',
      icon: ImageIcon,
      tab: 'image',
      shortcut: 'I',
    },
    {
      id: 'studio-ocr',
      title: 'OCR Optical Scanner',
      subtitle: 'Extract text from scanned PDFs & images with Tesseract AI',
      category: 'Studios',
      icon: ScanText,
      tab: 'ocr',
      shortcut: 'O',
    },
    // Tools
    {
      id: 'tool-converter',
      title: 'Universal Conversion Hub',
      subtitle: 'Batch convert any document between PDF, Word, PPT, XLSX & images',
      category: 'Tools',
      icon: RefreshCw,
      tab: 'converter',
      shortcut: 'C',
    },
    {
      id: 'tool-templates',
      title: 'Templates Gallery',
      subtitle: 'Start from executive proposals, pitch decks, invoices and CVs',
      category: 'Tools',
      icon: Layers,
      tab: 'templates',
      shortcut: 'T',
    },
    {
      id: 'tool-projects',
      title: 'Projects & File History',
      subtitle: 'Access locally saved documents and previous conversions',
      category: 'Tools',
      icon: FolderArchive,
      tab: 'projects',
    },
    {
      id: 'tool-settings',
      title: 'Settings & Security',
      subtitle: 'Manage local encryption, storage quota and API tokens',
      category: 'Tools',
      icon: Settings,
      tab: 'settings',
    },
    // Actions
    {
      id: 'act-new-docx',
      title: 'Create Blank Word Document',
      subtitle: 'Start typing a new DOCX document right away',
      category: 'Actions',
      icon: PenTool,
      action: () => {
        if (onNewDocx) onNewDocx();
        onNavigate('docx');
      },
    },
    {
      id: 'act-new-slides',
      title: 'Create Blank Slide Deck',
      subtitle: 'Start designing a new PowerPoint presentation',
      category: 'Actions',
      icon: Presentation,
      action: () => {
        if (onNewSlides) onNewSlides();
        onNavigate('slides');
      },
    },
    {
      id: 'act-new-sheet',
      title: 'Create Blank Spreadsheet',
      subtitle: 'Open an empty calculating grid for financial analysis',
      category: 'Actions',
      icon: Table,
      action: () => {
        if (onNewSheet) onNewSheet();
        onNavigate('sheets');
      },
    },
    {
      id: 'act-help',
      title: 'Keyboard Shortcuts & Guide',
      subtitle: 'View user help, privacy guarantees and cheat sheet',
      category: 'Actions',
      icon: Sparkles,
      action: () => {
        if (onOpenHelp) onOpenHelp();
      },
      shortcut: '?',
    },
  ];

  // Filter commands by search query
  const filtered = commands.filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.subtitle.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  });

  // Handle keyboard events (up/down arrow, enter, esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filtered[selectedIndex];
        if (selected) {
          executeCommand(selected);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex]);

  // Reset index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const executeCommand = (cmd: CommandItem) => {
    if (cmd.action) {
      cmd.action();
    } else if (cmd.tab) {
      onNavigate(cmd.tab);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-start justify-center pt-[10vh] p-4 select-none animate-in fade-in">
      <div 
        className="w-full max-w-2xl bg-white/95 backdrop-blur-2xl rounded-[28px] border border-white/80 shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center gap-3">
          <Search className="w-5 h-5 text-blue-600 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search studios, tools, conversions, actions... (or type 'pdf', 'word', 'ocr')"
            autoFocus
            className="flex-1 bg-transparent text-slate-800 placeholder-slate-400 text-sm sm:text-base font-semibold outline-none"
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-500 font-bold">
            ESC
          </kbd>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">No results found for "{query}"</p>
              <p className="text-xs text-slate-400 mt-1">Try searching "pdf", "convert", "word", or "background"</p>
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={cmd.id}
                  onClick={() => executeCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'hover:bg-slate-100/80 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-blue-600'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold leading-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                          {cmd.title}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/70 text-slate-600'
                        }`}>
                          {cmd.category}
                        </span>
                      </div>
                      <p className={`text-[11px] truncate leading-tight mt-0.5 ${
                        isSelected ? 'text-blue-100' : 'text-slate-500'
                      }`}>
                        {cmd.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {cmd.shortcut && (
                      <kbd className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 border border-slate-200 text-slate-500'
                      }`}>
                        {cmd.shortcut}
                      </kbd>
                    )}
                    <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between font-medium">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px]">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px]">↵</kbd>
              <span>to select</span>
            </span>
          </div>

          <span className="hidden sm:inline text-blue-600 font-semibold">
            Press Ctrl + K anywhere
          </span>
        </div>
      </div>
    </div>
  );
};
