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
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 text-[#F5FAFF] custom-scrollbar">
      {/* Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-white/12 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#A8DEFA]" />
            <h1 className="text-xl md:text-2xl font-bold text-[#F5FAFF] tracking-tight">
              Starter Templates Gallery
            </h1>
          </div>
          <p className="text-xs md:text-sm text-[#A7B8CA] mt-1 max-w-xl">
            Jumpstart your work with professionally formatted executive proposals, resumes, investor pitch decks, invoices, and graphics.
          </p>
        </div>

        {/* Search */}
        <div className="w-full md:w-64 relative">
          <Search className="w-4 h-4 text-[#A8DEFA] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full glass-input rounded-xl pl-9 pr-3 py-2 text-xs text-[#F5FAFF] placeholder:text-[#A7B8CA]/50 outline-none focus:border-[#A8DEFA]"
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
                ? 'glass-btn-primary shadow-md shadow-[#A8DEFA]/20 lg-glow-ice'
                : 'glass-card text-[#A7B8CA] hover:text-[#F5FAFF] border-white/10'
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
            className="glass-card border-white/10 hover:border-[#A8DEFA]/50 rounded-2xl overflow-hidden transition-all hover:-translate-y-1 cursor-pointer group shadow-xl flex flex-col justify-between"
          >
            <div>
              {/* Card Header Gradient Banner */}
              <div
                className={`h-28 bg-gradient-to-tr ${tpl.previewGradient} p-4 flex items-start justify-between relative`}
              >
                <span className="px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-md text-[11px] font-bold text-white border border-white/20">
                  {tpl.badge}
                </span>

                <div className="w-8 h-8 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center text-white">
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A8DEFA]">
                  {tpl.category}
                </span>
                <h3 className="text-base font-bold text-[#F5FAFF] group-hover:text-[#A8DEFA] transition-colors">
                  {tpl.title}
                </h3>
                <p className="text-xs text-[#A7B8CA] leading-relaxed">
                  {tpl.description}
                </p>
              </div>
            </div>

            <div className="p-5 pt-0">
              <button className="w-full py-2 rounded-xl glass-card group-hover:border-[#A8DEFA]/50 text-[#A7B8CA] group-hover:text-[#F5FAFF] text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer">
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
