import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Send, 
  ShieldCheck, 
  AlertCircle, 
  Table, 
  FileText, 
  Calendar, 
  DollarSign, 
  CheckSquare,
  Copy,
  Check
} from 'lucide-react';
import { aiAssistantService } from '../../services/aiAssistantService';
import { AiAssistantMessage } from '../../types';
import { useToast } from '../../services/toastService';

interface AiAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  documentContent: string;
  documentTitle?: string;
}

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({
  isOpen,
  onClose,
  documentContent,
  documentTitle = 'Current Document',
}) => {
  const { addToast } = useToast();
  const [query, setQuery] = useState('');
  const [hasConsent, setHasConsent] = useState(aiAssistantService.hasConsent());
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const [messages, setMessages] = useState<AiAssistantMessage[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content: `Hello! I am your OmniDoc AI Document Assistant. I can summarize "${documentTitle}", extract key dates & totals, answer targeted questions, and cite supporting passages.`,
      timestamp: Date.now(),
      suggestedActions: ['Summarize Document', 'Extract Key Dates & Totals', 'Generate Markdown Table'],
    },
  ]);

  if (!isOpen) return null;

  const handleToggleConsent = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setHasConsent(val);
    aiAssistantService.setConsent(val);
    addToast('info', val ? 'Privacy Consent Granted' : 'Consent Revoked', 'AI assistant processing preferences updated.');
  };

  const handleQuickAction = (action: string) => {
    if (!documentContent.trim()) {
      addToast('warning', 'Empty Document', 'Please open a document with text content to analyze.');
      return;
    }

    if (action.includes('Summarize')) {
      const summaryMsg = aiAssistantService.summarizeDocument(documentContent, documentTitle);
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: 'user', content: 'Please summarize this document with key findings.', timestamp: Date.now() },
        summaryMsg,
      ]);
    } else if (action.includes('Extract')) {
      const entities = aiAssistantService.extractEntities(documentContent);
      const text = [
        `### Extracted Document Entities & Action Items`,
        `**Key Dates Identified (${entities.dates.length})**:`,
        entities.dates.length > 0 ? entities.dates.map((d) => `- ${d}`).join('\n') : '- No explicit date patterns detected.',
        ``,
        `**Monetary Totals & Currencies (${entities.monetaryAmounts.length})**:`,
        entities.monetaryAmounts.length > 0 ? entities.monetaryAmounts.map((m) => `- ${m}`).join('\n') : '- No explicit financial currency figures detected.',
        ``,
        `**Action Items & Obligations (${entities.actionItems.length})**:`,
        entities.actionItems.map((a) => `- ${a}`).join('\n'),
      ].join('\n');

      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: 'user', content: 'Extract key dates, amounts, and action items.', timestamp: Date.now() },
        { id: `ai-${Date.now()}`, role: 'assistant', content: text, timestamp: Date.now() },
      ]);
    } else if (action.includes('Table')) {
      const tableMarkdown = aiAssistantService.generateTableFromText(documentContent);
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: 'user', content: 'Convert key points into a structured Markdown table.', timestamp: Date.now() },
        { id: `ai-${Date.now()}`, role: 'assistant', content: tableMarkdown, timestamp: Date.now() },
      ]);
    }
  };

  const handleSendQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    if (!documentContent.trim()) {
      addToast('warning', 'Empty Document', 'Active document has no text content to search.');
      return;
    }

    const userMsg: AiAssistantMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: Date.now(),
    };

    const aiMsg = aiAssistantService.answerQuestion(documentContent, query);
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setQuery('');
  };

  const handleCopy = (content: string, idx: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
    addToast('info', 'Copied to Clipboard', 'AI response text copied.');
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col text-slate-100 animate-slideLeft">
      {/* Top Header */}
      <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/95 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white flex items-center gap-1.5">
              OmniDoc AI Assistant
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                v2.0
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 truncate max-w-[220px]">
              {documentTitle}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Privacy Notice & Consent Bar */}
      <div className="p-3 bg-slate-950 border-b border-slate-800/80 text-[11px] text-slate-300 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Local execution mode &bull; Zero tracking</span>
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200">
          <input
            type="checkbox"
            checked={hasConsent}
            onChange={handleToggleConsent}
            className="w-3.5 h-3.5 accent-purple-600 rounded cursor-pointer"
          />
          <span className="font-semibold text-[10px]">Permission active</span>
        </label>
      </div>

      {/* Quick Action Badges */}
      <div className="p-3 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto shrink-0 bg-slate-900/60 text-xs">
        <button
          onClick={() => handleQuickAction('Summarize')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0 font-medium border border-slate-700 cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5 text-blue-400" />
          <span>Summarize</span>
        </button>
        <button
          onClick={() => handleQuickAction('Extract')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0 font-medium border border-slate-700 cursor-pointer"
        >
          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
          <span>Dates &amp; Totals</span>
        </button>
        <button
          onClick={() => handleQuickAction('Table')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0 font-medium border border-slate-700 cursor-pointer"
        >
          <Table className="w-3.5 h-3.5 text-purple-400" />
          <span>To Table</span>
        </button>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-xs">
        {messages.map((m, idx) => (
          <div
            key={m.id || idx}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[92%] p-3.5 rounded-2xl relative group ${
                m.role === 'user'
                  ? 'bg-purple-600 text-white rounded-br-none shadow-md'
                  : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm'
              }`}
            >
              {m.role === 'assistant' && (
                <button
                  onClick={() => handleCopy(m.content, idx)}
                  className="absolute top-2 right-2 p-1 rounded hover:bg-slate-800 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Copy response"
                >
                  {copiedIdx === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}

              <div className="whitespace-pre-wrap leading-relaxed select-text">
                {m.content}
              </div>

              {/* Citations pill list */}
              {m.citations && m.citations.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Verified Document Citations
                  </span>
                  {m.citations.map((c, cIdx) => (
                    <div
                      key={cIdx}
                      className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px] text-slate-300 font-mono"
                    >
                      <span className="text-purple-400 font-bold block mb-0.5">
                        [Section / Page {c.pageNumber || 1}]
                      </span>
                      <span className="italic text-slate-400">&quot;{c.snippet}&quot;</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <span className="text-[9px] text-slate-500 mt-1 px-1">
              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>

      {/* Input bar */}
      <form onSubmit={handleSendQuery} className="p-3 border-t border-slate-800 bg-slate-950/80 shrink-0 flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question about this document..."
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500"
        />
        <button
          type="submit"
          className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30 cursor-pointer disabled:opacity-40"
          disabled={!query.trim()}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
