import React, { useState, useEffect } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Table as TableIcon, 
  Search, 
  DownloadCloud, 
  Upload, 
  Save,
  Clock
} from 'lucide-react';
import { createDocxBlob, convertTextOrDocxToPdf, extractTextFromDocxFile } from '../../services/docxService';
import { escapeHtml } from '../../services/converter';
import saveAs from 'file-saver';
import confetti from 'canvas-confetti';

interface DocxStudioProps {
  initialContent?: string;
  initialTitle?: string;
  onSaveToProjects?: (title: string, data: any) => void;
}

export const DocxStudio: React.FC<DocxStudioProps> = ({
  initialContent,
  initialTitle,
  onSaveToProjects,
}) => {
  const [docTitle, setDocTitle] = useState(initialTitle || 'Untitled Document');
  const [content, setContent] = useState(
    initialContent ||
`# Executive Strategy Overview

## 1. Project Objectives
OmniDoc Studio delivers an end-to-end multi-format document workspace running directly in browser memory.

### Key Milestones
- High-fidelity PDF rendering and vector modification.
- Rich DOCX import and packaging with OpenXML compliance.
- PowerPoint slide generation and presentation decks.
- Tabular data calculations with real spreadsheet formulas.

## 2. Technical Architecture
The core engine executes client-side WebAssembly and JavaScript engines to guarantee 100% offline privacy and zero latency server bottlenecks.`
  );

  // Find & Replace
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [exportFormat, setExportFormat] = useState<'docx' | 'pdf' | 'txt' | 'html'>('docx');
  const [isExporting, setIsExporting] = useState(false);

  // Synchronize state when external file or project is loaded
  useEffect(() => {
    if (initialTitle) setDocTitle(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    if (initialContent !== undefined) setContent(initialContent);
  }, [initialContent]);

  // Statistics
  const wordsCount = content.trim().split(/\s+/).filter(Boolean).length;
  const charsCount = content.length;
  const readTimeMin = Math.max(1, Math.ceil(wordsCount / 200));

  const handleImportDocx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocTitle(file.name.replace(/\.[^/.]+$/, ''));
    if (file.name.endsWith('.docx')) {
      const text = await extractTextFromDocxFile(file);
      setContent(text);
    } else {
      const text = await file.text();
      setContent(text);
    }
  };

  const handleFindReplace = () => {
    if (!findQuery) return;
    const escaped = findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    const updated = content.replace(regex, replaceQuery);
    setContent(updated);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (exportFormat === 'docx') {
        const lines = content.split('\n');
        const items = lines.map((line) => {
          if (line.startsWith('# ')) {
            return { type: 'h1' as const, text: line.replace('# ', '') };
          } else if (line.startsWith('## ')) {
            return { type: 'h2' as const, text: line.replace('## ', '') };
          } else if (line.startsWith('### ')) {
            return { type: 'h3' as const, text: line.replace('### ', '') };
          } else if (line.startsWith('- ') || line.startsWith('• ')) {
            return { type: 'bullet' as const, text: line.replace(/^[-•]\s*/, '') };
          } else {
            return { type: 'paragraph' as const, text: line };
          }
        });

        const docxBlob = await createDocxBlob(docTitle, items);
        saveAs(docxBlob, `${docTitle}.docx`);
      } else if (exportFormat === 'pdf') {
        const pdfBytes = await convertTextOrDocxToPdf(docTitle, content);
        const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
        saveAs(blob, `${docTitle}.pdf`);
      } else if (exportFormat === 'txt') {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, `${docTitle}.txt`);
      } else if (exportFormat === 'html') {
        const escapedTitle = escapeHtml(docTitle);
        const bodyContent = content.split('\n\n').map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('\n');
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapedTitle}</title></head><body><h1>${escapedTitle}</h1>${bodyContent}</body></html>`;
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        saveAs(blob, `${docTitle}.html`);
      }

      confetti({ particleCount: 40, spread: 60 });
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const insertSnippet = (prefix: string, suffix: string = '') => {
    setContent((prev) => `${prev}\n${prefix}Heading${suffix}`);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      {/* Top Action Bar */}
      <div className="h-14 border-b border-slate-800 bg-slate-900/90 px-4 flex items-center justify-between shrink-0 gap-3 overflow-x-auto">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            className="bg-transparent text-sm font-bold text-white border-b border-transparent hover:border-slate-700 focus:border-indigo-500 px-1 py-0.5 outline-none w-48 md:w-64"
            placeholder="Document Title"
          />
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30">
            DOCX
          </span>
        </div>

        {/* Export Controls */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Import DOCX</span>
            <input type="file" accept=".docx,.txt,.html,.md" className="hidden" onChange={handleImportDocx} />
          </label>

          {onSaveToProjects && (
            <button
              onClick={() => onSaveToProjects(docTitle, { content })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-indigo-400" />
              <span>Save</span>
            </button>
          )}

          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 text-xs">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as any)}
              className="bg-transparent text-slate-200 font-semibold px-2 py-1 outline-none uppercase text-xs cursor-pointer"
            >
              <option value="docx">.DOCX</option>
              <option value="pdf">.PDF</option>
              <option value="txt">.TXT</option>
              <option value="html">.HTML</option>
            </select>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer shadow-sm"
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Editor Formatting Toolbar */}
      <div className="h-11 border-b border-slate-800/80 bg-slate-900/60 px-4 flex items-center justify-between shrink-0 overflow-x-auto gap-2">
        <div className="flex items-center gap-1 text-slate-400">
          <button
            onClick={() => insertSnippet('# ')}
            className="p-1.5 rounded hover:bg-slate-800 hover:text-white"
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertSnippet('## ')}
            className="p-1.5 rounded hover:bg-slate-800 hover:text-white"
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertSnippet('### ')}
            className="p-1.5 rounded hover:bg-slate-800 hover:text-white"
            title="Heading 3"
          >
            <Heading3 className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          <button
            onClick={() => setContent((prev) => `${prev} **Bold Text**`)}
            className="p-1.5 rounded hover:bg-slate-800 hover:text-white"
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => setContent((prev) => `${prev} *Italic Text*`)}
            className="p-1.5 rounded hover:bg-slate-800 hover:text-white"
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            onClick={() => insertSnippet('- ')}
            className="p-1.5 rounded hover:bg-slate-800 hover:text-white"
            title="Bullet list"
          >
            <List className="w-4 h-4" />
          </button>

          <button
            onClick={() =>
              setContent(
                (prev) =>
                  `${prev}\n\n| Item | Description | Cost |\n|---|---|---|\n| 1 | Development | $5,000 |\n| 2 | Testing | $2,000 |\n`
              )
            }
            className="p-1.5 rounded hover:bg-slate-800 hover:text-white"
            title="Insert Table"
          >
            <TableIcon className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsFindOpen(!isFindOpen)}
            className={`p-1.5 rounded hover:bg-slate-800 ${isFindOpen ? 'text-indigo-400 bg-slate-800' : ''}`}
            title="Find & Replace"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        {/* Word and character count pill */}
        <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
          <span>{wordsCount} words</span>
          <span>{charsCount} chars</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" />
            {readTimeMin} min read
          </span>
        </div>
      </div>

      {/* Find & Replace Bar */}
      {isFindOpen && (
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center gap-3 text-xs">
          <input
            type="text"
            placeholder="Find text..."
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white outline-none w-48"
          />
          <input
            type="text"
            placeholder="Replace with..."
            value={replaceQuery}
            onChange={(e) => setReplaceQuery(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white outline-none w-48"
          />
          <button
            onClick={handleFindReplace}
            className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer"
          >
            Replace All
          </button>
          <button
            onClick={() => setIsFindOpen(false)}
            className="text-slate-500 hover:text-slate-300 ml-auto"
          >
            Close
          </button>
        </div>
      )}

      {/* Document Writing Surface (A4 styled paper) */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center bg-slate-950">
        <div className="w-full max-w-4xl bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-12 min-h-[750px] flex flex-col">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full flex-1 bg-transparent text-slate-100 font-sans text-sm md:text-base leading-relaxed outline-none resize-none"
            placeholder="Start typing your document or paste text..."
          />
        </div>
      </div>
    </div>
  );
};
