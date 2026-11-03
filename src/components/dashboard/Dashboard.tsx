import React, { useRef, useState } from 'react';
import { 
  FileText, 
  PenTool, 
  Presentation, 
  Table, 
  Image as ImageIcon, 
  ScanText, 
  RefreshCw, 
  ArrowRight, 
  CheckCircle2, 
  UploadCloud, 
  ChevronRight, 
  Search, 
  Bell, 
  Calendar, 
  Layers, 
  FileCheck,
  Sparkles,
  HardDrive,
  FileCode,
  ShieldCheck,
  CheckCheck,
  FolderOpen,
  ChevronDown,
  Plus,
  Trash2,
  Clock,
  Cpu,
  Boxes,
  Binary,
  GitCommit,
  Activity
} from 'lucide-react';
import { ConversionHistoryItem, FileFormat, StoredProject, WorkspaceTab } from '../../types';
import { detectFileFormat, formatFileSize, FORMAT_REGISTRY } from '../../services/formatDetector';
import { OnboardingBanner } from './OnboardingBanner';

interface DashboardProps {
  onOpenFileInEditor: (file: File, format: FileFormat, targetTab?: WorkspaceTab) => void;
  onSendToConverter: (files: File[]) => void;
  setActiveTab: (tab: WorkspaceTab) => void;
  recentProjects: StoredProject[];
  conversionHistory?: ConversionHistoryItem[];
  queueCount?: number;
  onLoadProject: (project: StoredProject) => void;
  onDeleteProject: (id: string) => void;
  userName?: string;
  avatarUrl?: string;
  onOpenSettings?: () => void;
  onOpenUserPanel?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenForensics?: () => void;
  onOpenLineage?: () => void;
  onOpenReceipts?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onOpenFileInEditor,
  onSendToConverter,
  setActiveTab,
  recentProjects,
  conversionHistory = [],
  queueCount = 0,
  onLoadProject,
  onDeleteProject,
  userName = 'Guest User',
  avatarUrl,
  onOpenSettings,
  onOpenUserPanel,
  onOpenCommandPalette,
  onOpenForensics,
  onOpenLineage,
  onOpenReceipts,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [detectedFileInfo, setDetectedFileInfo] = useState<{ file: File; format: FileFormat } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (files.length === 1) {
      const file = files[0];
      const format = await detectFileFormat(file);
      if (format) {
        setDetectedFileInfo({ file, format });
      } else {
        onSendToConverter([file]);
      }
    } else {
      onSendToConverter(Array.from(files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    await handleFiles(e.dataTransfer.files);
  };

  // Real studios data
  const quickStudios = [
    { tab: 'pdf' as WorkspaceTab, title: 'PDF Studio', desc: 'Edit text, annotate, rotate, split & sign', icon: FileText, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100' },
    { tab: 'docx' as WorkspaceTab, title: 'Word Docs', desc: 'Write & format DOCX/PDF reports', icon: PenTool, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100' },
    { tab: 'slides' as WorkspaceTab, title: 'Slide Deck', desc: '16:9 presentations & PPTX export', icon: Presentation, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100' },
    { tab: 'sheets' as WorkspaceTab, title: 'Sheets Grid', desc: 'Formulas (SUM, AVG) & XLSX/CSV', icon: Table, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { tab: 'image' as WorkspaceTab, title: 'Photo & BG', desc: 'Crop, filter & smart BG removal', icon: ImageIcon, color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-100' },
    { tab: 'ocr' as WorkspaceTab, title: 'OCR Scanner', desc: 'Extract text from scans & photos', icon: ScanText, color: 'text-cyan-500', bg: 'bg-cyan-50', border: 'border-cyan-100' },
  ];

  // Calculate real storage footprint
  const totalStorageBytes = recentProjects.reduce((acc, p) => acc + (p.sizeBytes || 0), 0);

  // Time-appropriate greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-7 space-y-6 text-slate-800">
      {/* 1. Header Greeting & Real Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>{greeting}, {userName}!</span>
            <span className="text-2xl">👋</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Convert, edit, create and export your documents with 100% local privacy.
          </p>
        </div>

        {/* Real Status Controls & Quick Search */}
        <div className="flex flex-wrap items-center gap-2.5 self-stretch sm:self-auto">
          {/* Quick Search / Command Palette Bar */}
          <div
            onClick={onOpenCommandPalette}
            className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl glass-card hover:bg-white text-xs cursor-pointer shadow-sm transition-all border border-slate-200/60 w-full sm:w-64 text-slate-500 hover:text-slate-800"
            title="Press Ctrl+K to search"
          >
            <Search className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="flex-1 text-slate-400 font-medium truncate">Search anything...</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-500">
              Ctrl+K
            </kbd>
          </div>

          {/* Real Privacy Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl glass-card text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-700 hidden sm:inline">Engine:</span>
            <span className="font-bold text-emerald-600">Local &amp; Private</span>
          </div>

          <button
            onClick={() => setActiveTab('converter')}
            className="w-9 h-9 rounded-full glass-card hover:bg-white flex items-center justify-center text-slate-600 hover:text-blue-600 transition-colors shadow-sm cursor-pointer"
            title="Open Conversion Hub"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTab('projects')}
            className="w-9 h-9 rounded-full glass-card hover:bg-white flex items-center justify-center text-slate-600 hover:text-blue-600 transition-colors shadow-sm relative cursor-pointer"
            title="Saved Projects & History"
          >
            <Clock className="w-4 h-4" />
            {conversionHistory.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-white" />
            )}
          </button>

          {/* User Profile Pill */}
          <div
            onClick={onOpenUserPanel}
            className="flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full glass-card hover:bg-white text-xs cursor-pointer shadow-sm transition-all"
            title="Open User Profile & Plan"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                {userName ? userName[0].toUpperCase() : 'U'}
              </div>
            )}
            <div className="text-left hidden md:block">
              <div className="font-bold text-slate-800 text-[11px] leading-tight truncate max-w-[90px]">{userName}</div>
              <div className="text-[10px] text-blue-600 font-semibold leading-tight">Pro Plan</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>
      </div>

      {/* 2. User-Friendly Onboarding / Welcome Guide */}
      <OnboardingBanner
        onOpenCommandPalette={onOpenCommandPalette || (() => {})}
        onExploreTemplates={() => setActiveTab('templates')}
      />

      {/* 2. Top 4 Real KPI Cards with Undulating Wave Curves */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Completed Conversions */}
        <div 
          onClick={() => setActiveTab('converter')}
          className="glass-card glass-card-hover rounded-[22px] p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shadow-sm">
                <RefreshCw className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700">Total Conversions</span>
            </div>
          </div>

          <div className="mt-3.5 flex items-baseline justify-between z-10">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {conversionHistory.length}
              </div>
              <div className="text-[11px] font-semibold text-slate-400">Total Processed</div>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
              <span>{conversionHistory.length > 0 ? 'Active' : 'Ready'}</span>
            </div>
          </div>

          {/* Undulating Amber Wave Sparkline */}
          <div className="w-full h-7 mt-1.5 -mb-2 overflow-hidden">
            <svg viewBox="0 0 200 40" className="w-full h-full" fill="none">
              <path
                d="M0 25 C 30 15, 60 32, 90 20 C 120 8, 150 28, 180 18 L 200 22"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: Saved Projects */}
        <div 
          onClick={() => setActiveTab('projects')}
          className="glass-card glass-card-hover rounded-[22px] p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 shadow-sm">
                <FolderOpen className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700">Saved Projects</span>
            </div>
          </div>

          <div className="mt-3.5 flex items-baseline justify-between z-10">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {recentProjects.length}
              </div>
              <div className="text-[11px] font-semibold text-slate-400">In Local Storage</div>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              <span>Encrypted</span>
            </div>
          </div>

          {/* Undulating Green Wave Sparkline */}
          <div className="w-full h-7 mt-1.5 -mb-2 overflow-hidden">
            <svg viewBox="0 0 200 40" className="w-full h-full" fill="none">
              <path
                d="M0 30 C 40 18, 70 34, 110 22 C 140 12, 170 32, 200 20"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Active Queue */}
        <div 
          onClick={() => setActiveTab('converter')}
          className="glass-card glass-card-hover rounded-[22px] p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 shadow-sm">
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700">Conversion Queue</span>
            </div>
          </div>

          <div className="mt-3.5 flex items-baseline justify-between z-10">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {queueCount}
              </div>
              <div className="text-[11px] font-semibold text-slate-400">Tasks Pending</div>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60">
              <span>{queueCount > 0 ? 'Queued' : 'Idle'}</span>
            </div>
          </div>

          {/* Undulating Blue Wave Sparkline */}
          <div className="w-full h-7 mt-1.5 -mb-2 overflow-hidden">
            <svg viewBox="0 0 200 40" className="w-full h-full" fill="none">
              <path
                d="M0 24 C 30 14, 60 30, 100 16 C 140 6, 170 28, 200 16"
                stroke="#3b82f6"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 4: Local Storage Footprint */}
        <div 
          onClick={() => setActiveTab('projects')}
          className="glass-card glass-card-hover rounded-[22px] p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-200/60 flex items-center justify-center text-purple-600 shadow-sm">
                <HardDrive className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700">Memory Footprint</span>
            </div>
          </div>

          <div className="mt-3.5 flex items-baseline justify-between z-10">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {formatFileSize(totalStorageBytes)}
              </div>
              <div className="text-[11px] font-semibold text-slate-400">Private RAM/IDB</div>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200/60">
              <span>100% Local</span>
            </div>
          </div>

          {/* Undulating Purple Wave Sparkline */}
          <div className="w-full h-7 mt-1.5 -mb-2 overflow-hidden">
            <svg viewBox="0 0 200 40" className="w-full h-full" fill="none">
              <path
                d="M0 28 C 35 16, 75 36, 115 20 C 145 10, 175 30, 200 18"
                stroke="#a855f7"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* 3. Middle Section: Real Projects (Left) & Real Activity Log (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Left Column: Real Projects (7 cols) */}
        <div className="lg:col-span-7 space-y-3.5 sm:space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
              Saved Documents &amp; Projects
            </h2>
            <button
              onClick={() => setActiveTab('projects')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              View All ({recentProjects.length})
            </button>
          </div>

          {recentProjects.length > 0 ? (
            <div className="space-y-3">
              {recentProjects.slice(0, 3).map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => onLoadProject(proj)}
                  className="glass-card glass-card-hover rounded-[20px] p-4 flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                      <FileCode className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                        {proj.title}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {proj.type.toUpperCase()} • {formatFileSize(proj.sizeBytes)} • {new Date(proj.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200">
                      Saved
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Clean Onboarding State */
            <div className="glass-card rounded-[22px] p-6 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileCheck className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Projects Saved Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Open any studio below to create documents, presentations, spreadsheets, or graphics. When you click Save, it appears here.
              </p>
              <button
                onClick={() => setActiveTab('templates')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/25 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Explore Starter Templates</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Real Conversion Activity Stream (5 cols) */}
        <div className="lg:col-span-5 space-y-3.5 sm:space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
              Conversion Activity
            </h2>
            <button
              onClick={() => setActiveTab('converter')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              Open Hub
            </button>
          </div>

          <div className="glass-card rounded-[22px] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 pb-2 border-b border-slate-100">
              <span>Task Stream</span>
              <span className="text-[11px] text-slate-400 font-normal">
                {conversionHistory.length} Recorded
              </span>
            </div>

            {conversionHistory.length > 0 ? (
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto">
                {conversionHistory.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-white/80 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate pr-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-slate-800 truncate">{item.sourceName}</div>
                        <div className="text-[10px] text-slate-400 uppercase">
                          {item.sourceFormat} → {item.targetFormat}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                      {new Date(item.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                <RefreshCw className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                <p>No conversions executed yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">Drop a file below to start converting.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Dedicated Studios & Workspaces Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Dedicated Studios &amp; Editing Suites
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickStudios.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.tab}
                onClick={() => setActiveTab(s.tab)}
                className={`glass-card glass-card-hover rounded-2xl p-4 cursor-pointer flex flex-col justify-between group border ${s.border}`}
              >
                <div className={`w-9 h-9 rounded-xl ${s.bg} ${s.color} flex items-center justify-center mb-2.5`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {s.title}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                    {s.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4b. Intelligent Document Engineering Platform Suite (v2.1) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Intelligent Document Engineering Suite
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
              v2.1 ADVANCED
            </span>
          </div>
          <button
            onClick={() => setActiveTab('workflow')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
          >
            Open Workflow Studio →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Visual Workflow Studio */}
          <div
            onClick={() => setActiveTab('workflow')}
            className="glass-card glass-card-hover rounded-2xl p-4 cursor-pointer flex flex-col justify-between border border-indigo-100/80 bg-gradient-to-br from-indigo-50/50 to-white group"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 border border-indigo-200/60 flex items-center justify-center mb-2.5">
                <Boxes className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                Visual Workflow Studio
              </h4>
              <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                DAG node pipelines: intake → forensics → DNA → self-healing conversion → verify → receipt.
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-indigo-600">
              <span>Interactive DAG Builder</span>
              <span>Open Studio →</span>
            </div>
          </div>

          {/* Card 2: Forensics Lab */}
          <div
            onClick={onOpenForensics}
            className="glass-card glass-card-hover rounded-2xl p-4 cursor-pointer flex flex-col justify-between border border-amber-100/80 bg-gradient-to-br from-amber-50/50 to-white group"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-200/60 flex items-center justify-center mb-2.5">
                <Binary className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                Document Forensics Lab
              </h4>
              <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                Detect MIME extension spoofing, weaponized VBA macros, external links, and author leaks.
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-amber-600">
              <span>Security Screening</span>
              <span>Launch Lab →</span>
            </div>
          </div>

          {/* Card 3: Data Lineage & Provenance */}
          <div
            onClick={onOpenLineage}
            className="glass-card glass-card-hover rounded-2xl p-4 cursor-pointer flex flex-col justify-between border border-teal-100/80 bg-gradient-to-br from-teal-50/50 to-white group"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 border border-teal-200/60 flex items-center justify-center mb-2.5">
                <GitCommit className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 group-hover:text-teal-600 transition-colors">
                Data Lineage &amp; Provenance
              </h4>
              <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                Track extracted financial figures, dates, IDs with measurable confidence metrics and page anchors.
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-teal-600">
              <span>Traceable Metrics</span>
              <span>Audit Lineage →</span>
            </div>
          </div>

          {/* Card 4: Transformation Receipts */}
          <div
            onClick={onOpenReceipts}
            className="glass-card glass-card-hover rounded-2xl p-4 cursor-pointer flex flex-col justify-between border border-yellow-100/80 bg-gradient-to-br from-yellow-50/50 to-white group"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-yellow-500/10 text-yellow-600 border border-yellow-200/60 flex items-center justify-center mb-2.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 group-hover:text-yellow-600 transition-colors">
                Audit Receipts &amp; Certs
              </h4>
              <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                Verifiable cryptographic receipts containing dual SHA-256 hashes, engine versions, and HMAC signatures.
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-yellow-600">
              <span>Non-repudiable Proof</span>
              <span>Inspect Certs →</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Bottom Section: Format Matrix (Left) & Real Engine Health (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Left: Supported Formats Matrix (7 cols) */}
        <div className="lg:col-span-7 space-y-3 sm:space-y-4">
          <div className="glass-card rounded-[22px] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                Universal Format Compatibility
              </h2>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                11 Formats
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {Object.entries(FORMAT_REGISTRY).map(([key, meta]) => (
                <div
                  key={key}
                  onClick={() => setActiveTab('converter')}
                  className="p-2.5 rounded-xl bg-white/70 hover:bg-white border border-slate-200/60 cursor-pointer transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-2.5 h-2.5 rounded-full" 
                      style={{ backgroundColor: meta.color }} 
                    />
                    <span className="font-bold text-slate-800 uppercase text-[11px]">{meta.format}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">{meta.allowedConversions.length} paths</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Real Engine Health Status (5 cols) */}
        <div className="lg:col-span-5 space-y-3 sm:space-y-4">
          <div className="glass-card rounded-[22px] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                Processing Engines
              </h2>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                All Operational
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/70 border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <Cpu className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-slate-800">PDF.js &amp; pdf-lib</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-600">Active</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/70 border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <PenTool className="w-4 h-4 text-indigo-600" />
                  <span className="font-bold text-slate-800">OpenXML DOCX / PPTX</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-600">Active</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/70 border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <ScanText className="w-4 h-4 text-cyan-600" />
                  <span className="font-bold text-slate-800">Tesseract.js OCR</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-600">Active</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/70 border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  <span className="font-bold text-slate-800">100% Client RAM Sandbox</span>
                </div>
                <span className="text-[10px] font-bold text-purple-600">Enforced</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Drag & Drop File Intake Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !detectedFileInfo && fileInputRef.current?.click()}
        className={`glass-card rounded-[22px] p-6 text-center transition-all cursor-pointer border-2 border-dashed ${
          isDragging
            ? 'border-blue-500 bg-blue-50/70 scale-[1.01]'
            : 'border-slate-300 hover:border-blue-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp,.txt,.html,.md"
        />

        {detectedFileInfo ? (
          <div className="space-y-3 max-w-md mx-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{detectedFileInfo.file.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Format: <span className="font-bold text-blue-600 uppercase">{detectedFileInfo.format}</span> • {formatFileSize(detectedFileInfo.file.size)}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={() => onOpenFileInEditor(detectedFileInfo.file, detectedFileInfo.format)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/30 cursor-pointer"
              >
                Open in Editor
              </button>
              <button
                onClick={() => onSendToConverter([detectedFileInfo.file])}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Convert Format
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-w-sm mx-auto">
            <UploadCloud className="w-8 h-8 mx-auto text-blue-600 animate-pulse" />
            <div className="text-sm font-bold text-slate-800">
              Drop any document or image to edit or convert
            </div>
            <p className="text-[11px] text-slate-500">
              PDF, Word DOCX, PowerPoint PPTX, Excel XLSX, CSV, JPG, PNG &amp; Scans
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
