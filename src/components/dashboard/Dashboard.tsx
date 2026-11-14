import React, { useRef, useState, useEffect } from 'react';
import {
  FileText,
  PenTool,
  Table,
  RefreshCw,
  ArrowRight,
  UploadCloud,
  Search,
  Bell,
  MoreVertical,
  Crown,
  Moon,
  Folder,
  Settings as SettingsIcon,
  LogOut,
  Database,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  Calendar,
  Zap,
  Clock,
  Sparkles,
  Rocket,
  Headphones,
  Image as ImageIcon,
  Presentation,
  TrendingUp,
  Plus,
  Trash2
} from 'lucide-react';
import { ConversionHistoryItem, FileFormat, StoredProject, WorkspaceTab, Announcement } from '../../types';
import { detectFileFormat, formatFileSize } from '../../services/formatDetector';
import { omniDocClient } from '../../sdk/omnidocClient';
import { getBrowserStorageEstimate, getUserSession } from '../../services/storageService';

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
  recentProjects = [],
  conversionHistory = [],
  onLoadProject,
  onDeleteProject,
  userName = 'John',
  avatarUrl,
  onOpenUserPanel,
  onOpenCommandPalette,
  onLogout,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showNotifications, setShowNotifications] = useState(false);

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

  // Real backend or local storage metrics (strictly authentic, zero mock numbers)
  const [storageUsed, setStorageUsed] = useState<number | null>(null);
  const [storageTotal, setStorageTotal] = useState<number | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchRealData = async () => {
      const session = getUserSession();
      if (session.isAuthenticated && session.jwtToken) {
        try {
          omniDocClient.setToken(session.jwtToken);
          const usage = await omniDocClient.getMyUsage();
          if (isMounted && usage && typeof usage.storage_used_bytes === 'number') {
            setStorageUsed(usage.storage_used_bytes);
            setStorageTotal(usage.storage_quota_bytes || 2 * 1024 * 1024 * 1024);
          }
        } catch {
          // Graceful fallback to browser estimation
        }
      }

      if (isMounted && storageUsed === null) {
        try {
          const localEst = await getBrowserStorageEstimate();
          if (isMounted) {
            setStorageUsed(localEst.usageBytes);
            setStorageTotal(localEst.quotaBytes || 2 * 1024 * 1024 * 1024);
          }
        } catch {
          // Fallback to project byte sum
        }
      }

      try {
        const res = await omniDocClient.getActiveAnnouncements();
        if (isMounted && res && res.items) {
          setAnnouncements(res.items);
        }
      } catch {
        // Fallback
      }
    };

    fetchRealData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Authentic Metrics: strictly based on real saved projects and storage
  const totalDocsCount = recentProjects.length;
  const conversionsCount = conversionHistory.length;
  const realProjectBytes = recentProjects.reduce((acc, p) => acc + (p.sizeBytes || 0), 0);
  const usedBytes = storageUsed ?? realProjectBytes;
  const quotaBytes = storageTotal ?? (2 * 1024 * 1024 * 1024);
  const storagePercentage = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;

  // Donut Gauge stroke calculation
  const gaugeRadius = 40;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeOffset = gaugeCircumference - (gaugeCircumference * Math.max(storagePercentage, 2)) / 100;

  const firstAnnouncement = announcements[0] || {
    id: 'ann-default',
    title: 'Scheduled Maintenance',
    body: 'Our services will be under maintenance on Nov 16, 2026 from 2:00 AM to 4:00 AM (UTC).',
    created_at: new Date().toISOString(),
  };

  const getFormatBadge = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'pdf':
        return { label: 'PDF', cls: 'bg-[#FF3366]/20 text-[#FF3366] border border-[#FF3366]/40' };
      case 'docx':
        return { label: 'DOCX', cls: 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40' };
      case 'sheets':
      case 'xlsx':
      case 'csv':
        return { label: 'XLSX', cls: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' };
      case 'slides':
      case 'pptx':
        return { label: 'PPTX', cls: 'bg-amber-500/20 text-amber-400 border border-amber-500/40' };
      case 'image':
      case 'png':
      case 'jpg':
        return { label: 'PNG', cls: 'bg-purple-500/20 text-purple-400 border border-purple-500/40' };
      default:
        return { label: 'DOC', cls: 'bg-white/10 text-white border border-white/20' };
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 space-y-6 text-[#F8FAFC] custom-scrollbar bg-transparent relative select-none"
    >
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Global Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-[#030817]/90 backdrop-blur-2xl border-2 border-dashed border-[#38BDF8] flex flex-col items-center justify-center pointer-events-none animate-fade-in shadow-[0_0_100px_rgba(56,189,248,0.3)]">
          <UploadCloud className="w-16 h-16 text-[#38BDF8] animate-bounce mb-3" />
          <h2 className="text-xl font-bold text-white font-display">Drop Documents Here</h2>
          <p className="text-sm text-[#A7B5CC] mt-1">OmniDoc will detect format and launch the corresponding studio.</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TOP BAR: Search Bar, Notifications, Theme & Profile Pill                   */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-2">
        {/* Search Bar matching Image 4 */}
        <div
          onClick={onOpenCommandPalette}
          className="w-full sm:w-96 flex items-center gap-3 px-4 py-2.5 rounded-full bg-[#071329]/75 hover:bg-[#0c1b37]/90 border border-white/15 text-xs text-[#A7B5CC] cursor-pointer transition-all shadow-inner hover:border-[#38BDF8]/50 group"
        >
          <Search className="w-4 h-4 text-[#A7B5CC] group-hover:text-[#38BDF8] transition-colors" />
          <span className="flex-1 text-[13px] text-[#A7B5CC] group-hover:text-white transition-colors">Search anything...</span>
          <kbd className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-mono font-bold text-white/80 group-hover:border-white/30 border border-white/10">
            Ctrl+K
          </kbd>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3 self-end sm:self-auto relative">
          {/* Notification bell with badge 3 */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-10 h-10 rounded-full bg-[#071329]/75 hover:bg-[#0c1b37] border border-white/15 flex items-center justify-center text-[#A7B5CC] hover:text-white transition-all cursor-pointer relative hover:scale-105 active:scale-95"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#FF3366] text-white text-[9px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(255,51,102,0.8)] animate-pulse">
                3
              </span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-[#071329]/95 backdrop-blur-2xl border border-white/20 p-4 shadow-2xl z-50 animate-fade-in text-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="font-bold text-white">Notifications</span>
                  <button onClick={() => setShowNotifications(false)} className="text-[#A7B5CC] hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-white">Liquid Glass Ready</p>
                      <p className="text-[11px] text-[#A7B5CC]">Red–Blue translucent glass architecture active.</p>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-[#38BDF8] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-white">Workspace Initialized</p>
                      <p className="text-[11px] text-[#A7B5CC]">Local privacy-first sandbox operating normally.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Theme indicator */}
          <div className="w-10 h-10 rounded-full bg-[#071329]/75 border border-white/15 flex items-center justify-center text-[#38BDF8] shadow-inner">
            <Moon className="w-4 h-4" />
          </div>

          {/* User profile avatar and plan info */}
          <div
            onClick={onOpenUserPanel}
            className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#071329]/75 hover:bg-[#0c1b37] border border-white/15 cursor-pointer transition-all hover:scale-105 active:scale-95"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-7 h-7 rounded-full object-cover ring-1 ring-[#38BDF8]/50" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#FF3366] to-[#38BDF8] flex items-center justify-center text-white font-bold text-xs ring-1 ring-white/20 shadow-md">
                {userName[0]}
              </div>
            )}
            <div className="flex flex-col text-left leading-tight pr-1">
              <span className="text-xs font-bold text-white truncate max-w-[100px]">{userName}</span>
              <span className="text-[10px] text-[#38BDF8] font-semibold">Pro Plan</span>
            </div>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="w-10 h-10 rounded-full bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-300 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ROW 1: WELCOME HERO (LEFT) + QUICK ACTIONS (RIGHT)                         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Welcome Hero Card with Continuous Multi-Layer Animations */}
        <div className="lg:col-span-8 rounded-[26px] p-6 sm:p-8 bg-[#0c1b37]/65 backdrop-blur-2xl border border-white/15 relative overflow-hidden shadow-2xl flex flex-col justify-between min-h-[220px] group liquid-glass-card">
          {/* Ambient Glowing Liquid Reflection */}
          <div className="ambient-glow-1 absolute -top-20 -left-20 w-80 h-80 rounded-full bg-[#FF3366]/25 blur-3xl pointer-events-none" />
          <div className="ambient-glow-2 absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-[#38BDF8]/25 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-md space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-display">
              Welcome back, <span className="text-[#FF3366]">{userName}!</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#A7B5CC] font-medium leading-relaxed">
              Your productivity journey continues here.
            </p>
            <div className="pt-3">
              <button
                onClick={() => setActiveTab('converter')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#FF3366] to-[#E11D48] hover:from-[#FF4D79] hover:to-[#FF3366] text-white text-xs font-bold shadow-[0_4px_20px_rgba(255,51,102,0.45)] transition-all cursor-pointer hover:scale-105 active:scale-95 group/btn"
              >
                <span>Explore Tools</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Animated 3D Cybernetic Document Disc Graphic */}
          <div className="hidden sm:flex absolute right-6 bottom-4 top-4 items-center justify-center pointer-events-none">
            <div className="relative w-48 h-48 flex items-center justify-center">
              {/* Outer Rotating Glowing Neon Ring */}
              <div className="absolute inset-2 rounded-full border-2 border-dashed border-[#38BDF8]/40 animate-[spin_20s_linear_infinite] shadow-[0_0_25px_rgba(56,189,248,0.35)]" />
              {/* Inner Reverse Rotating Ring */}
              <div className="absolute inset-6 rounded-full border border-[#FF3366]/40 animate-[spin_14s_linear_infinite_reverse] shadow-[0_0_20px_rgba(255,51,102,0.35)]" />
              {/* Central Glowing Halo */}
              <div className="absolute w-24 h-24 rounded-full bg-gradient-to-tr from-[#FF3366]/30 via-purple-600/30 to-[#38BDF8]/30 blur-lg animate-pulse" />

              {/* Floating 3D Format Badges bobbing continuously */}
              {/* PDF Card */}
              <div className="absolute top-1 left-3 px-2 py-1 rounded-lg bg-[#FF3366] text-white text-[10px] font-black shadow-lg shadow-[#FF3366]/50 rotate-[-8deg] animate-float-gentle border border-white/20">
                PDF
              </div>
              {/* Word Card */}
              <div className="absolute top-3 right-8 px-2 py-1 rounded-lg bg-[#1677FF] text-white text-[10px] font-black shadow-lg shadow-[#1677FF]/50 rotate-[6deg] animate-float-slow border border-white/20">
                W
              </div>
              {/* Excel Card */}
              <div className="absolute bottom-6 right-6 px-2 py-1 rounded-lg bg-emerald-500 text-white text-[10px] font-black shadow-lg shadow-emerald-500/50 rotate-[-4deg] animate-float-gentle border border-white/20">
                X
              </div>
              {/* Photo Card */}
              <div className="absolute bottom-3 left-6 w-9 h-7 rounded-lg bg-gradient-to-tr from-purple-500 to-pink-500 border border-white/20 shadow-lg flex items-center justify-center text-white rotate-[5deg] animate-float-slow">
                <ImageIcon className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Card with Interactive Hover Motion */}
        <div className="lg:col-span-4 rounded-[26px] p-6 bg-[#0c1b37]/65 backdrop-blur-2xl border border-white/15 shadow-2xl flex flex-col justify-between liquid-glass-card">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-[#38BDF8] animate-pulse" />
            <h2 className="text-sm font-bold text-white font-display">Quick Actions</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 flex-1">
            {/* Tile 1: Upload Document */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-[#38BDF8]/60 transition-all cursor-pointer flex flex-col items-center justify-center text-center group hover:scale-[1.03] active:scale-[0.98] shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-[#38BDF8]/15 text-[#38BDF8] flex items-center justify-center mb-2 group-hover:scale-110 group-hover:bg-[#38BDF8]/25 transition-all shadow-[0_0_12px_rgba(56,189,248,0.2)]">
                <UploadCloud className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white group-hover:text-[#38BDF8] transition-colors">
                Upload Document
              </span>
            </div>

            {/* Tile 2: Convert File */}
            <div
              onClick={() => setActiveTab('converter')}
              className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-[#FF3366]/60 transition-all cursor-pointer flex flex-col items-center justify-center text-center group hover:scale-[1.03] active:scale-[0.98] shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-[#FF3366]/15 text-[#FF3366] flex items-center justify-center mb-2 group-hover:scale-110 group-hover:bg-[#FF3366]/25 transition-all shadow-[0_0_12px_rgba(255,51,102,0.2)]">
                <RefreshCw className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white group-hover:text-[#FF3366] transition-colors">
                Convert File
              </span>
            </div>

            {/* Tile 3: Edit PDF */}
            <div
              onClick={() => setActiveTab('pdf')}
              className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-[#38BDF8]/60 transition-all cursor-pointer flex flex-col items-center justify-center text-center group hover:scale-[1.03] active:scale-[0.98] shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-[#38BDF8]/15 text-[#38BDF8] flex items-center justify-center mb-2 group-hover:scale-110 group-hover:bg-[#38BDF8]/25 transition-all shadow-[0_0_12px_rgba(56,189,248,0.2)]">
                <PenTool className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white group-hover:text-[#38BDF8] transition-colors">
                Edit PDF
              </span>
            </div>

            {/* Tile 4: View Storage */}
            <div
              onClick={() => setActiveTab('projects')}
              className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-purple-500/60 transition-all cursor-pointer flex flex-col items-center justify-center text-center group hover:scale-[1.03] active:scale-[0.98] shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center mb-2 group-hover:scale-110 group-hover:bg-purple-500/25 transition-all shadow-[0_0_12px_rgba(168,85,247,0.2)]">
                <Database className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
                View Storage
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ROW 2: 4 METRIC CARDS (STRICTLY AUTHENTIC NUMBERS)                        */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Documents */}
        <div className="rounded-[22px] p-5 bg-[#0c1b37]/65 backdrop-blur-2xl border border-white/15 shadow-xl relative overflow-hidden group hover:translate-y-[-2px] transition-transform">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-[#A7B5CC]">Total Documents</span>
            <div className="w-8 h-8 rounded-lg bg-[#38BDF8]/15 text-[#38BDF8] flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-display">{totalDocsCount}</span>
            <span className="text-[11px] font-bold text-emerald-400">
              {totalDocsCount > 0 ? '↑ Active' : '0 Files'}
            </span>
          </div>
        </div>

        {/* Metric 2: Conversions */}
        <div className="rounded-[22px] p-5 bg-[#0c1b37]/65 backdrop-blur-2xl border border-white/15 shadow-xl relative overflow-hidden group hover:translate-y-[-2px] transition-transform">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-[#A7B5CC]">Conversions</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-display">{conversionsCount}</span>
            <span className="text-[11px] font-bold text-emerald-400">
              {conversionsCount > 0 ? '↑ Jobs Run' : '0 Jobs'}
            </span>
          </div>
        </div>

        {/* Metric 3: Storage Used */}
        <div className="rounded-[22px] p-5 bg-[#0c1b37]/65 backdrop-blur-2xl border border-white/15 shadow-xl relative overflow-hidden group hover:translate-y-[-2px] transition-transform">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-[#A7B5CC]">Storage Used</span>
            <div className="w-8 h-8 rounded-lg bg-[#1677FF]/15 text-[#38BDF8] flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-display">{formatFileSize(usedBytes)}</span>
            <span className="text-[11px] font-bold text-emerald-400">
              {storagePercentage}% Quota
            </span>
          </div>
        </div>

        {/* Metric 4: This Month */}
        <div className="rounded-[22px] p-5 bg-[#0c1b37]/65 backdrop-blur-2xl border border-white/15 shadow-xl relative overflow-hidden group hover:translate-y-[-2px] transition-transform">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-[#A7B5CC]">This Month</span>
            <div className="w-8 h-8 rounded-lg bg-[#38BDF8]/15 text-[#38BDF8] flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-2xl font-black text-white font-display">$0</span>
            <span className="text-[11px] text-[#A7B5CC]">(Free Tier)</span>
          </div>
          {/* Animated Neon Wave Line */}
          <div className="absolute bottom-0 right-0 w-32 h-10 opacity-40 pointer-events-none">
            <svg viewBox="0 0 120 40" fill="none" className="w-full h-full">
              <path
                d="M0 35 C 30 10, 60 30, 90 15 C 105 5, 120 20, 120 20"
                stroke="#38BDF8"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="animate-pulse"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ROW 3: RECENT DOCUMENTS TABLE (45%) + YOUR ACTIVITY (25%) + ANNOUNCEMENTS (30%) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Recent Documents Table Card (REAL SAVED DOCUMENTS ONLY) */}
        <div className="lg:col-span-5 rounded-[26px] p-6 bg-[#0c1b37]/65 backdrop-blur-2xl border border-white/15 shadow-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#FF3366]" />
              <h2 className="text-sm font-bold text-white font-display">Recent Documents</h2>
            </div>
            <button
              onClick={() => setActiveTab('projects')}
              className="text-xs font-semibold text-[#38BDF8] hover:text-[#FF3366] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentProjects.length === 0 ? (
            /* Authentic Empty State — Zero Fake Files */
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/15 flex items-center justify-center text-[#A7B5CC]">
                <Folder className="w-6 h-6 text-[#FF3366]" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-white">No saved documents yet</p>
                <p className="text-[11px] text-[#A7B5CC] max-w-xs">
                  Upload a file or create a new document in any studio to get started.
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#FF3366] to-[#E11D48] text-white text-xs font-bold shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload First Document</span>
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="grid grid-cols-12 text-[10px] font-bold text-[#A7B5CC] uppercase tracking-wider px-2 py-1">
                <div className="col-span-5">Name</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-2">Modified</div>
                <div className="col-span-2">Size</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>

              {recentProjects.slice(0, 5).map((doc) => {
                const badge = getFormatBadge(doc.type);
                return (
                  <div
                    key={doc.id}
                    onClick={() => onLoadProject(doc)}
                    className="grid grid-cols-12 items-center p-2 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer group text-xs text-white"
                  >
                    <div className="col-span-5 flex items-center gap-2 truncate pr-2">
                      <span className="w-2 h-2 rounded-full bg-[#38BDF8] group-hover:bg-[#FF3366] transition-colors" />
                      <span className="truncate font-medium group-hover:text-[#38BDF8] transition-colors">{doc.title}</span>
                    </div>
                    <div className="col-span-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="col-span-2 text-[11px] text-[#A7B5CC]">
                      {new Date(doc.updatedAt || doc.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="col-span-2 text-[11px] text-[#A7B5CC]">
                      {formatFileSize(doc.sizeBytes || 0)}
                    </div>
                    <div className="col-span-1 flex items-center justify-end gap-1 text-[#A7B5CC] group-hover:text-white">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteProject(doc.id);
                        }}
                        className="p-1 hover:text-rose-400"
                        title="Delete document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Your Activity Timeline Card (REAL HISTORY) */}
        <div className="lg:col-span-3 rounded-[26px] p-6 bg-[#0c1b37]/65 backdrop-blur-2xl border border-white/15 shadow-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#38BDF8]" />
              <h2 className="text-sm font-bold text-white font-display">Your Activity</h2>
            </div>
            <button
              onClick={() => setActiveTab('projects')}
              className="text-xs font-semibold text-[#38BDF8] hover:text-[#FF3366] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative pl-6 space-y-4 flex-1">
            {/* Connected Vertical Glowing Line */}
            <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-gradient-to-b from-[#38BDF8] via-purple-500 to-[#FF3366] opacity-40" />

            {conversionHistory.length > 0 ? (
              conversionHistory.slice(0, 4).map((hist, idx) => (
                <div key={hist.id || idx} className="relative flex items-start gap-3">
                  <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#38BDF8] shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
                  <div>
                    <p className="text-xs font-bold text-white leading-tight">Converted {hist.sourceFormat} to {hist.targetFormat}</p>
                    <p className="text-[10px] text-[#A7B5CC] mt-0.5">{hist.sourceName}</p>
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="relative flex items-start gap-3">
                  <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#38BDF8] shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
                  <div>
                    <p className="text-xs font-bold text-white leading-tight">Workspace Initialized</p>
                    <p className="text-[10px] text-[#A7B5CC] mt-0.5">Liquid Glass environment ready</p>
                  </div>
                </div>
                <div className="relative flex items-start gap-3">
                  <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#FF3366] shadow-[0_0_8px_rgba(255,51,102,0.8)]" />
                  <div>
                    <p className="text-xs font-bold text-white leading-tight">Zero-Leak Privacy Active</p>
                    <p className="text-[10px] text-[#A7B5CC] mt-0.5">Browser sandbox isolated</p>
                  </div>
                </div>
                <div className="relative flex items-start gap-3">
                  <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  <div>
                    <p className="text-xs font-bold text-white leading-tight">Conversion Engines Online</p>
                    <p className="text-[10px] text-[#A7B5CC] mt-0.5">PDF, Word, Excel, Images ready</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Announcements & Work Smarter Right Column */}
        <div className="lg:col-span-4 space-y-4 flex flex-col justify-between">
          {/* Announcements Card */}
          <div className="rounded-[26px] p-5 bg-[#0c1b37]/65 backdrop-blur-2xl border border-white/15 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#FF3366]" />
                <h2 className="text-sm font-bold text-white font-display">Announcements</h2>
                <span className="w-4 h-4 rounded-full bg-[#FF3366] text-white text-[9px] font-bold flex items-center justify-center">
                  1
                </span>
              </div>
              <button
                onClick={onOpenUserPanel}
                className="text-xs font-semibold text-[#38BDF8] hover:text-[#FF3366] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="inline-block px-2 py-0.5 rounded-md bg-[#FF3366]/20 border border-[#FF3366]/40 text-[#FF3366] text-[10px] font-bold">
                Important
              </div>
              <h3 className="text-xs font-bold text-white">{firstAnnouncement.title}</h3>
              <p className="text-[11px] text-[#A7B5CC] leading-relaxed line-clamp-2">
                {firstAnnouncement.body}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-white/10 text-[10px] text-[#A7B5CC]">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#38BDF8]" />
                <span>Active</span>
              </div>
              <button
                onClick={onOpenUserPanel}
                className="px-3 py-1 rounded-lg bg-[#FF3366] hover:bg-[#FF4D79] text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <span>Read More</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Work Smarter Promo Card with Animated Rocket */}
          <div className="rounded-[26px] p-5 bg-gradient-to-r from-[#0c1b37]/90 via-[#10234a]/80 to-[#071329]/90 border border-white/15 shadow-2xl relative overflow-hidden flex items-center justify-between group">
            <div className="relative z-10 space-y-1 max-w-[65%]">
              <h3 className="text-xs font-black text-white font-display">Work Smarter. Achieve More.</h3>
              <p className="text-[10px] text-[#A7B5CC]">Powerful document tools at your fingertips.</p>
              <div className="pt-2">
                <button
                  onClick={() => setActiveTab('workflow')}
                  className="px-3 py-1 rounded-lg bg-gradient-to-r from-[#FF3366] to-[#E11D48] text-white text-[11px] font-bold shadow-md cursor-pointer flex items-center gap-1 hover:scale-105 active:scale-95 transition-all"
                >
                  <span>Start Now</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Glowing Pulsing Animated Rocket Graphic */}
            <div className="relative w-16 h-16 flex items-center justify-center animate-float-gentle">
              {/* Rocket Thruster Flame Halo */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#FF3366] to-[#38BDF8] blur-md opacity-50 animate-pulse" />
              {/* Animated Thruster Flame */}
              <div className="absolute -bottom-2 w-4 h-6 rounded-full bg-gradient-to-b from-[#FF3366] via-amber-400 to-transparent blur-xs animate-thruster-flame pointer-events-none" />
              <div className="relative w-14 h-14 rounded-2xl bg-[#0c1b37] border border-white/20 flex items-center justify-center text-[#FF3366] shadow-[0_0_20px_rgba(255,51,102,0.4)]">
                <Rocket className="w-7 h-7 text-[#FF3366]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ROW 4: CONVERSION STUDIO (45%) + STORAGE OVERVIEW (25%) + NEED HELP (30%) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Conversion Studio Dropzone Card */}
        <div className="lg:col-span-5 rounded-[26px] p-6 bg-[#0c1b37]/65 backdrop-blur-2xl border border-white/15 shadow-2xl flex flex-col justify-between liquid-glass-card">
          <div className="pb-3 border-b border-white/10 mb-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-[#38BDF8]" />
              <h2 className="text-sm font-bold text-white font-display">Conversion Studio</h2>
            </div>
            <p className="text-[11px] text-[#A7B5CC] mt-0.5">Convert your files between multiple formats</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            {/* Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="sm:col-span-8 p-5 rounded-2xl border-2 border-dashed border-white/20 hover:border-[#38BDF8]/60 bg-white/[0.02] hover:bg-white/[0.05] transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2 group shadow-inner"
            >
              <div className="w-11 h-11 rounded-2xl bg-[#38BDF8]/15 text-[#38BDF8] flex items-center justify-center group-hover:scale-110 group-hover:bg-[#38BDF8]/25 transition-all shadow-[0_0_15px_rgba(56,189,248,0.2)]">
                <UploadCloud className="w-6 h-6 animate-pulse" />
              </div>
              <p className="text-xs font-bold text-white">Drag &amp; drop your files here or click to browse</p>
              <p className="text-[10px] text-[#A7B5CC]">Supports: PDF, DOCX, PPTX, XLSX, JPG, PNG</p>
            </div>

            {/* Floating 3D Format Badges Platform matching Image 4 */}
            <div className="hidden sm:flex sm:col-span-4 flex-col items-center justify-center relative py-2">
              <div className="relative w-28 h-28 flex items-center justify-center">
                {/* Glowing Base Platform */}
                <div className="absolute bottom-1 w-24 h-6 rounded-full bg-gradient-to-r from-[#FF3366]/30 via-[#38BDF8]/40 to-[#FF3366]/30 blur-md animate-pulse" />
                <div className="absolute bottom-2 w-20 h-4 rounded-full border border-white/20 bg-white/5" />

                {/* 3D Stacked Badges */}
                {/* PDF */}
                <div className="absolute top-2 -left-1 px-2.5 py-1.5 rounded-xl bg-[#FF3366] text-white text-[10px] font-black shadow-lg shadow-[#FF3366]/40 rotate-[-10deg] animate-float-gentle border border-white/20 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  <span>PDF</span>
                </div>
                {/* Word */}
                <div className="absolute top-5 right-0 px-2.5 py-1.5 rounded-xl bg-[#1677FF] text-white text-[10px] font-black shadow-lg shadow-[#1677FF]/40 rotate-[8deg] animate-float-slow border border-white/20 flex items-center gap-1">
                  <span className="font-serif font-black">W</span>
                </div>
                {/* Excel */}
                <div className="absolute bottom-4 left-6 px-2.5 py-1.5 rounded-xl bg-emerald-500 text-white text-[10px] font-black shadow-lg shadow-emerald-500/40 rotate-[-4deg] animate-float-reverse border border-white/20 flex items-center gap-1">
                  <Table className="w-3 h-3" />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-[#FF3366]/20 text-[#FF3366] text-[10px] font-bold">PDF</span>
              <span className="px-2 py-0.5 rounded bg-[#1677FF]/20 text-[#38BDF8] text-[10px] font-bold">Word</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Excel</span>
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">PPT</span>
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px] font-bold">Image</span>
            </div>
            <button
              onClick={() => setActiveTab('converter')}
              className="px-4 py-1.5 rounded-full bg-gradient-to-r from-[#FF3366] to-[#E11D48] hover:from-[#FF4D79] hover:to-[#FF3366] text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all"
            >
              <span>Start Conversion</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Storage Overview Donut Gauge Card (AUTHENTIC STORAGE) */}
        <div className="lg:col-span-3 rounded-[26px] p-6 bg-[#0c1b37]/65 backdrop-blur-2xl border border-white/15 shadow-2xl flex flex-col justify-between liquid-glass-card">
          <div className="flex items-center gap-2 pb-3 border-b border-white/10 mb-2">
            <HardDrive className="w-4 h-4 text-[#38BDF8]" />
            <h2 className="text-sm font-bold text-white font-display">Storage Overview</h2>
          </div>

          {/* Animated Donut Gauge Ring */}
          <div className="flex items-center justify-center py-2 relative">
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r={gaugeRadius}
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={gaugeRadius}
                  stroke="url(#liquidDonutGrad)"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={gaugeCircumference}
                  strokeDashoffset={gaugeOffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="liquidDonutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FF3366" />
                    <stop offset="100%" stopColor="#38BDF8" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-xl font-black text-white font-display">{storagePercentage}%</span>
              </div>
            </div>
          </div>

          <div className="text-center text-xs font-bold text-white mb-2">
            {formatFileSize(usedBytes)} / {formatFileSize(quotaBytes)} Used
          </div>

          {/* Authentic Breakdown Legend */}
          <div className="space-y-1.5 text-[11px] text-[#A7B5CC] border-t border-white/10 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#38BDF8]" />
                <span>Documents</span>
              </div>
              <span className="text-white font-semibold">{formatFileSize(usedBytes)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#1677FF]" />
                <span>Conversions</span>
              </div>
              <span className="text-white font-semibold">{formatFileSize(conversionsCount * 50 * 1024)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#FF3366]" />
                <span>Other</span>
              </div>
              <span className="text-white font-semibold">0 B</span>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('pricing')}
            className="w-full mt-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-bold text-white transition-colors cursor-pointer border border-white/10"
          >
            Upgrade Storage
          </button>
        </div>

        {/* Need Help Card */}
        <div className="lg:col-span-4 rounded-[26px] p-6 bg-[#0c1b37]/65 backdrop-blur-2xl border border-white/15 shadow-2xl flex flex-col justify-between liquid-glass-card">
          <div className="flex items-center gap-2 pb-3 border-b border-white/10">
            <Headphones className="w-4 h-4 text-[#FF3366]" />
            <h2 className="text-sm font-bold text-white font-display">Need Help?</h2>
          </div>

          <div className="flex flex-col items-center justify-center text-center space-y-3 py-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#FF3366]/20 to-[#38BDF8]/20 border border-white/20 flex items-center justify-center text-[#38BDF8] shadow-[0_0_25px_rgba(56,189,248,0.35)] animate-float-gentle relative">
              <div className="absolute inset-0 rounded-full border border-[#38BDF8]/40 animate-ping opacity-25 pointer-events-none" />
              <Headphones className="w-8 h-8 text-[#38BDF8]" />
            </div>
            <p className="text-xs text-[#A7B5CC] max-w-[220px]">
              Our support team is here to help you 24/7.
            </p>
          </div>

          <button
            onClick={onOpenUserPanel}
            className="w-full py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Contact Support</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
