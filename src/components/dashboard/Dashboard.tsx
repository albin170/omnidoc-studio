import React, { useRef, useState, useEffect } from 'react';
import {
  FileText,
  PenTool,
  Table,
  RefreshCw,
  ArrowRight,
  UploadCloud,
  ChevronRight,
  Search,
  Bell,
  Sparkles,
  MoreVertical,
  Boxes,
  Crown,
  Moon,
  Folder,
  LayoutTemplate,
  History,
  Settings as SettingsIcon,
  LogOut,
  Plus,
  Database,
  CloudCheck,
  HardDrive
} from 'lucide-react';
import { ConversionHistoryItem, FileFormat, StoredProject, WorkspaceTab } from '../../types';
import { detectFileFormat, formatFileSize } from '../../services/formatDetector';

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
  onLogout?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onOpenFileInEditor,
  onSendToConverter,
  setActiveTab,
  recentProjects,
  onLoadProject,
  userName = 'Alex',
  avatarUrl,
  onOpenSettings,
  onOpenUserPanel,
  onOpenCommandPalette,
  onLogout,
}) => {
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

  // Only display real recent projects, no fake sample documents
  const displayDocuments = recentProjects.length > 0 ? recentProjects.slice(0, 4) : [];

  // Fetch actual storage usage from backend
  const [storageUsed, setStorageUsed] = useState<number | null>(null);
  const [storageTotal, setStorageTotal] = useState<number | null>(null);
  const [storageLoading, setStorageLoading] = useState<boolean>(true);
  const [storageSource, setStorageSource] = useState<'cloud' | 'local'>('local');

  useEffect(() => {
    const fetchStorage = async () => {
      try {
        const resp = await fetch('/api/v1/user/portal', { credentials: 'include' });
        if (!resp.ok) throw new Error('Portal API offline');
        const data = await resp.json();
        if (typeof data.storage_used_bytes === 'number') {
          setStorageUsed(data.storage_used_bytes);
          setStorageTotal(data.storage_quota_bytes || (100 * 1024 * 1024 * 1024));
          setStorageSource('cloud');
        }
      } catch {
        // Fallback to local storage computation
        const localBytes = recentProjects.reduce((acc, p) => acc + (p.sizeBytes || 0), 0);
        setStorageUsed(localBytes);
        setStorageTotal(50 * 1024 * 1024); // 50MB browser sandbox limit
        setStorageSource('local');
      } finally {
        setStorageLoading(false);
      }
    };
    fetchStorage();
  }, [recentProjects]);

  const usedBytes = storageUsed ?? recentProjects.reduce((acc, p) => acc + (p.sizeBytes || 0), 0);
  const quotaBytes = storageTotal ?? (50 * 1024 * 1024);
  const storagePercentage = Math.min(100, Math.round((usedBytes / Math.max(quotaBytes, 1)) * 100));
  const storageRadius = 38;
  const storageCircumference = 2 * Math.PI * storageRadius;
  const storageStrokeOffset = storageCircumference - (storageCircumference * (storagePercentage || 1)) / 100;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6 text-[#F5FAFF] custom-scrollbar bg-transparent relative select-none"
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
        <div className="fixed inset-0 z-50 bg-[#070B13]/85 backdrop-blur-xl border-2 border-dashed border-[#38BDF8] flex flex-col items-center justify-center pointer-events-none animate-fade-in">
          <UploadCloud className="w-16 h-16 text-[#38BDF8] animate-bounce mb-3" />
          <h2 className="text-xl font-bold text-[#F5FAFF] font-display">Drop Documents Here</h2>
          <p className="text-sm text-[#A7B8CA] mt-1">OmniDoc will automatically detect format and launch the right studio.</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TOP HEADER BAR: Search, Notifications, Theme & Upgrade Pill */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-[rgba(255, 255, 255,0.12)]">
        {/* Search Input Bar (Liquid Glass Pill Style) */}
        <div
          onClick={onOpenCommandPalette}
          className="flex items-center gap-3 px-4 py-2 rounded-full lg-input hover:border-[#38BDF8]/50 text-xs cursor-pointer transition-all w-full sm:w-80 text-[#A7B8CA] hover:text-[#F5FAFF] group shadow-inner"
          title="Press Ctrl+K to search anything"
        >
          <Search className="w-4 h-4 text-[#A7B8CA] group-hover:text-[#38BDF8] transition-colors shrink-0" />
          <span className="flex-1 font-medium text-[13px] text-[#A7B8CA]/90">Search workspace...</span>
          <kbd className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10 text-[10px] font-mono font-bold text-[#F5FAFF]">
            Ctrl + K
          </kbd>
        </div>

        {/* Right Controls: Notifications, Moon, Upgrade Button & Avatar */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          {/* Notification Bell */}
          <button
            onClick={() => setActiveTab('projects')}
            className="w-10 h-10 rounded-full lg-secondary flex items-center justify-center text-[#A7B8CA] hover:text-[#F5FAFF] transition-all relative cursor-pointer"
            title="Projects & Notifications"
          >
            <Bell className="w-4 h-4" />
            {recentProjects.length > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#38BDF8] ring-2 ring-[#070B13] animate-pulse" />
            )}
          </button>

          {/* Theme Indicator */}
          <button
            className="w-10 h-10 rounded-full lg-secondary flex items-center justify-center text-[#A7B8CA] hover:text-[#F5FAFF] transition-all cursor-pointer"
            title="Theme: Floating Liquid Glass"
          >
            <Moon className="w-4 h-4 text-[#38BDF8]" />
          </button>

          {/* Upgrade Liquid Glass Button */}
          <button
            onClick={() => setActiveTab('pricing')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#38BDF8] to-[#FF3366] hover:from-[#FF6688] hover:to-[#38BDF8] text-[#070B13] text-xs font-extrabold shadow-[0_4px_20px_rgba(56, 189, 248,0.3)] transition-all cursor-pointer hover:scale-105 active:scale-95"
            title="Upgrade to Pro Plan"
          >
            <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            <span>Upgrade</span>
          </button>

          {/* Avatar Profile */}
          <div
            onClick={onOpenUserPanel}
            className="cursor-pointer transition-transform hover:scale-105"
            title="Account Profile"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-9 h-9 rounded-full object-cover ring-2 ring-[#38BDF8]/50 shadow-md" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#FF3366] to-[#38BDF8] flex items-center justify-center text-[#070B13] font-black text-sm ring-2 ring-white/20 shadow-md">
                {userName ? userName[0].toUpperCase() : 'A'}
              </div>
            )}
          </div>

          {/* Quick Sign Out / Logout */}
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-9 h-9 rounded-full lg-secondary hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-300 flex items-center justify-center text-[#A7B8CA] transition-all cursor-pointer shadow-sm ml-1"
              title="Sign Out of OmniDoc Studio"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. HERO WELCOME SECTION WITH MASTER LIQUID GLASS EFFECT 6                 */}
      {/* ========================================================================= */}
      <div className="relative rounded-[28px] p-6 md:p-8 overflow-hidden lg-liquid-6 border border-white/15 shadow-[0_25px_65px_rgba(0,0,0,0.85)] flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Subtle Ambient Red & Blue Translucent Reflections */}
        <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-[#FF3366]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-20 w-80 h-80 rounded-full bg-[#38BDF8]/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-xl space-y-3 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-[#FF3366]/15 to-[#38BDF8]/15 border border-[#38BDF8]/30 text-[#38BDF8] text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-[#FF3366]" />
            <span>Liquid Glass Spatial Workspace • Level 6</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#F5FAFF] tracking-tight font-display">
            Welcome back, {userName}!
          </h1>
          <p className="text-xs sm:text-sm text-[#A7B8CA] font-medium leading-relaxed">
            Universal document workspace engineered for high-precision authoring, conversion, and intelligence.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2 justify-center md:justify-start">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="lg-btn-primary flex items-center gap-2"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Document</span>
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className="lg-btn-secondary flex items-center gap-2"
            >
              <LayoutTemplate className="w-4 h-4 text-[#38BDF8]" />
              <span>Browse Templates</span>
            </button>
          </div>
        </div>

        {/* 3D Floating Translucent Document Graphic */}
        <div className="relative shrink-0 w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center animate-float-gentle">
          <div className="absolute inset-0 bg-gradient-to-tr from-[#FF3366]/30 to-[#38BDF8]/30 rounded-3xl blur-2xl opacity-70" />

          <div className="relative w-28 h-36 sm:w-32 sm:h-40 rounded-2xl lg-liquid-3 border border-white/20 shadow-2xl p-3 flex flex-col justify-between transform -rotate-3 transition-transform hover:rotate-0">
            {/* Document Lines */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 pb-1 border-b border-white/10">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF3366] shadow-[0_0_8px_rgba(255,51,102,0.6)]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8] shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
              </div>
              <div className="w-16 h-2 rounded bg-gradient-to-r from-[#FF3366] via-[#E11D48] to-[#38BDF8]" />
              <div className="w-20 h-1.5 rounded bg-white/25" />
              <div className="w-14 h-1.5 rounded bg-white/15" />
              <div className="w-18 h-1.5 rounded bg-white/20" />
            </div>

            {/* Glowing Bottom Ribbon */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[9px] text-[#38BDF8] font-mono font-bold">
              <span>OMNI.DOC</span>
              <Sparkles className="w-3 h-3 text-[#FF3366]" />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. FOUR PROMINENT QUICK ACTION CARDS                                      */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Convert Files (Ruby Red) */}
        <div
          onClick={() => setActiveTab('converter')}
          className="lg-liquid-3 rounded-2xl p-5 cursor-pointer hover:border-[#FF3366]/60 group relative overflow-hidden"
        >
          <div className="w-11 h-11 rounded-xl bg-[#FF3366]/15 border border-[#FF3366]/30 flex items-center justify-center text-[#FF3366] mb-4 group-hover:scale-110 lg-glow-red transition-all">
            <RefreshCw className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#F5FAFF] group-hover:text-[#FF3366] transition-colors font-display">
            Convert Files
          </h3>
          <p className="text-xs text-[#A7B8CA] mt-1">Universal batch conversion</p>
        </div>

        {/* Card 2: Edit PDF (Sapphire Blue) */}
        <div
          onClick={() => setActiveTab('pdf')}
          className="lg-liquid-3 rounded-2xl p-5 cursor-pointer hover:border-[#38BDF8]/60 group relative overflow-hidden"
        >
          <div className="w-11 h-11 rounded-xl bg-[#38BDF8]/15 border border-[#38BDF8]/30 flex items-center justify-center text-[#38BDF8] mb-4 group-hover:scale-110 lg-glow-blue transition-all">
            <PenTool className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#F5FAFF] group-hover:text-[#38BDF8] transition-colors font-display">
            Edit PDF
          </h3>
          <p className="text-xs text-[#A7B8CA] mt-1">Annotate &amp; Sign PDF</p>
        </div>

        {/* Card 3: Work with Excel */}
        <div
          onClick={() => setActiveTab('sheets')}
          className="lg-liquid-3 rounded-2xl p-5 cursor-pointer hover:border-emerald-400/60 group relative overflow-hidden"
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-all">
            <Table className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#F5FAFF] group-hover:text-emerald-300 transition-colors font-display">
            Work with Excel
          </h3>
          <p className="text-xs text-[#A7B8CA] mt-1">Analyze &amp; Calculate</p>
        </div>

        {/* Card 4: Create Workflow (Red-Blue Chromatic) */}
        <div
          onClick={() => setActiveTab('workflow')}
          className="lg-liquid-3 rounded-2xl p-5 cursor-pointer hover:border-[#38BDF8]/60 group relative overflow-hidden"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#FF3366]/20 to-[#38BDF8]/20 border border-[#38BDF8]/30 flex items-center justify-center text-[#38BDF8] mb-4 group-hover:scale-110 lg-glow-dual transition-all">
            <Boxes className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#F5FAFF] group-hover:text-[#38BDF8] transition-colors font-display">
            Create Workflow
          </h3>
          <p className="text-xs text-[#A7B8CA] mt-1">Automated Document Pipelines</p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. LOWER 3-SECTION GRID: Recent Documents, Storage Overview & Quick Access */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (6 cols on xl, 12 cols on lg): Recent Documents */}
        <div className="lg:col-span-12 xl:col-span-6 lg-secondary rounded-2xl p-5 border border-[rgba(255,255,255,0.14)] flex flex-col justify-between space-y-4 min-w-0">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <h2 className="text-sm font-bold text-[#F5FAFF] font-display">Recent Documents</h2>
            <button
              onClick={() => setActiveTab('projects')}
              className="text-xs text-[#38BDF8] hover:text-[#FF3366] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {displayDocuments.length === 0 ? (
            /* Honest, Elegant Empty State */
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/15 flex items-center justify-center text-[#A7B8CA]">
                <Folder className="w-6 h-6 text-[#FF3366]/70" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-[#F5FAFF]">No saved documents yet</p>
                <p className="text-[11px] text-[#73869A] max-w-xs">
                  Create a new document or drop a file anywhere to get started.
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="lg-btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
              >
                <Plus className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>Upload First File</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {displayDocuments.map((doc) => {
                const isPdf = doc.title.endsWith('.pdf') || doc.type === 'pdf';
                const isDocx = doc.title.endsWith('.docx') || doc.type === 'docx';

                const iconBg = isPdf
                  ? 'bg-rose-500/15 text-rose-400 border-rose-500/25'
                  : isDocx
                    ? 'bg-sky-500/15 text-sky-400 border-sky-500/25'
                    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25';

                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      const found = recentProjects.find((p) => p.id === doc.id);
                      if (found) onLoadProject(found);
                      else setActiveTab(isPdf ? 'pdf' : isDocx ? 'docx' : 'sheets');
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.06] border border-transparent hover:border-[rgba(255,255,255,0.12)] transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${iconBg}`}>
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#F5FAFF] group-hover:text-[#38BDF8] transition-colors truncate">
                          {doc.title}
                        </div>
                        <div className="text-[11px] text-[#A7B8CA]">
                          {formatFileSize(doc.sizeBytes || 0)}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTab('projects');
                      }}
                      className="p-1 rounded-lg text-[#A7B8CA] hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Center Column (3 cols on xl, 6 cols on lg): Storage Overview Radial Chart */}
        <div className="lg:col-span-6 xl:col-span-3 lg-secondary rounded-2xl p-5 border border-[rgba(255,255,255,0.14)] flex flex-col justify-between space-y-4 min-w-0">
          <div className="pb-2 border-b border-[rgba(255,255,255,0.1)] flex items-center justify-between gap-1">
            <h2 className="text-sm font-bold text-[#F5FAFF] font-display truncate">Storage Usage</h2>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1 shrink-0 ${
              storageSource === 'cloud'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-gradient-to-r from-[#FF3366]/20 to-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30'
            }`}>
              {storageSource === 'cloud' ? <Database className="w-2.5 h-2.5" /> : <HardDrive className="w-2.5 h-2.5" />}
              <span>{storageSource === 'cloud' ? 'Cloud' : 'Sandbox'}</span>
            </span>
          </div>

          <div className="flex flex-col sm:flex-row xl:flex-col 2xl:flex-row items-center justify-center gap-4 py-3 text-center sm:text-left xl:text-center 2xl:text-left">
            {/* Circular Gauge Ring */}
            <div className="relative w-22 h-22 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 88 88">
                <circle
                  cx="44"
                  cy="44"
                  r={storageRadius}
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="44"
                  cy="44"
                  r={storageRadius}
                  stroke="url(#storageRedBlueGrad)"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={storageCircumference}
                  strokeDashoffset={storageStrokeOffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="storageRedBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FF3366" />
                    <stop offset="100%" stopColor="#38BDF8" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute font-extrabold text-base text-[#F5FAFF] font-display">
                {storageLoading ? '...' : `${storagePercentage}%`}
              </span>
            </div>

            {/* Storage Legend with honest numbers */}
            <div className="min-w-0 flex flex-col items-center sm:items-start xl:items-center 2xl:items-start">
              <div className="text-xs font-bold text-[#F5FAFF] truncate">
                {formatFileSize(usedBytes)}
              </div>
              <div className="text-[11px] text-[#A7B8CA] mt-0.5 truncate">
                of {formatFileSize(quotaBytes)} quota
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[rgba(255,255,255,0.1)] flex items-center justify-between text-[11px] text-[#A7B8CA]">
            <span className="truncate">{storageSource === 'cloud' ? 'Supabase Storage' : 'Local IndexedDB'}</span>
            <span className="text-emerald-400 font-semibold shrink-0 ml-1">Active</span>
          </div>
        </div>

        {/* Right Column (3 cols on xl, 6 cols on lg): Quick Access */}
        <div className="lg:col-span-6 xl:col-span-3 lg-secondary rounded-2xl p-5 border border-[rgba(255,255,255,0.14)] flex flex-col justify-between space-y-3 min-w-0">
          <div className="pb-2 border-b border-[rgba(255,255,255,0.1)]">
            <h2 className="text-sm font-bold text-[#F5FAFF] font-display">Quick Access</h2>
          </div>

          <div className="space-y-2">
            {/* My Projects */}
            <div
              onClick={() => setActiveTab('projects')}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.06] border border-transparent hover:border-[#FF3366]/30 transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#FF3366]/15 text-[#FF3366] flex items-center justify-center shrink-0">
                <Folder className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-[#F5FAFF] group-hover:text-[#FF3366] transition-colors flex-1 truncate">
                My Projects
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-[#A7B8CA] group-hover:translate-x-0.5 transition-transform shrink-0" />
            </div>

            {/* Templates */}
            <div
              onClick={() => setActiveTab('templates')}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.06] border border-transparent hover:border-[#38BDF8]/30 transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#38BDF8]/15 text-[#38BDF8] flex items-center justify-center shrink-0">
                <LayoutTemplate className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-[#F5FAFF] group-hover:text-[#38BDF8] transition-colors flex-1 truncate">
                Templates
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-[#A7B8CA] group-hover:translate-x-0.5 transition-transform shrink-0" />
            </div>

            {/* Activity Log */}
            <div
              onClick={() => setActiveTab('projects')}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.06] border border-transparent hover:border-[#2563EB]/30 transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#FF3366]/15 to-[#38BDF8]/15 text-[#38BDF8] flex items-center justify-center shrink-0">
                <History className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-[#F5FAFF] group-hover:text-[#38BDF8] transition-colors flex-1 truncate">
                Conversion History
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-[#A7B8CA] group-hover:translate-x-0.5 transition-transform shrink-0" />
            </div>

            {/* Settings */}
            <div
              onClick={onOpenSettings || (() => setActiveTab('settings'))}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.06] border border-transparent hover:border-[rgba(255,255,255,0.12)] transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                <SettingsIcon className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-[#F5FAFF] group-hover:text-emerald-300 transition-colors flex-1 truncate">
                Settings &amp; Keys
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-[#A7B8CA] group-hover:translate-x-0.5 transition-transform shrink-0" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
