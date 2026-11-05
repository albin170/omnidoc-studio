import React, { useState } from 'react';
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
  GitCommit,
  SlidersHorizontal,
  Users,
  Code2,
  ChevronLeft,
  ChevronRight
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
  onOpenWhatIf?: () => void;
  onOpenCollab?: () => void;
  onOpenDeveloper?: () => void;
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
  onOpenWhatIf,
  onOpenCollab,
  onOpenDeveloper,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

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
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md md:hidden"
        />
      )}

      {/* Full-Height Aurora Glass Sidebar */}
      <aside
        className={`glass-sidebar h-full flex flex-col justify-between shrink-0 p-3 select-none transition-all duration-300 z-50 ${isCollapsed ? 'w-20' : 'w-64'
          } ${isMobileOpen
            ? 'fixed inset-y-0 left-0 shadow-2xl translate-x-0 w-72'
            : 'hidden md:flex'
          }`}
      >
        {/* Brand Header & Toggle */}
        <div>
          <div className="pt-1 pb-4 px-1.5 flex items-center justify-between border-b border-white/10 mb-2">
            <div
              className="flex items-center gap-2.5 cursor-pointer min-w-0"
              onClick={() => handleSelectTab('dashboard')}
              title="OmniDoc Studio Home"
            >
              <div className="relative shrink-0">
                <OmniDocLogo size={isCollapsed ? 32 : 36} />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#42D6E8] glow-cyan" />
              </div>
              {!isCollapsed && (
                <div className="flex flex-col text-left min-w-0">
                  <div className="flex items-center gap-1.5 leading-tight">
                    <span className="font-extrabold text-sm text-[#F4F5FF] tracking-tight truncate">
                      OmniDoc
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-[#8B7CFF]/20 text-[#8B7CFF] border border-[#8B7CFF]/30 font-mono font-bold">
                      PRO
                    </span>
                  </div>
                  <span className="text-[10px] text-[#9BA3BD] font-medium tracking-wide">
                    Aurora Workspace
                  </span>
                </div>
              )}
            </div>

            {/* Desktop Collapse Toggle / Mobile Close Button */}
            {isMobileOpen ? (
              <button
                onClick={onCloseMobile}
                className="p-1 rounded-lg hover:bg-white/10 text-[#9BA3BD] hover:text-white md:hidden cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="hidden md:flex p-1 rounded-lg hover:bg-white/10 text-[#9BA3BD] hover:text-white transition-colors cursor-pointer"
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            )}
          </div>

          {/* Quick Search Trigger */}
          {onOpenCommandPalette && (
            <button
              onClick={onOpenCommandPalette}
              className={`w-full flex items-center mb-2 rounded-xl glass-input text-[#9BA3BD] hover:text-[#F4F5FF] hover:border-[#8B7CFF]/40 text-xs transition-all cursor-pointer ${isCollapsed ? 'justify-center p-2' : 'justify-between px-3 py-2'
                }`}
              title="Open Command Palette (Ctrl+K)"
            >
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-[#42D6E8]" />
                {!isCollapsed && <span className="font-semibold text-[11px]">Quick Search</span>}
              </div>
              {!isCollapsed && (
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 font-mono text-[9px] text-[#9BA3BD]">
                  Ctrl+K
                </kbd>
              )}
            </button>
          )}

          {/* Navigation Links */}
          <nav className="space-y-1 overflow-y-auto max-h-[calc(100vh-280px)] pr-0.5 custom-scrollbar">
            {navItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = activeTab === item.tab;

              return (
                <button
                  key={`${item.label}-${idx}`}
                  onClick={() => handleSelectTab(item.tab)}
                  title={item.label}
                  className={`w-full flex items-center rounded-xl text-xs font-medium transition-all cursor-pointer relative ${isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
                    } ${isActive
                      ? 'bg-gradient-to-r from-[#8B7CFF]/25 to-[#42D6E8]/15 border border-[#8B7CFF]/40 text-[#F4F5FF] font-bold shadow-lg shadow-[#8B7CFF]/15 glow-purple'
                      : 'text-[#9BA3BD] hover:text-[#F4F5FF] hover:bg-white/[0.05] border border-transparent hover:border-white/5'
                    }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isActive && (
                      <span className="absolute left-1 w-1 h-3.5 bg-gradient-to-b from-[#8B7CFF] to-[#42D6E8] rounded-full" />
                    )}
                    <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-[#8B7CFF]' : 'text-[#9BA3BD]'
                      }`} />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isCollapsed && item.badge && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#8B7CFF]/25 border border-[#8B7CFF]/40 text-[#F4F5FF] text-[9px] font-mono font-bold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Intelligence & Automation Quick Actions */}
        {!isCollapsed && (
          <div className="pt-2 pb-1 space-y-1.5 border-t border-white/10 shrink-0">
            <div className="text-[9px] font-extrabold text-[#9BA3BD]/70 uppercase tracking-widest px-1">
              Intelligence &amp; Labs
            </div>
            <div className="grid grid-cols-3 gap-1 px-0.5">
              {onOpenAi && (
                <button
                  onClick={onOpenAi}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-[#8B7CFF]/10 hover:bg-[#8B7CFF]/20 text-[#8B7CFF] border border-[#8B7CFF]/25 transition-all cursor-pointer"
                  title="AI Document Assistant"
                >
                  <Sparkles className="w-3.5 h-3.5 mb-0.5 text-[#8B7CFF]" />
                  <span className="text-[9px] font-bold">AI Help</span>
                </button>
              )}
              {onOpenDiff && (
                <button
                  onClick={onOpenDiff}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 transition-all cursor-pointer"
                  title="Document Comparison (Diff)"
                >
                  <GitCompare className="w-3.5 h-3.5 mb-0.5 text-indigo-400" />
                  <span className="text-[9px] font-bold">Compare</span>
                </button>
              )}
              {onOpenBatch && (
                <button
                  onClick={onOpenBatch}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-[#42D6E8]/10 hover:bg-[#42D6E8]/20 text-[#42D6E8] border border-[#42D6E8]/25 transition-all cursor-pointer"
                  title="Batch Convert & ZIP"
                >
                  <Layers className="w-3.5 h-3.5 mb-0.5 text-[#42D6E8]" />
                  <span className="text-[9px] font-bold">Batch ZIP</span>
                </button>
              )}
              {onOpenForensics && (
                <button
                  onClick={onOpenForensics}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/25 transition-all cursor-pointer"
                  title="Document Forensics & Threat Lab"
                >
                  <Binary className="w-3.5 h-3.5 mb-0.5 text-amber-400" />
                  <span className="text-[9px] font-bold">Forensics</span>
                </button>
              )}
              {onOpenLineage && (
                <button
                  onClick={onOpenLineage}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-teal-400/10 hover:bg-teal-400/20 text-teal-300 border border-teal-400/25 transition-all cursor-pointer"
                  title="Document Data Lineage"
                >
                  <GitCommit className="w-3.5 h-3.5 mb-0.5 text-teal-400" />
                  <span className="text-[9px] font-bold">Lineage</span>
                </button>
              )}
              {onOpenReceipts && (
                <button
                  onClick={onOpenReceipts}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-purple-400/10 hover:bg-purple-400/20 text-purple-300 border border-purple-400/25 transition-all cursor-pointer"
                  title="Transformation Receipts & Certs"
                >
                  <Boxes className="w-3.5 h-3.5 mb-0.5 text-purple-400" />
                  <span className="text-[9px] font-bold">Receipts</span>
                </button>
              )}
              {onOpenPrivacy && (
                <button
                  onClick={onOpenPrivacy}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-rose-400/10 hover:bg-rose-400/20 text-rose-300 border border-rose-400/25 transition-all cursor-pointer"
                  title="Privacy Guardian & Verified Redaction"
                >
                  <ShieldAlert className="w-3.5 h-3.5 mb-0.5 text-rose-400" />
                  <span className="text-[9px] font-bold">Privacy</span>
                </button>
              )}
              {onOpenWhatIf && (
                <button
                  onClick={onOpenWhatIf}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-sky-400/10 hover:bg-sky-400/20 text-sky-300 border border-sky-400/25 transition-all cursor-pointer"
                  title="Document What-If Simulator"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 mb-0.5 text-sky-400" />
                  <span className="text-[9px] font-bold">What-If</span>
                </button>
              )}
              {onOpenCollab && (
                <button
                  onClick={onOpenCollab}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-emerald-400/10 hover:bg-emerald-400/20 text-emerald-300 border border-emerald-400/25 transition-all cursor-pointer"
                  title="Team Workspace & Review Comments"
                >
                  <Users className="w-3.5 h-3.5 mb-0.5 text-emerald-400" />
                  <span className="text-[9px] font-bold">Teams</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Bottom Profile & User Panel Trigger */}
        <div className="pt-2 space-y-2 border-t border-white/10 shrink-0">
          <div
            onClick={onOpenUserPanel || (() => handleSelectTab('settings'))}
            className={`p-2 rounded-2xl glass-card hover:border-[#8B7CFF]/40 flex items-center justify-between cursor-pointer transition-all ${isCollapsed ? 'justify-center p-1.5' : ''
              }`}
            title="Open User & Billing Panel"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={userName}
                    className="w-7 h-7 rounded-full object-cover ring-1 ring-[#8B7CFF]/40"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#8B7CFF] to-[#42D6E8] flex items-center justify-center text-[#080B18] font-black text-xs ring-1 ring-white/20">
                    {userInitial}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-[#080B18]" />
              </div>
              {!isCollapsed && (
                <div className="text-left min-w-0">
                  <div className="text-xs font-bold text-[#F4F5FF] leading-tight truncate">{userName}</div>
                  <div className="text-[10px] text-[#42D6E8] font-semibold leading-tight flex items-center gap-1 mt-0.5">
                    <Zap className="w-2.5 h-2.5 text-amber-400" />
                    <span>Pro Workspace</span>
                  </div>
                </div>
              )}
            </div>
            {!isCollapsed && <ChevronDown className="w-3.5 h-3.5 text-[#9BA3BD] shrink-0 ml-1" />}
          </div>

          {/* Quick Help & Logout Toolbar */}
          {!isCollapsed && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenHelp}
                className="flex-1 py-1.5 px-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#9BA3BD] hover:text-[#F4F5FF] text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-white/5"
                title="Keyboard Shortcuts & Guide"
              >
                <HelpCircle className="w-3.5 h-3.5 text-[#42D6E8]" />
                <span>Guide (?)</span>
              </button>
              <button
                onClick={onLogout}
                className="py-1.5 px-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer border border-rose-500/20"
                title="Log Out & Switch Account"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
