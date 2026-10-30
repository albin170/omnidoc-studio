import React, { useState } from 'react';
import { 
  Sparkles, 
  Search, 
  ArrowRight, 
  FileText, 
  Presentation, 
  Table, 
  Image as ImageIcon, 
  Layers
} from 'lucide-react';
import { STARTER_TEMPLATES } from '../../services/templatesData';
import { TemplateItem, WorkspaceTab } from '../../types';

interface TemplatesHubProps {
  onSelectTemplate: (template: TemplateItem) => void;
}

export const TemplatesHub: React.FC<TemplatesHubProps> = ({
  onSelectTemplate,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = ['All', 'Documents', 'Presentations', 'Spreadsheets', 'Graphics'];

  const filteredTemplates = STARTER_TEMPLATES.filter((tpl) => {
    const matchesCat = selectedCategory === 'All' || tpl.category === selectedCategory;
    const matchesSearch =
      tpl.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              Starter Templates Gallery
            </h1>
          </div>
          <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-xl">
            Jumpstart your work with professionally formatted executive proposals, resumes, investor pitch decks, invoices, and graphics.
          </p>
        </div>

        {/* Search */}
        <div className="w-full md:w-64 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === cat
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTemplates.map((tpl) => (
          <div
            key={tpl.id}
            onClick={() => onSelectTemplate(tpl)}
            className="bg-slate-900/70 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden transition-all hover:-translate-y-1 cursor-pointer group shadow-lg flex flex-col justify-between"
          >
            <div>
              {/* Card Header Gradient Banner */}
              <div
                className={`h-28 bg-gradient-to-tr ${tpl.previewGradient} p-4 flex items-start justify-between relative`}
              >
                <span className="px-2.5 py-1 rounded-lg bg-black/40 backdrop-blur-md text-[11px] font-bold text-white border border-white/20">
                  {tpl.badge}
                </span>

                <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white">
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                  {tpl.category}
                </span>
                <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                  {tpl.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {tpl.description}
                </p>
              </div>
            </div>

            <div className="p-5 pt-0">
              <button className="w-full py-2 rounded-xl bg-slate-800 group-hover:bg-indigo-600 text-slate-300 group-hover:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5">
                <span>Load Template</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
