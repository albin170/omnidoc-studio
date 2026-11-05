import React from 'react';
import { 
  LayoutDashboard, 
  RefreshCw, 
  FileText, 
  PenTool, 
  Presentation, 
  Table, 
  Image as ImageIcon, 
  ScanText, 
  Layers, 
  FolderArchive, 
  Settings, 
  ChevronDown,
  ShieldAlert,
  X,
  Zap,
  Search,
  HelpCircle,
  LogOut,
  Sparkles,
  GitCompare,
  Boxes,
  Binary,
  GitCommit
} from 'lucide-react';
import { WorkspaceTab } from '../../types';
import { OmniDocLogo } from './OmniDocLogo';

interface SidebarProps {
  activeTab: WorkspaceTab;
  setActiveTab: (tab: WorkspaceTab) => void;
  conversionCount?: number;
  projectCount?: number;
  userName?: string;
  avatarUrl?: string;
  userRole?: string;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onOpenUserPanel?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenHelp?: () => void;
  onLogout?: () => void;
  onOpenDiff?: () => void;
  onOpenBatch?: () => void;
  onOpenAi?: () => void;
  onOpenForensics?: () => void;
  onOpenLineage?: () => void;
  onOpenReceipts?: () => void;
  onOpenPrivacy?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  conversionCount = 0,
  projectCount = 0,
  userName = 'Document Architect',
  avatarUrl,
  userRole = 'user',
  isMobileOpen = false,
  onCloseMobile,
  onOpenUserPanel,
  onOpenCommandPalette,
  onOpenHelp,
  onLogout,
  onOpenDiff,
  onOpenBatch,
  onOpenAi,
  onOpenForensics,
  onOpenLineage,
  onOpenReceipts,
  onOpenPrivacy,
}) => {
  const navItems = [
    {
      tab: 'dashboard' as WorkspaceTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      tab: 'autonomous' as WorkspaceTab,
      label: 'Autonomous 2.0',
      icon: Sparkles,
      badge: 'Agent',
    },
    {
      tab: 'workflow' as WorkspaceTab,
      label: 'Workflow Studio',
      icon: Boxes,
      badge: 'v2.1',
    },
    {
      tab: 'converter' as WorkspaceTab,
      label: 'Conversion Hub',
      icon: RefreshCw,
      badge: conversionCount > 0 ? `${conversionCount}` : null,
    },
    {
      tab: 'pdf' as WorkspaceTab,
      label: 'PDF Studio',
      icon: FileText,
    },
    {
      tab: 'docx' as WorkspaceTab,
      label: 'Word Documents',
      icon: PenTool,
    },
    {
      tab: 'slides' as WorkspaceTab,
      label: 'PowerPoint Studio',
      icon: Presentation,
    },
    {
      tab: 'sheets' as WorkspaceTab,
      label: 'Sheets & Data',
      icon: Table,
    },
    {
      tab: 'image' as WorkspaceTab,
      label: 'Photo & Graphics',
      icon: ImageIcon,
    },
    {
      tab: 'ocr' as WorkspaceTab,
      label: 'OCR Scanner',
      icon: ScanText,
    },
    {
      tab: 'templates' as WorkspaceTab,
      label: 'Templates Gallery',
      icon: Layers,
    },
    {
      tab: 'projects' as WorkspaceTab,
      label: 'Projects & History',
      icon: FolderArchive,
      badge: projectCount > 0 ? `${projectCount}` : null,
    },
    {
      tab: 'settings' as WorkspaceTab,
      label: 'Settings & Privacy',
      icon: Settings,
    },
    ...(userRole === 'admin'
      ? [
          {
            tab: 'admin' as WorkspaceTab,
            label: 'Admin Console',
            icon: ShieldAlert,
          },
        ]
      : []),
  ];

  const handleSelectTab = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const userInitial = userName ? userName[0].toUpperCase() : 'D';

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Full-Height Glass Sidebar */}
      <aside
        className={`w-64 glass-sidebar h-full flex flex-col justify-between shrink-0 p-4 select-none transition-transform duration-300 z-50 ${
          isMobileOpen
            ? 'fixed inset-y-0 left-0 shadow-2xl translate-x-0'
            : 'hidden md:flex'
        }`}
      >
        {/* Brand Header */}
        <div>
          <div className="pt-2 pb-5 px-2 flex items-center justify-between border-b border-white/10 mb-2">
            <div 
              className="flex items-center gap-2.5 cursor-pointer" 
              onClick={() => handleSelectTab('dashboard')}
            >
              <OmniDocLogo size={36} />
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5 leading-tight">
                  <span className="font-extrabold text-sm text-white tracking-tight">
                    OmniDoc
                  </span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/30 text-blue-300 font-mono font-bold">
                    PRO
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">
                  Studio Workspace
                </span>
              </div>
            </div>

            {/* Mobile Close Button */}
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white md:hidden cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Quick Search Trigger */}
          {onOpenCommandPalette && (
            <button
              onClick={onOpenCommandPalette}
              className="w-full flex items-center justify-between px-3 py-2 mb-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 text-xs transition-all cursor-pointer"
              title="Open Command Palette (Ctrl+K)"
            >
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-semibold">Quick Search</span>
              </div>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[9px] text-slate-300">
                Ctrl+K
              </kbd>
            </button>
          )}

          {/* Navigation Links */}
          <nav className="space-y-1 overflow-y-auto max-h-[calc(100vh-250px)]">
            {navItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = activeTab === item.tab;

              return (
                <button
                  key={`${item.label}-${idx}`}
                  onClick={() => handleSelectTab(item.tab)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Intelligence & Automation Quick Actions */}
        <div className="pt-2 pb-1 space-y-1.5 border-t border-white/10 shrink-0">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
            Intelligence &amp; Tools
          </div>
          <div className="grid grid-cols-3 gap-1.5 px-1">
            {onOpenAi && (
              <button
                onClick={onOpenAi}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 transition-all cursor-pointer"
                title="AI Document Assistant"
              >
                <Sparkles className="w-4 h-4 mb-0.5 text-purple-400" />
                <span className="text-[9px] font-bold">AI Help</span>
              </button>
            )}
            {onOpenDiff && (
              <button
                onClick={onOpenDiff}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 transition-all cursor-pointer"
                title="Document Comparison (Diff)"
              >
                <GitCompare className="w-4 h-4 mb-0.5 text-indigo-400" />
                <span className="text-[9px] font-bold">Compare</span>
              </button>
            )}
            {onOpenBatch && (
              <button
                onClick={onOpenBatch}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 transition-all cursor-pointer"
                title="Batch Convert & ZIP"
              >
                <Layers className="w-4 h-4 mb-0.5 text-blue-400" />
                <span className="text-[9px] font-bold">Batch ZIP</span>
              </button>
            )}
            {onOpenForensics && (
              <button
                onClick={onOpenForensics}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 transition-all cursor-pointer"
                title="Document Forensics & Threat Lab"
              >
                <Binary className="w-4 h-4 mb-0.5 text-amber-400" />
                <span className="text-[9px] font-bold">Forensics</span>
              </button>
            )}
            {onOpenLineage && (
              <button
                onClick={onOpenLineage}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/20 transition-all cursor-pointer"
                title="Document Data Lineage"
              >
                <GitCommit className="w-4 h-4 mb-0.5 text-teal-400" />
                <span className="text-[9px] font-bold">Lineage</span>
              </button>
            )}
            {onOpenReceipts && (
              <button
                onClick={onOpenReceipts}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 border border-yellow-500/20 transition-all cursor-pointer"
                title="Transformation Receipts & Certs"
              >
                <Boxes className="w-4 h-4 mb-0.5 text-yellow-400" />
                <span className="text-[9px] font-bold">Receipts</span>
              </button>
            )}
            {onOpenPrivacy && (
              <button
                onClick={onOpenPrivacy}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-all cursor-pointer"
                title="Privacy Guardian & Verified Redaction"
              >
                <ShieldAlert className="w-4 h-4 mb-0.5 text-rose-400" />
                <span className="text-[9px] font-bold">Privacy</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom Profile & User Panel Trigger */}
        <div className="pt-2.5 space-y-2 border-t border-white/10">
          <div 
            onClick={onOpenUserPanel || (() => handleSelectTab('settings'))}
            className="p-2.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors"
            title="Open User & Billing Panel"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={userName}
                    className="w-8 h-8 rounded-full object-cover ring-1 ring-white/20"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs ring-1 ring-white/20">
                    {userInitial}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-1.5 ring-[#091538]" />
              </div>
              <div className="text-left min-w-0">
                <div className="text-xs font-bold text-white leading-tight truncate">{userName}</div>
                <div className="text-[10px] text-blue-300 font-semibold leading-tight flex items-center gap-1 mt-0.5">
                  <Zap className="w-2.5 h-2.5 text-amber-400" />
                  <span>Pro Workspace</span>
                </div>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
          </div>

          {/* Quick Help & Logout Toolbar */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenHelp}
              className="flex-1 py-1.5 px-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-white/5"
              title="Keyboard Shortcuts & Guide"
            >
              <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
              <span>Guide (?)</span>
            </button>
            <button
              onClick={onLogout}
              className="py-1.5 px-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 hover:text-red-200 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer border border-red-500/20"
              title="Log Out & Switch Account"
            >
              <LogOut className="w-3.5 h-3.5 text-red-400" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
