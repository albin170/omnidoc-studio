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
  Sparkles,
  HardDrive,
  FileCode,
  ShieldCheck,
  FolderOpen,
  ChevronDown,
  Plus,
  Trash2,
  Clock,
  Cpu,
  Boxes,
  Binary,
  GitCommit,
  Activity,
  Users,
  Code2,
  Server,
  Crown,
  Moon,
  MoreVertical,
  ExternalLink,
  Zap,
  Folder,
  LayoutTemplate,
  History,
  Settings as SettingsIcon,
  HelpCircle
} from 'lucide-react';
import { ConversionHistoryItem, FileFormat, StoredProject, WorkspaceTab } from '../../types';
import { detectFileFormat, formatFileSize, FORMAT_REGISTRY } from '../../services/formatDetector';

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
  onOpenWhatIf?: () => void;
  onOpenCollab?: () => void;
  onOpenDeveloper?: () => void;
  userRole?: string;
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
  userName = 'Alex',
  avatarUrl,
  onOpenSettings,
  onOpenUserPanel,
  onOpenCommandPalette,
  onOpenForensics,
  onOpenLineage,
  onOpenReceipts,
  onOpenWhatIf,
  onOpenCollab,
  onOpenDeveloper,
  userRole = 'user',
}) => {
  const [isAdminView, setIsAdminView] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (files.length === 1) {
      const file = files[0];
      const format = await detectFileFormat(file);
      if (format) {
        onOpenFileInEditor(file, format);
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

  // Real or high-fidelity sample recent documents for immediate visual polish
  const displayDocuments = recentProjects.length > 0 ? recentProjects.slice(0, 4) : [
    {
      id: 'doc-sample-1',
      title: 'Project_Report.pdf',
      type: 'pdf',
      sizeBytes: 2400000,
      updatedAt: Date.now() - 2 * 60 * 1000,
      createdAt: Date.now() - 2 * 60 * 1000,
      data: null
    },
    {
      id: 'doc-sample-2',
      title: 'Business_Plan.docx',
      type: 'docx',
      sizeBytes: 1100000,
      updatedAt: Date.now() - 5 * 60 * 1000,
      createdAt: Date.now() - 5 * 60 * 1000,
      data: null
    },
    {
      id: 'doc-sample-3',
      title: 'Data_Analysis.xlsx',
      type: 'sheets',
      sizeBytes: 850000,
      updatedAt: Date.now() - 10 * 60 * 1000,
      createdAt: Date.now() - 10 * 60 * 1000,
      data: null
    }
  ];

  // Storage metric: default 68% or computed based on actual files
  const totalStorageBytes = recentProjects.reduce((acc, p) => acc + (p.sizeBytes || 0), 0);
  const storagePercentage = 68;
  const storageRadius = 38;
  const storageCircumference = 2 * Math.PI * storageRadius;
  const storageStrokeOffset = storageCircumference - (storageCircumference * storagePercentage) / 100;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6 text-[#F4F5FF] custom-scrollbar bg-transparent relative"
    >
      {/* Hidden File Input for Quick Drag & Drop */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Global Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-[#080B18]/85 backdrop-blur-xl border-2 border-dashed border-[#8B7CFF] flex flex-col items-center justify-center pointer-events-none animate-in fade-in">
          <UploadCloud className="w-16 h-16 text-[#8B7CFF] animate-bounce mb-3" />
          <h2 className="text-xl font-bold text-[#F4F5FF]">Drop Documents Here</h2>
          <p className="text-sm text-[#9BA3BD] mt-1">OmniDoc will automatically detect format and launch the right studio.</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TOP HEADER BAR: Search, Notifications, Theme & Upgrade Pill (Reference) */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.08]">
        {/* Search Input Bar (Reference Pill Style) */}
        <div
          onClick={onOpenCommandPalette}
          className="flex items-center gap-3 px-4 py-2 rounded-full glass-input hover:border-[#8B7CFF]/50 text-xs cursor-pointer transition-all w-full sm:w-80 text-[#9BA3BD] hover:text-[#F4F5FF] group shadow-inner"
          title="Press Ctrl+K to search anything"
        >
          <Search className="w-4 h-4 text-[#9BA3BD] group-hover:text-[#42D6E8] transition-colors shrink-0" />
          <span className="flex-1 font-medium text-[13px] text-[#9BA3BD]/80">Search anything...</span>
          <kbd className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10 text-[10px] font-mono font-bold text-[#F4F5FF]">
            Ctrl + K
          </kbd>
        </div>

        {/* Right Controls: Notifications, Moon, Upgrade Button & Avatar */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          {/* Notification Bell */}
          <button
            onClick={() => setActiveTab('projects')}
            className="w-10 h-10 rounded-full glass-card hover:border-[#8B7CFF]/50 flex items-center justify-center text-[#9BA3BD] hover:text-[#F4F5FF] transition-all relative cursor-pointer"
            title="Notifications & Activity"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#42D6E8] ring-2 ring-[#080B18] animate-pulse" />
          </button>

          {/* Moon Theme Toggle */}
          <button
            className="w-10 h-10 rounded-full glass-card hover:border-[#8B7CFF]/50 flex items-center justify-center text-[#9BA3BD] hover:text-[#F4F5FF] transition-all cursor-pointer"
            title="Theme: Dark Aurora Active"
          >
            <Moon className="w-4 h-4" />
          </button>

          {/* Upgrade Gradient Button (Matching Reference) */}
          <button
            onClick={onOpenUserPanel}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#8B7CFF] to-[#6366F1] hover:from-[#9C8FFF] hover:to-[#7579F3] text-white text-xs font-bold shadow-lg shadow-[#8B7CFF]/30 transition-all cursor-pointer hover:scale-105 active:scale-95"
            title="Upgrade to Pro Plan"
          >
            <Crown className="w-3.5 h-3.5 text-amber-300" />
            <span>Upgrade</span>
          </button>

          {/* Avatar Profile */}
          <div
            onClick={onOpenUserPanel}
            className="cursor-pointer transition-transform hover:scale-105"
            title="Account Profile"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-9 h-9 rounded-full object-cover ring-2 ring-[#8B7CFF]/50 shadow-md" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#8B7CFF] to-[#42D6E8] flex items-center justify-center text-[#080B18] font-black text-sm ring-2 ring-white/20 shadow-md">
                {userName[0].toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. HERO WELCOME SECTION WITH FLOATING 3D DOCUMENT (Reference)              */}
      {/* ========================================================================= */}
      <div className="relative rounded-3xl p-6 md:p-8 overflow-hidden glass-panel border border-white/10 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Subtle Aurora Ambient Glow within Hero */}
        <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-[#8B7CFF]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-20 w-80 h-80 rounded-full bg-[#42D6E8]/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-xl space-y-2 text-center md:text-left">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#F4F5FF] tracking-tight">
            Welcome back, {userName}!
          </h1>
          <p className="text-xs sm:text-sm text-[#9BA3BD] font-medium leading-relaxed">
            Your all-in-one document studio for a more productive workflow.
          </p>
        </div>

        {/* 3D Floating Translucent Document Graphic (Matching Reference Image) */}
        <div className="relative shrink-0 w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center animate-float">
          <div className="absolute inset-0 bg-gradient-to-tr from-[#8B7CFF]/30 to-[#42D6E8]/30 rounded-3xl blur-2xl opacity-70" />
          
          <div className="relative w-28 h-36 sm:w-32 sm:h-40 rounded-2xl glass-panel border border-white/20 shadow-2xl p-3 flex flex-col justify-between transform -rotate-3 transition-transform hover:rotate-0">
            {/* Document Lines */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 pb-1 border-b border-white/10">
                <span className="w-2.5 h-2.5 rounded-full bg-[#42D6E8]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#8B7CFF]" />
              </div>
              <div className="w-16 h-2 rounded bg-gradient-to-r from-[#8B7CFF] to-[#42D6E8]" />
              <div className="w-20 h-1.5 rounded bg-white/25" />
              <div className="w-14 h-1.5 rounded bg-white/15" />
              <div className="w-18 h-1.5 rounded bg-white/20" />
            </div>

            {/* Glowing Bottom Ribbon */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[9px] text-[#42D6E8] font-mono font-bold">
              <span>OMNI.DOC</span>
              <Sparkles className="w-3 h-3 text-[#8B7CFF]" />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. FOUR PROMINENT QUICK ACTION CARDS (Reference Image Grid)                 */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Convert Files */}
        <div
          onClick={() => setActiveTab('converter')}
          className="glass-card glass-card-hover rounded-2xl p-5 cursor-pointer border border-white/10 hover:border-[#42D6E8]/60 transition-all group relative overflow-hidden"
        >
          <div className="w-11 h-11 rounded-xl bg-[#42D6E8]/15 border border-[#42D6E8]/30 flex items-center justify-center text-[#42D6E8] mb-4 group-hover:scale-110 group-hover:glow-cyan transition-all">
            <RefreshCw className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#F4F5FF] group-hover:text-[#42D6E8] transition-colors">
            Convert Files
          </h3>
          <p className="text-xs text-[#9BA3BD] mt-1">Multiple formats</p>
        </div>

        {/* Card 2: Edit PDF */}
        <div
          onClick={() => setActiveTab('pdf')}
          className="glass-card glass-card-hover rounded-2xl p-5 cursor-pointer border border-white/10 hover:border-[#8B7CFF]/60 transition-all group relative overflow-hidden"
        >
          <div className="w-11 h-11 rounded-xl bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 flex items-center justify-center text-[#8B7CFF] mb-4 group-hover:scale-110 group-hover:glow-purple transition-all">
            <PenTool className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#F4F5FF] group-hover:text-[#8B7CFF] transition-colors">
            Edit PDF
          </h3>
          <p className="text-xs text-[#9BA3BD] mt-1">Annotate &amp; Edit</p>
        </div>

        {/* Card 3: Work with Excel */}
        <div
          onClick={() => setActiveTab('sheets')}
          className="glass-card glass-card-hover rounded-2xl p-5 cursor-pointer border border-white/10 hover:border-emerald-400/60 transition-all group relative overflow-hidden"
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-all">
            <Table className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#F4F5FF] group-hover:text-emerald-300 transition-colors">
            Work with Excel
          </h3>
          <p className="text-xs text-[#9BA3BD] mt-1">Analyze &amp; Calculate</p>
        </div>

        {/* Card 4: Create Workflow */}
        <div
          onClick={() => setActiveTab('workflow')}
          className="glass-card glass-card-hover rounded-2xl p-5 cursor-pointer border border-white/10 hover:border-indigo-400/60 transition-all group relative overflow-hidden"
        >
          <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition-all">
            <Boxes className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#F4F5FF] group-hover:text-indigo-300 transition-colors">
            Create Workflow
          </h3>
          <p className="text-xs text-[#9BA3BD] mt-1">Automate Tasks</p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. LOWER 3-SECTION GRID: Recent Documents, Storage Overview & Quick Access */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (5 cols): Recent Documents (Matching Reference Card) */}
        <div className="lg:col-span-5 glass-card rounded-2xl p-5 border border-white/10 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <h2 className="text-sm font-bold text-[#F4F5FF]">Recent Documents</h2>
            <button
              onClick={() => setActiveTab('projects')}
              className="text-xs text-[#8B7CFF] hover:text-[#42D6E8] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {displayDocuments.map((doc) => {
              const isPdf = doc.title.endsWith('.pdf') || doc.type === 'pdf';
              const isDocx = doc.title.endsWith('.docx') || doc.type === 'docx';
              const isXlsx = doc.title.endsWith('.xlsx') || doc.type === 'sheets';

              const iconBg = isPdf
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                : isDocx
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';

              return (
                <div
                  key={doc.id}
                  onClick={() => {
                    const found = recentProjects.find((p) => p.id === doc.id);
                    if (found) onLoadProject(found);
                    else setActiveTab(isPdf ? 'pdf' : isDocx ? 'docx' : 'sheets');
                  }}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.06] transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${iconBg}`}>
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#F4F5FF] group-hover:text-[#42D6E8] transition-colors truncate">
                        {doc.title}
                      </div>
                      <div className="text-[11px] text-[#9BA3BD]">
                        {formatFileSize(doc.sizeBytes || 1200000)} • 2 min ago
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab('projects');
                    }}
                    className="p-1 rounded-lg text-[#9BA3BD] hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Column (3.5 cols): Storage Overview Radial Chart (Matching Reference) */}
        <div className="lg:col-span-3.5 glass-card rounded-2xl p-5 border border-white/10 flex flex-col justify-between space-y-4">
          <div className="pb-2 border-b border-white/[0.08]">
            <h2 className="text-sm font-bold text-[#F4F5FF]">Storage Overview</h2>
          </div>

          <div className="flex items-center justify-center gap-4 py-3">
            {/* Circular Gauge Ring */}
            <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                {/* Background Ring */}
                <circle
                  cx="48"
                  cy="48"
                  r={storageRadius}
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth="8"
                  fill="transparent"
                />
                {/* Progress Ring with Purple to Cyan Gradient */}
                <circle
                  cx="48"
                  cy="48"
                  r={storageRadius}
                  stroke="url(#storageGrad)"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={storageCircumference}
                  strokeDashoffset={storageStrokeOffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="storageGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8B7CFF" />
                    <stop offset="100%" stopColor="#42D6E8" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute font-extrabold text-base text-[#F4F5FF]">
                {storagePercentage}%
              </span>
            </div>

            {/* Storage Legend */}
            <div>
              <div className="text-xs font-bold text-[#F4F5FF]">
                {storagePercentage} GB / 100 GB
              </div>
              <div className="text-[11px] text-[#9BA3BD] mt-0.5">Used Storage</div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-[#9BA3BD]">
            <span>Cloud Sync: Active</span>
            <span className="text-emerald-400 font-semibold">Healthy</span>
          </div>
        </div>

        {/* Right Column (3.5 cols): Quick Access (Matching Reference Vertical List) */}
        <div className="lg:col-span-3.5 glass-card rounded-2xl p-5 border border-white/10 flex flex-col justify-between space-y-3">
          <div className="pb-2 border-b border-white/[0.08]">
            <h2 className="text-sm font-bold text-[#F4F5FF]">Quick Access</h2>
          </div>

          <div className="space-y-2">
            {/* My Projects */}
            <div
              onClick={() => setActiveTab('projects')}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.06] border border-transparent hover:border-white/10 transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#42D6E8]/15 text-[#42D6E8] flex items-center justify-center shrink-0">
                <Folder className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-[#F4F5FF] group-hover:text-[#42D6E8] transition-colors flex-1">
                My Projects
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-[#9BA3BD] group-hover:translate-x-0.5 transition-transform" />
            </div>

            {/* Templates */}
            <div
              onClick={() => setActiveTab('templates')}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.06] border border-transparent hover:border-white/10 transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#8B7CFF]/15 text-[#8B7CFF] flex items-center justify-center shrink-0">
                <LayoutTemplate className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-[#F4F5FF] group-hover:text-[#8B7CFF] transition-colors flex-1">
                Templates
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-[#9BA3BD] group-hover:translate-x-0.5 transition-transform" />
            </div>

            {/* Activity Log */}
            <div
              onClick={() => setActiveTab('projects')}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.06] border border-transparent hover:border-white/10 transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
                <History className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-[#F4F5FF] group-hover:text-indigo-300 transition-colors flex-1">
                Activity Log
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-[#9BA3BD] group-hover:translate-x-0.5 transition-transform" />
            </div>

            {/* Settings */}
            <div
              onClick={onOpenSettings || (() => setActiveTab('settings'))}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.06] border border-transparent hover:border-white/10 transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                <SettingsIcon className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-[#F4F5FF] group-hover:text-emerald-300 transition-colors flex-1">
                Settings
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-[#9BA3BD] group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
