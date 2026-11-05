import React, { useState, useEffect, useRef } from 'react';
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
  Clock,
  Undo,
  Redo,
  RemoveFormatting,
  X
} from 'lucide-react';
import { 
  createDocxBlob, 
  convertTextOrDocxToPdf, 
  extractTextFromDocxFile,
  htmlToDocxItems,
  sanitizeHtml
} from '../../services/docxService';
import { escapeHtml } from '../../services/converter';
import saveAs from 'file-saver';
import confetti from 'canvas-confetti';

interface DocxStudioProps {
  initialContent?: string;
  initialTitle?: string;
  onSaveToProjects?: (title: string, data: any) => void;
}

const DEFAULT_INITIAL_HTML = `
<h1>Executive Strategy Overview</h1>
<h2>1. Project Objectives</h2>
<p>OmniDoc Studio delivers an end-to-end multi-format document workspace running directly in browser memory.</p>
<h3>Key Milestones</h3>
<ul>
  <li>High-fidelity PDF rendering and vector modification.</li>
  <li>Rich DOCX import and packaging with OpenXML compliance.</li>
  <li>PowerPoint slide generation and presentation decks.</li>
  <li>Tabular data calculations with real spreadsheet formulas.</li>
</ul>
<h2>2. Technical Architecture</h2>
<p>The core engine executes client-side WebAssembly and JavaScript engines to guarantee <strong>100% offline privacy</strong> and <em>zero latency server bottlenecks</em>.</p>
<table style="width:100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 12px;">
  <thead>
    <tr style="background-color: #1e293b; color: #f8fafc;">
      <th style="border: 1px solid #475569; padding: 8px;">Module</th>
      <th style="border: 1px solid #475569; padding: 8px;">Standard</th>
      <th style="border: 1px solid #475569; padding: 8px;">Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border: 1px solid #334155; padding: 8px;">PDF Engine</td>
      <td style="border: 1px solid #334155; padding: 8px;">ISO 32000-1</td>
      <td style="border: 1px solid #334155; padding: 8px; color: #34d399;">Production Verified</td>
    </tr>
    <tr>
      <td style="border: 1px solid #334155; padding: 8px;">Word Engine</td>
      <td style="border: 1px solid #334155; padding: 8px;">ECMA-376</td>
      <td style="border: 1px solid #334155; padding: 8px; color: #34d399;">Production Verified</td>
    </tr>
  </tbody>
</table>
`;

