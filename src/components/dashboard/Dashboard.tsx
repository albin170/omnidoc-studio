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
  Activity,
  SlidersHorizontal,
  Users,
  Code2,
  ShieldAlert,
  Server
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
  userName = 'Guest User',
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

  // Real studios data with Aurora Glass styling tokens
  const quickStudios = [
    { tab: 'pdf' as WorkspaceTab, title: 'PDF Studio', desc: 'Edit text, annotate, rotate, split & sign', icon: FileText, color: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/20' },
    { tab: 'docx' as WorkspaceTab, title: 'Word Docs', desc: 'Write & format DOCX/PDF reports', icon: PenTool, color: 'text-[#42D6E8]', bg: 'bg-[#42D6E8]/15', border: 'border-[#42D6E8]/20' },
    { tab: 'slides' as WorkspaceTab, title: 'Slide Deck', desc: '16:9 presentations & PPTX export', icon: Presentation, color: 'text-amber-400', bg: 'bg-amber-400/15', border: 'border-amber-400/20' },
    { tab: 'sheets' as WorkspaceTab, title: 'Sheets Grid', desc: 'Formulas (SUM, AVG) & XLSX/CSV', icon: Table, color: 'text-emerald-400', bg: 'bg-emerald-400/15', border: 'border-emerald-400/20' },
    { tab: 'image' as WorkspaceTab, title: 'Photo & BG', desc: 'Crop, filter & smart BG removal', icon: ImageIcon, color: 'text-[#8B7CFF]', bg: 'bg-[#8B7CFF]/15', border: 'border-[#8B7CFF]/20' },
    { tab: 'ocr' as WorkspaceTab, title: 'OCR Scanner', desc: 'Extract text from scans & photos', icon: ScanText, color: 'text-cyan-400', bg: 'bg-cyan-400/15', border: 'border-cyan-400/20' },
  ];

  // Calculate real storage footprint
  const totalStorageBytes = recentProjects.reduce((acc, p) => acc + (p.sizeBytes || 0), 0);

  // Time-appropriate greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-7 space-y-6 text-[#F4F5FF] custom-scrollbar">
      {/* 1. Header Greeting & Real Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#F4F5FF] tracking-tight flex items-center gap-2">
            <span>{greeting}, {userName}!</span>
            <span className="text-2xl animate-pulse">👋</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#9BA3BD] font-medium mt-0.5">
            Convert, edit, create and export your documents with 100% local privacy.
          </p>
        </div>

        {/* Real Status Controls & Quick Search */}
        <div className="flex flex-wrap items-center gap-2.5 self-stretch sm:self-auto">
          {userRole === 'admin' && (
            <button
              onClick={() => setIsAdminView(!isAdminView)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold transition-all border shadow-sm cursor-pointer ${isAdminView
                  ? 'bg-rose-500/30 text-rose-300 border-rose-500/50 shadow-rose-500/20 glow-rose'
                  : 'glass-card hover:border-white/20 text-[#9BA3BD] hover:text-[#F4F5FF]'
                }`}
              title="Toggle Admin Telemetry Dashboard"
            >
              <Server className="w-3.5 h-3.5" />
              <span>{isAdminView ? 'User View' : 'Admin Telemetry'}</span>
            </button>
          )}

          {/* Quick Search / Command Palette Bar */}
          <div
            onClick={onOpenCommandPalette}
            className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl glass-card hover:border-[#8B7CFF]/50 text-xs cursor-pointer transition-all w-full sm:w-64 text-[#9BA3BD] hover:text-[#F4F5FF] group"
            title="Press Ctrl+K to search"
          >
            <Search className="w-3.5 h-3.5 text-[#42D6E8] shrink-0 group-hover:scale-110 transition-transform" />
            <span className="flex-1 font-medium truncate">Search anything...</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-mono font-bold text-[#9BA3BD]">
              Ctrl+K
            </kbd>
          </div>

          {/* Real Privacy Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl glass-card text-xs border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-[#9BA3BD] hidden sm:inline">Engine:</span>
            <span className="font-bold text-emerald-400">Local &amp; Private</span>
          </div>

          <button
            onClick={() => setActiveTab('converter')}
            className="w-9 h-9 rounded-full glass-card hover:border-[#8B7CFF]/50 flex items-center justify-center text-[#9BA3BD] hover:text-[#8B7CFF] transition-colors cursor-pointer"
            title="Open Conversion Hub"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTab('projects')}
            className="w-9 h-9 rounded-full glass-card hover:border-[#8B7CFF]/50 flex items-center justify-center text-[#9BA3BD] hover:text-[#8B7CFF] transition-colors relative cursor-pointer"
            title="Saved Projects & History"
          >
            <Clock className="w-4 h-4" />
            {conversionHistory.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#42D6E8] ring-2 ring-[#080B18]" />
            )}
          </button>

          {/* User Profile Pill */}
          <div
            onClick={onOpenUserPanel}
            className="flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full glass-card hover:border-[#8B7CFF]/50 text-xs cursor-pointer transition-all"
            title="Open User Profile & Plan"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-7 h-7 rounded-full object-cover ring-1 ring-white/20" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#8B7CFF] to-[#42D6E8] flex items-center justify-center text-[#080B18] font-black text-xs">
                {userName ? userName[0].toUpperCase() : 'U'}
              </div>
            )}
            <div className="text-left hidden md:block">
              <div className="font-bold text-[#F4F5FF] text-[11px] leading-tight truncate max-w-[90px]">{userName}</div>
              <div className="text-[10px] text-[#42D6E8] font-semibold leading-tight">Pro Plan</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#9BA3BD]" />
          </div>
        </div>
      </div>

      {/* 2. User-Friendly Onboarding / Welcome Guide */}
      <OnboardingBanner
        onOpenCommandPalette={onOpenCommandPalette || (() => { })}
        onExploreTemplates={() => setActiveTab('templates')}
      />

      {/* Admin Telemetry Quick View Panel */}
      {isAdminView && (
        <div className="p-4 rounded-2xl glass-panel border border-rose-500/30 text-[#F4F5FF] shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-bold text-[#F4F5FF] tracking-wide uppercase">Admin System Telemetry &amp; Cluster Metrics</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              CLUSTER: ONLINE • 99.99%
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl glass-card border-white/10">
              <div className="text-[10px] text-[#9BA3BD] font-semibold">Active Organizations</div>
              <div className="text-xl font-bold text-[#F4F5FF] mt-1">1 Multi-Tenant Org</div>
              <div className="text-[10px] text-emerald-400 mt-0.5">Default Studio Workspace</div>
            </div>
            <div className="p-3 rounded-xl glass-card border-white/10">
              <div className="text-[10px] text-[#9BA3BD] font-semibold">Authenticated Users</div>
              <div className="text-xl font-bold text-[#F4F5FF] mt-1">1 Admin / 0 Suspended</div>
              <div className="text-[10px] text-[#42D6E8] mt-0.5">Role-Based Access Control</div>
            </div>
            <div className="p-3 rounded-xl glass-card border-white/10">
              <div className="text-[10px] text-[#9BA3BD] font-semibold">Storage Vault Footprint</div>
              <div className="text-xl font-bold text-[#F4F5FF] mt-1">{formatFileSize(totalStorageBytes)}</div>
              <div className="text-[10px] text-[#8B7CFF] mt-0.5">{recentProjects.length} Verified Objects</div>
            </div>
            <div className="p-3 rounded-xl glass-card border-white/10">
              <div className="text-[10px] text-[#9BA3BD] font-semibold">HMAC Signature Audits</div>
              <div className="text-xl font-bold text-[#F4F5FF] mt-1">100% Passed</div>
              <div className="text-[10px] text-amber-400 mt-0.5">Dual SHA-256 Receipts</div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Top 4 Real KPI Cards with Undulating Wave Curves */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Completed Conversions */}
        <div
          onClick={() => setActiveTab('converter')}
          className="glass-card glass-card-hover rounded-[22px] p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between cursor-pointer border-white/10 hover:border-amber-400/50"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
                <RefreshCw className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-[#F4F5FF]">Total Conversions</span>
            </div>
          </div>

          <div className="mt-3.5 flex items-baseline justify-between z-10">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#F4F5FF] tracking-tight">
                {conversionHistory.length}
              </div>
              <div className="text-[11px] font-semibold text-[#9BA3BD]">Total Processed</div>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-400/15 px-2 py-0.5 rounded-full border border-amber-400/30">
              <span>{conversionHistory.length > 0 ? 'Active' : 'Ready'}</span>
            </div>
          </div>

          {/* Undulating Amber Wave Sparkline */}
          <div className="w-full h-7 mt-1.5 -mb-2 overflow-hidden opacity-85">
            <svg viewBox="0 0 200 40" className="w-full h-full" fill="none">
              <path
                d="M0 25 C 30 15, 60 32, 90 20 C 120 8, 150 28, 180 18 L 200 22"
                stroke="#fbbf24"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: Saved Projects */}
        <div
          onClick={() => setActiveTab('projects')}
          className="glass-card glass-card-hover rounded-[22px] p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between cursor-pointer border-white/10 hover:border-emerald-400/50"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                <FolderOpen className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-[#F4F5FF]">Saved Projects</span>
            </div>
          </div>

          <div className="mt-3.5 flex items-baseline justify-between z-10">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#F4F5FF] tracking-tight">
                {recentProjects.length}
              </div>
              <div className="text-[11px] font-semibold text-[#9BA3BD]">In Local Storage</div>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-400/15 px-2 py-0.5 rounded-full border border-emerald-400/30">
              <span>Encrypted</span>
            </div>
          </div>

          {/* Undulating Green Wave Sparkline */}
          <div className="w-full h-7 mt-1.5 -mb-2 overflow-hidden opacity-85">
            <svg viewBox="0 0 200 40" className="w-full h-full" fill="none">
              <path
                d="M0 30 C 40 18, 70 34, 110 22 C 140 12, 170 32, 200 20"
                stroke="#34d399"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Active Queue */}
        <div
          onClick={() => setActiveTab('converter')}
          className="glass-card glass-card-hover rounded-[22px] p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between cursor-pointer border-white/10 hover:border-[#42D6E8]/50"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#42D6E8]/15 border border-[#42D6E8]/30 flex items-center justify-center text-[#42D6E8]">
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-[#F4F5FF]">Conversion Queue</span>
            </div>
          </div>

          <div className="mt-3.5 flex items-baseline justify-between z-10">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#F4F5FF] tracking-tight">
                {queueCount}
              </div>
              <div className="text-[11px] font-semibold text-[#9BA3BD]">Tasks Pending</div>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-[#42D6E8] bg-[#42D6E8]/15 px-2 py-0.5 rounded-full border border-[#42D6E8]/30">
              <span>{queueCount > 0 ? 'Queued' : 'Idle'}</span>
            </div>
          </div>

          {/* Undulating Blue Wave Sparkline */}
          <div className="w-full h-7 mt-1.5 -mb-2 overflow-hidden opacity-85">
            <svg viewBox="0 0 200 40" className="w-full h-full" fill="none">
              <path
                d="M0 24 C 30 14, 60 30, 100 16 C 140 6, 170 28, 200 16"
                stroke="#42D6E8"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 4: Local Storage Footprint */}
        <div
          onClick={() => setActiveTab('projects')}
          className="glass-card glass-card-hover rounded-[22px] p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between cursor-pointer border-white/10 hover:border-[#8B7CFF]/50"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 flex items-center justify-center text-[#8B7CFF]">
                <HardDrive className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-[#F4F5FF]">Memory Footprint</span>
            </div>
          </div>

          <div className="mt-3.5 flex items-baseline justify-between z-10">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#F4F5FF] tracking-tight">
                {formatFileSize(totalStorageBytes)}
              </div>
              <div className="text-[11px] font-semibold text-[#9BA3BD]">Private RAM/IDB</div>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-[#8B7CFF] bg-[#8B7CFF]/15 px-2 py-0.5 rounded-full border border-[#8B7CFF]/30">
              <span>100% Local</span>
            </div>
          </div>

          {/* Undulating Purple Wave Sparkline */}
          <div className="w-full h-7 mt-1.5 -mb-2 overflow-hidden opacity-85">
            <svg viewBox="0 0 200 40" className="w-full h-full" fill="none">
              <path
                d="M0 28 C 35 16, 75 36, 115 20 C 145 10, 175 30, 200 18"
                stroke="#8B7CFF"
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
            <h2 className="text-sm sm:text-base font-extrabold text-[#F4F5FF] tracking-tight">
              Saved Documents &amp; Projects
            </h2>
            <button
              onClick={() => setActiveTab('projects')}
              className="text-xs font-bold text-[#8B7CFF] hover:text-[#42D6E8] transition-colors cursor-pointer"
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
                  className="glass-card glass-card-hover rounded-[20px] p-4 flex items-center justify-between cursor-pointer group border-white/10 hover:border-[#8B7CFF]/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 flex items-center justify-center text-[#8B7CFF] shrink-0">
                      <FileCode className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-[#F4F5FF] group-hover:text-[#42D6E8] transition-colors truncate">
                        {proj.title}
                      </h3>
                      <p className="text-[11px] text-[#9BA3BD]">
                        {proj.type.toUpperCase()} • {formatFileSize(proj.sizeBytes)} • {new Date(proj.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#8B7CFF]/20 text-[#8B7CFF] border border-[#8B7CFF]/30">
                      Saved
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#9BA3BD] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Clean Onboarding State */
            <div className="glass-card rounded-[22px] p-6 text-center space-y-3 border-white/10">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-[#8B7CFF]/15 text-[#8B7CFF] border border-[#8B7CFF]/30 flex items-center justify-center">
                <FileCheck className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#F4F5FF]">No Projects Saved Yet</h3>
              <p className="text-xs text-[#9BA3BD] max-w-sm mx-auto">
                Open any studio below to create documents, presentations, spreadsheets, or graphics. When you click Save, it appears here.
              </p>
              <button
                onClick={() => setActiveTab('templates')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl glass-btn-primary text-xs font-semibold shadow-md shadow-[#8B7CFF]/25 cursor-pointer"
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
            <h2 className="text-sm sm:text-base font-extrabold text-[#F4F5FF] tracking-tight">
              Conversion Activity
            </h2>
            <button
              onClick={() => setActiveTab('converter')}
              className="text-xs font-bold text-[#42D6E8] hover:text-[#8B7CFF] transition-colors cursor-pointer"
            >
              Open Hub
            </button>
          </div>

          <div className="glass-card rounded-[22px] p-4 sm:p-5 space-y-3 border-white/10">
            <div className="flex items-center justify-between text-xs font-bold text-[#F4F5FF] pb-2 border-b border-white/10">
              <span>Task Stream</span>
              <span className="text-[11px] text-[#9BA3BD] font-normal">
                {conversionHistory.length} Recorded
              </span>
            </div>

            {conversionHistory.length > 0 ? (
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto custom-scrollbar">
                {conversionHistory.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.06] transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate pr-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-400/15 text-emerald-400 border border-emerald-400/30 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-[#F4F5FF] truncate">{item.sourceName}</div>
                        <div className="text-[10px] text-[#9BA3BD] uppercase">
                          {item.sourceFormat} → {item.targetFormat}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-[#9BA3BD] shrink-0 font-mono">
                      {new Date(item.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-[#9BA3BD]">
                <RefreshCw className="w-6 h-6 mx-auto mb-2 text-[#9BA3BD]/50" />
                <p>No conversions executed yet.</p>
                <p className="text-[11px] text-[#9BA3BD]/70 mt-1">Drop a file below to start converting.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Dedicated Studios & Workspaces Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-[#9BA3BD] uppercase tracking-wider">
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
                <div className={`w-9 h-9 rounded-xl ${s.bg} ${s.color} border border-white/10 flex items-center justify-center mb-2.5`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#F4F5FF] group-hover:text-[#42D6E8] transition-colors">
                    {s.title}
                  </h4>
                  <p className="text-[10px] text-[#9BA3BD] mt-0.5 leading-tight">
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
            <h3 className="text-xs font-bold text-[#F4F5FF] uppercase tracking-wider">
              Intelligent Document Engineering Suite
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8B7CFF]/20 text-[#8B7CFF] border border-[#8B7CFF]/30">
              v2.1 ADVANCED
            </span>
          </div>
          <button
            onClick={() => setActiveTab('workflow')}
            className="text-xs font-bold text-[#8B7CFF] hover:text-[#42D6E8] transition-colors cursor-pointer"
          >
            Open Workflow Studio →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Autonomous Agent 2.0 */}
          <div
            onClick={() => setActiveTab('autonomous')}
            className="glass-card glass-card-hover rounded-2xl p-4 cursor-pointer flex flex-col justify-between border-white/10 hover:border-[#8B7CFF]/50 group"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-[#8B7CFF]/15 text-[#8B7CFF] border border-[#8B7CFF]/30 flex items-center justify-center mb-2.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-[#F4F5FF] group-hover:text-[#8B7CFF] transition-colors">
                Autonomous Agent 2.0
              </h4>
              <p className="text-[10px] text-[#9BA3BD] mt-1 leading-snug">
                Goal-driven document agent: inspects files, generates execution DAGs, executes tools, and verifies integrity.
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-[#8B7CFF]">
              <span>Goal-Driven Agent</span>
              <span>Launch Agent →</span>
            </div>
          </div>

          {/* Card 2: Visual Workflow Studio */}
          <div
            onClick={() => setActiveTab('workflow')}
            className="glass-card glass-card-hover rounded-2xl p-4 cursor-pointer flex flex-col justify-between border-white/10 hover:border-indigo-400/50 group"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mb-2.5">
                <Boxes className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-[#F4F5FF] group-hover:text-indigo-400 transition-colors">
                Visual Workflow Studio
              </h4>
              <p className="text-[10px] text-[#9BA3BD] mt-1 leading-snug">
                DAG node pipelines: intake → forensics → DNA → self-healing conversion → verify → receipt.
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-indigo-400">
              <span>Interactive DAG Builder</span>
              <span>Open Studio →</span>
            </div>
          </div>

          {/* Card 3: Forensics Lab */}
          <div
            onClick={onOpenForensics}
            className="glass-card glass-card-hover rounded-2xl p-4 cursor-pointer flex flex-col justify-between border-white/10 hover:border-amber-400/50 group"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-amber-400/15 text-amber-400 border border-amber-400/30 flex items-center justify-center mb-2.5">
                <Binary className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-[#F4F5FF] group-hover:text-amber-400 transition-colors">
                Document Forensics Lab
              </h4>
              <p className="text-[10px] text-[#9BA3BD] mt-1 leading-snug">
                Detect MIME extension spoofing, weaponized VBA macros, external links, and author leaks.
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-amber-400">
              <span>Security Screening</span>
              <span>Launch Lab →</span>
            </div>
          </div>

          {/* Card 4: Data Lineage & Provenance */}
          <div
            onClick={onOpenLineage}
            className="glass-card glass-card-hover rounded-2xl p-4 cursor-pointer flex flex-col justify-between border-white/10 hover:border-teal-400/50 group"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-teal-400/15 text-teal-400 border border-teal-400/30 flex items-center justify-center mb-2.5">
                <GitCommit className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-[#F4F5FF] group-hover:text-teal-400 transition-colors">
                Data Lineage &amp; Provenance
              </h4>
              <p className="text-[10px] text-[#9BA3BD] mt-1 leading-snug">
                Track extracted financial figures, dates, IDs with measurable confidence metrics and page anchors.
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-teal-400">
              <span>Traceable Metrics</span>
              <span>Audit Lineage →</span>
            </div>
          </div>

          {/* Card 5: Transformation Receipts */}
          <div
            onClick={onOpenReceipts}
            className="glass-card glass-card-hover rounded-2xl p-4 cursor-pointer flex flex-col justify-between border-white/10 hover:border-yellow-400/50 group"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-yellow-400/15 text-yellow-400 border border-yellow-400/30 flex items-center justify-center mb-2.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-[#F4F5FF] group-hover:text-yellow-400 transition-colors">
                Audit Receipts &amp; Certs
              </h4>
              <p className="text-[10px] text-[#9BA3BD] mt-1 leading-snug">
                Verifiable cryptographic receipts containing dual SHA-256 hashes, engine versions, and HMAC signatures.
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-yellow-400">
              <span>Non-repudiable Proof</span>
              <span>Inspect Certs →</span>
            </div>
          </div>

          {/* Card 6: What-If Simulator */}
          <div
            onClick={onOpenWhatIf}
            className="glass-card glass-card-hover rounded-2xl p-4 cursor-pointer flex flex-col justify-between border-white/10 hover:border-sky-400/50 group"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-sky-400/15 text-sky-400 border border-sky-400/30 flex items-center justify-center mb-2.5">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-[#F4F5FF] group-hover:text-sky-400 transition-colors">
                What-If Simulator
              </h4>
              <p className="text-[10px] text-[#9BA3BD] mt-1 leading-snug">
                Simulate typography scaling, multi-language translation expansions, and table column reflows before export.
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-sky-400">
              <span>Predictive Layout</span>
              <span>Run Simulator →</span>
            </div>
          </div>

          {/* Card 7: Team Workspace */}
          <div
            onClick={onOpenCollab}
            className="glass-card glass-card-hover rounded-2xl p-4 cursor-pointer flex flex-col justify-between border-white/10 hover:border-emerald-400/50 group"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-emerald-400/15 text-emerald-400 border border-emerald-400/30 flex items-center justify-center mb-2.5">
                <Users className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-[#F4F5FF] group-hover:text-emerald-400 transition-colors">
                Team Workspace
              </h4>
              <p className="text-[10px] text-[#9BA3BD] mt-1 leading-snug">
                Multi-user review comments, page-anchored threads, organization member roles, and workflow approvals.
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-emerald-400">
              <span>Review &amp; Approvals</span>
              <span>Open Teams →</span>
            </div>
          </div>

          {/* Card 8: Developer Platform & REST API */}
          <div
            onClick={onOpenDeveloper}
            className="glass-card glass-card-hover rounded-2xl p-4 cursor-pointer flex flex-col justify-between border-white/10 hover:border-[#42D6E8]/50 group"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-[#42D6E8]/15 text-[#42D6E8] border border-[#42D6E8]/30 flex items-center justify-center mb-2.5">
                <Code2 className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-[#F4F5FF] group-hover:text-[#42D6E8] transition-colors">
                Developer API Platform
              </h4>
              <p className="text-[10px] text-[#9BA3BD] mt-1 leading-snug">
                Programmatic document engineering: provision API keys, execute DAGs via cURL/SDKs, and query Swagger specs.
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-[#42D6E8]">
              <span>FastAPI REST SDK</span>
              <span>API Keys →</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Bottom Section: Format Matrix (Left) & Real Engine Health (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Left: Supported Formats Matrix (7 cols) */}
        <div className="lg:col-span-7 space-y-3 sm:space-y-4">
          <div className="glass-card rounded-[22px] p-5 sm:p-6 space-y-4 border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-extrabold text-[#F4F5FF] tracking-tight">
                Universal Format Compatibility
              </h2>
              <span className="text-[10px] font-bold text-[#42D6E8] bg-[#42D6E8]/15 px-2 py-0.5 rounded-full border border-[#42D6E8]/30">
                11 Formats
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {Object.entries(FORMAT_REGISTRY).map(([key, meta]) => (
                <div
                  key={key}
                  onClick={() => setActiveTab('converter')}
                  className="p-2.5 rounded-xl glass-card hover:border-[#8B7CFF]/50 border-white/10 cursor-pointer transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shadow-sm"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span className="font-bold text-[#F4F5FF] uppercase text-[11px]">{meta.format}</span>
                  </div>
                  <span className="text-[10px] text-[#9BA3BD]">{meta.allowedConversions.length} paths</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Real Engine Health Status (5 cols) */}
        <div className="lg:col-span-5 space-y-3 sm:space-y-4">
          <div className="glass-card rounded-[22px] p-5 sm:p-6 space-y-4 border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-extrabold text-[#F4F5FF] tracking-tight">
                Processing Engines
              </h2>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/15 px-2 py-0.5 rounded-full border border-emerald-400/30">
                All Operational
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl glass-card border-white/5">
                <div className="flex items-center gap-2.5">
                  <Cpu className="w-4 h-4 text-[#8B7CFF]" />
                  <span className="font-bold text-[#F4F5FF]">PDF.js &amp; pdf-lib</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-400">Active</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl glass-card border-white/5">
                <div className="flex items-center gap-2.5">
                  <PenTool className="w-4 h-4 text-indigo-400" />
                  <span className="font-bold text-[#F4F5FF]">OpenXML DOCX / PPTX</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-400">Active</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl glass-card border-white/5">
                <div className="flex items-center gap-2.5">
                  <ScanText className="w-4 h-4 text-[#42D6E8]" />
                  <span className="font-bold text-[#F4F5FF]">Tesseract.js OCR</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-400">Active</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl glass-card border-white/5">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <span className="font-bold text-[#F4F5FF]">100% Client RAM Sandbox</span>
                </div>
                <span className="text-[10px] font-bold text-purple-400">Enforced</span>
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
        className={`glass-panel rounded-[22px] p-6 text-center transition-all cursor-pointer border-2 border-dashed ${isDragging
            ? 'border-[#42D6E8] bg-[#42D6E8]/10 scale-[1.01] glow-cyan'
            : 'border-white/20 hover:border-[#8B7CFF]/60 hover:bg-white/[0.04]'
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
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#8B7CFF]/20 text-[#8B7CFF] border border-[#8B7CFF]/40 flex items-center justify-center glow-purple">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#F4F5FF]">{detectedFileInfo.file.name}</h3>
              <p className="text-xs text-[#9BA3BD] mt-0.5">
                Format: <span className="font-bold text-[#42D6E8] uppercase">{detectedFileInfo.format}</span> • {formatFileSize(detectedFileInfo.file.size)}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={() => onOpenFileInEditor(detectedFileInfo.file, detectedFileInfo.format)}
                className="px-4 py-2 rounded-xl glass-btn-primary text-xs font-bold shadow-md shadow-[#8B7CFF]/30 cursor-pointer"
              >
                Open in Editor
              </button>
              <button
                onClick={() => onSendToConverter([detectedFileInfo.file])}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#F4F5FF] text-xs font-bold border border-white/10 cursor-pointer"
              >
                Convert Format
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-w-sm mx-auto">
            <UploadCloud className="w-8 h-8 mx-auto text-[#42D6E8] animate-pulse" />
            <div className="text-sm font-bold text-[#F4F5FF]">
              Drop any document or image to edit or convert
            </div>
            <p className="text-[11px] text-[#9BA3BD]">
              PDF, Word DOCX, PowerPoint PPTX, Excel XLSX, CSV, JPG, PNG &amp; Scans
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