export const DocxStudio: React.FC<DocxStudioProps> = ({
  initialContent,
  initialTitle,
  onSaveToProjects,
}) => {
  const [docTitle, setDocTitle] = useState(initialTitle || 'Strategic Document');
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [exportFormat, setExportFormat] = useState<'docx' | 'pdf' | 'txt' | 'html'>('docx');
  const [isExporting, setIsExporting] = useState(false);
  const [wordsCount, setWordsCount] = useState(0);
  const [charsCount, setCharsCount] = useState(0);

  const editorRef = useRef<HTMLDivElement>(null);

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current) {
      if (initialContent) {
        if (initialContent.includes('<') && initialContent.includes('>')) {
          editorRef.current.innerHTML = sanitizeHtml(initialContent);
        } else {
          // Plain text / markdown to paragraphs
          const paragraphs = initialContent
            .split('\n\n')
            .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
            .join('');
          editorRef.current.innerHTML = paragraphs;
        }
      } else {
        editorRef.current.innerHTML = DEFAULT_INITIAL_HTML;
      }
      updateStats();
    }
  }, [initialContent]);

  useEffect(() => {
    if (initialTitle) setDocTitle(initialTitle);
  }, [initialTitle]);

  const updateStats = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    setWordsCount(words);
    setCharsCount(text.length);
  };

  const executeCommand = (cmd: string, val: string | undefined = undefined) => {
    document.execCommand(cmd, false, val);
    if (editorRef.current) {
      editorRef.current.focus();
      updateStats();
    }
  };

  const handleInsertTable = () => {
    const tableHtml = `
      <table style="width:100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 12px;">
        <thead>
          <tr style="background-color: #1e293b; color: #f8fafc;">
            <th style="border: 1px solid #475569; padding: 8px;">Header 1</th>
            <th style="border: 1px solid #475569; padding: 8px;">Header 2</th>
            <th style="border: 1px solid #475569; padding: 8px;">Header 3</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #334155; padding: 8px;">Cell 1</td>
            <td style="border: 1px solid #334155; padding: 8px;">Cell 2</td>
            <td style="border: 1px solid #334155; padding: 8px;">Cell 3</td>
          </tr>
          <tr>
            <td style="border: 1px solid #334155; padding: 8px;">Cell 4</td>
            <td style="border: 1px solid #334155; padding: 8px;">Cell 5</td>
            <td style="border: 1px solid #334155; padding: 8px;">Cell 6</td>
          </tr>
        </tbody>
      </table><p><br></p>
    `;
    executeCommand('insertHTML', tableHtml);
  };

  const handleImportDocx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocTitle(file.name.replace(/\.[^/.]+$/, ''));
    try {
      if (file.name.endsWith('.docx')) {
        const text = await extractTextFromDocxFile(file);
        if (editorRef.current) {
          const paras = text.split('\n\n').filter(Boolean).map((p) => `<p>${escapeHtml(p)}</p>`).join('');
          editorRef.current.innerHTML = paras || `<p>${escapeHtml(text)}</p>`;
        }
      } else if (file.name.endsWith('.html')) {
        const html = await file.text();
        if (editorRef.current) {
          editorRef.current.innerHTML = html;
        }
      } else {
        const text = await file.text();
        if (editorRef.current) {
          editorRef.current.innerText = text;
        }
      }
      updateStats();
      confetti({ particleCount: 30, spread: 50 });
    } catch (err: any) {
      console.error('Import failed:', err);
      alert('Failed to import file: ' + (err.message || 'Unknown error'));
    }
  };

  const handleFindReplace = () => {
    if (!findQuery || !editorRef.current) return;
    const currentHtml = editorRef.current.innerHTML;
    const escaped = findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    editorRef.current.innerHTML = currentHtml.replace(regex, replaceQuery);
    updateStats();
  };

  const handleExport = async () => {
    if (!editorRef.current) return;
    setIsExporting(true);
    const html = editorRef.current.innerHTML;
    const text = editorRef.current.innerText;

    try {
      if (exportFormat === 'docx') {
        const items = htmlToDocxItems(html);
        const docxBlob = await createDocxBlob(docTitle, items);
        saveAs(docxBlob, `${docTitle}.docx`);
      } else if (exportFormat === 'pdf') {
        const pdfBytes = await convertTextOrDocxToPdf(docTitle, text);
        const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
        saveAs(blob, `${docTitle}.pdf`);
      } else if (exportFormat === 'txt') {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, `${docTitle}.txt`);
      } else if (exportFormat === 'html') {
        const cleanBody = sanitizeHtml(html);
        const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(docTitle)}</title></head><body style="font-family:sans-serif;max-width:800px;margin:40px auto;line-height:1.6;"><h1>${escapeHtml(docTitle)}</h1>${cleanBody}</body></html>`;
        const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
        saveAs(blob, `${docTitle}.html`);
      }

      confetti({ particleCount: 40, spread: 60 });
    } catch (err: any) {
      console.error('Export failed:', err);
      alert('Export failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  const readTimeMin = Math.max(1, Math.ceil(wordsCount / 200));

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#080B18]/60 text-[#F4F5FF]">
      {/* Top Action Bar */}
      <div className="h-14 border-b border-white/10 bg-[#11152A]/85 backdrop-blur-2xl px-4 flex items-center justify-between shrink-0 gap-3 overflow-x-auto">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            className="bg-transparent text-sm font-bold text-[#F4F5FF] border-b border-transparent hover:border-white/20 focus:border-[#8B7CFF] px-1 py-0.5 outline-none w-48 md:w-64 transition-colors"
            placeholder="Document Title"
          />
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#8B7CFF]/20 text-[#8B7CFF] font-semibold border border-[#8B7CFF]/30">
            RICH DOCX
          </span>
        </div>

        {/* Export Controls */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card hover:border-[#42D6E8]/50 text-[#F4F5FF] text-xs font-semibold cursor-pointer transition-all">
            <Upload className="w-3.5 h-3.5 text-[#42D6E8]" />
            <span className="hidden sm:inline">Import DOCX</span>
            <input type="file" accept=".docx,.txt,.html,.md" className="hidden" onChange={handleImportDocx} />
          </label>

          {onSaveToProjects && (
            <button
              onClick={() => onSaveToProjects(docTitle, { content: editorRef.current?.innerHTML })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card hover:border-[#8B7CFF]/50 text-[#F4F5FF] text-xs font-semibold cursor-pointer transition-all"
            >
              <Save className="w-3.5 h-3.5 text-[#8B7CFF]" />
              <span>Save</span>
            </button>
          )}

          <div className="flex items-center glass-card border-white/10 rounded-xl p-0.5 text-xs">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as any)}
              className="bg-transparent text-[#F4F5FF] font-semibold px-2.5 py-1 outline-none uppercase text-xs cursor-pointer"
            >
              <option value="docx" className="bg-[#11152A] text-white">.DOCX</option>
              <option value="pdf" className="bg-[#11152A] text-white">.PDF</option>
              <option value="txt" className="bg-[#11152A] text-white">.TXT</option>
              <option value="html" className="bg-[#11152A] text-white">.HTML</option>
            </select>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3.5 py-1 rounded-lg glass-btn-primary text-xs font-semibold cursor-pointer shadow-md shadow-[#8B7CFF]/20"
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Editor Formatting Toolbar */}
      <div className="h-11 border-b border-white/10 bg-[#11152A]/60 backdrop-blur-xl px-4 flex items-center justify-between shrink-0 overflow-x-auto gap-2 text-[#9BA3BD]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => executeCommand('undo')}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] hover:text-[#F4F5FF] transition-colors"
            title="Undo"
          >
            <Undo className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => executeCommand('redo')}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] hover:text-[#F4F5FF] transition-colors"
            title="Redo"
          >
            <Redo className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Heading formats */}
          <button
            onClick={() => executeCommand('formatBlock', '<h1>')}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] hover:text-[#F4F5FF] transition-colors"
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            onClick={() => executeCommand('formatBlock', '<h2>')}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] hover:text-[#F4F5FF] transition-colors"
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => executeCommand('formatBlock', '<h3>')}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] hover:text-[#F4F5FF] transition-colors"
            title="Heading 3"
          >
            <Heading3 className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Inline styles */}
          <button
            onClick={() => executeCommand('bold')}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] hover:text-[#F4F5FF] font-bold transition-colors"
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => executeCommand('italic')}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] hover:text-[#F4F5FF] italic transition-colors"
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            onClick={() => executeCommand('underline')}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] hover:text-[#F4F5FF] underline transition-colors"
            title="Underline (Ctrl+U)"
          >
            <Underline className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Lists */}
          <button
            onClick={() => executeCommand('insertUnorderedList')}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] hover:text-[#F4F5FF] transition-colors"
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => executeCommand('insertOrderedList')}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] hover:text-[#F4F5FF] transition-colors"
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Alignment */}
          <button
            onClick={() => executeCommand('justifyLeft')}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] hover:text-[#F4F5FF] transition-colors"
            title="Align Left"
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => executeCommand('justifyCenter')}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] hover:text-[#F4F5FF] transition-colors"
            title="Align Center"
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            onClick={() => executeCommand('justifyRight')}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] hover:text-[#F4F5FF] transition-colors"
            title="Align Right"
          >
            <AlignRight className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Table */}
          <button
            onClick={handleInsertTable}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] hover:text-[#F4F5FF] transition-colors"
            title="Insert Table"
          >
            <TableIcon className="w-4 h-4 text-[#42D6E8]" />
          </button>

          {/* Clear format */}
          <button
            onClick={() => executeCommand('removeFormat')}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] hover:text-[#F4F5FF] transition-colors"
            title="Clear Formatting"
          >
            <RemoveFormatting className="w-4 h-4" />
          </button>

          {/* Search */}
          <button
            onClick={() => setIsFindOpen(!isFindOpen)}
            className={`p-1.5 rounded-lg transition-colors ${isFindOpen ? 'text-[#8B7CFF] bg-[#8B7CFF]/20 border border-[#8B7CFF]/30' : 'hover:bg-white/[0.06] hover:text-[#F4F5FF]'}`}
            title="Find & Replace"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        {/* Word and character count */}
        <div className="flex items-center gap-3 text-[11px] text-[#9BA3BD] font-mono">
          <span>{wordsCount} words</span>
          <span>{charsCount} chars</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#42D6E8]" />
            {readTimeMin} min read
          </span>
        </div>
      </div>

      {/* Find & Replace Bar */}
      {isFindOpen && (
        <div className="p-3 bg-[#11152A]/90 backdrop-blur-xl border-b border-white/10 flex items-center gap-3 text-xs">
          <input
            type="text"
            placeholder="Find text..."
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            className="glass-input rounded-xl px-2.5 py-1 text-[#F4F5FF] outline-none w-48"
          />
          <input
            type="text"
            placeholder="Replace with..."
            value={replaceQuery}
            onChange={(e) => setReplaceQuery(e.target.value)}
            className="glass-input rounded-xl px-2.5 py-1 text-[#F4F5FF] outline-none w-48"
          />
          <button
            onClick={handleFindReplace}
            className="px-3 py-1 rounded-xl glass-btn-primary font-semibold cursor-pointer shadow-md shadow-[#8B7CFF]/20"
          >
            Replace All
          </button>
          <button
            onClick={() => setIsFindOpen(false)}
            className="text-[#9BA3BD] hover:text-[#F4F5FF] p-1 rounded-lg ml-auto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Document Writing Surface (Aurora Glass styled document paper) */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center bg-[#080B18]/60 custom-scrollbar">
        <div className="w-full max-w-4xl glass-panel border border-white/15 rounded-3xl shadow-2xl p-6 md:p-12 min-h-[750px] flex flex-col text-[#F4F5FF]">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={updateStats}
            className="w-full flex-1 outline-none text-[#F4F5FF] font-sans text-sm md:text-base leading-relaxed space-y-3 focus:ring-0 [&>h1]:text-2xl [&>h1]:font-black [&>h1]:text-[#F4F5FF] [&>h1]:mb-3 [&>h2]:text-xl [&>h2]:font-bold [&>h2]:text-[#F4F5FF] [&>h2]:mt-4 [&>h2]:mb-2 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:text-[#42D6E8] [&>h3]:mt-3 [&>h3]:mb-1 [&>p]:mb-2 [&>p]:text-[#F4F5FF]/90 [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:mb-2 [&>ol]:list-decimal [&>ol]:ml-6 [&>ol]:mb-2 [&>table]:w-full [&>table]:border-collapse [&>table]:my-3 [&>table_th]:border [&>table_th]:border-white/20 [&>table_th]:p-2 [&>table_th]:bg-white/[0.06] [&>table_td]:border [&>table_td]:border-white/10 [&>table_td]:p-2"
          />
        </div>
      </div>
    </div>
  );
};
