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
  ChevronRight,
  DollarSign
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
  disabledModules?: string[];
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
  disabledModules = [],
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
      tab: 'pricing' as WorkspaceTab,
      label: 'Plans & Pricing',
      icon: DollarSign,
    },
    {
      tab: 'settings' as WorkspaceTab,
      label: 'Settings & Privacy',
      icon: Settings,
    },
    ...(userRole === 'admin' || userRole === 'superadmin'
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

  const visibleNavItems = navItems.filter((item) => {
    if (!disabledModules || disabledModules.length === 0) return true;
    if (item.tab === 'dashboard' || item.tab === 'settings' || item.tab === 'admin') return true;
    return !disabledModules.includes(item.tab);
  });

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

      {/* Full-Height Floating Liquid Glass Sidebar */}
      <aside
        className={`lg-sidebar h-full flex flex-col shrink-0 p-3 select-none transition-all duration-300 z-50 overflow-hidden ${isCollapsed ? 'w-20' : 'w-64'
          } ${isMobileOpen
            ? 'fixed inset-y-0 left-0 shadow-2xl translate-x-0 w-72'
            : 'hidden md:flex'
          }`}
      >
        {/* Brand Header & Toggle */}
        <div className="shrink-0">
          <div className="pt-1 pb-3 px-1.5 flex items-center justify-between border-b border-[rgba(255, 255, 255,0.18)] mb-2">
            <div
              className="flex items-center gap-2.5 cursor-pointer min-w-0"
              onClick={() => handleSelectTab('dashboard')}
              title="OmniDoc Studio Home"
            >
              <div className="relative shrink-0">
                <OmniDocLogo size={isCollapsed ? 32 : 36} />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#FF3366] shadow-[0_0_6px_rgba(255,51,102,0.7)]" />
              </div>
              {!isCollapsed && (
                <div className="flex flex-col text-left min-w-0">
                  <div className="flex items-center gap-1.5 leading-tight">
                    <span className="font-extrabold text-sm text-[#F5FAFF] tracking-tight truncate font-display">
                      OmniDoc
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-gradient-to-r from-[#FF3366]/20 to-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30 font-mono font-bold">
                      PRO
                    </span>
                  </div>
                  <span className="text-[10px] text-[#A7B8CA] font-medium tracking-wide">
                    Liquid Glass Workspace
                  </span>
                </div>
              )}
            </div>

            {/* Desktop Collapse Toggle / Mobile Close Button */}
            {isMobileOpen ? (
              <button
                onClick={onCloseMobile}
                className="p-1 rounded-lg hover:bg-white/10 text-[#A7B8CA] hover:text-white md:hidden cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="hidden md:flex p-1 rounded-lg hover:bg-white/10 text-[#A7B8CA] hover:text-white transition-colors cursor-pointer"
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
              className={`w-full flex items-center mb-2 rounded-xl lg-input text-[#A7B8CA] hover:text-[#F5FAFF] hover:border-[#38BDF8]/40 text-xs transition-all cursor-pointer ${isCollapsed ? 'justify-center p-2' : 'justify-between px-3 py-2'
                }`}
              title="Open Command Palette (Ctrl+K)"
            >
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-[#38BDF8]" />
                {!isCollapsed && <span className="font-semibold text-[11px]">Quick Search</span>}
              </div>
              {!isCollapsed && (
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 font-mono text-[9px] text-[#A7B8CA]">
                  Ctrl+K
                </kbd>
              )}
            </button>
          )}
        </div>

        {/* Scrollable Navigation Area */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden mb-2">
          <div className="text-[9px] font-extrabold text-[#73869A] uppercase tracking-widest px-2 mb-1.5 font-display shrink-0">
            Navigation
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 min-h-0 space-y-1 overflow-y-auto pr-0.5 custom-scrollbar">
            {visibleNavItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = activeTab === item.tab;

              return (
                <button
                  key={`${item.label}-${idx}`}
                  onClick={() => handleSelectTab(item.tab)}
                  title={item.label}
                  className={`group w-full flex items-center rounded-xl text-xs font-medium transition-all cursor-pointer relative ${isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
                    } ${isActive
                      ? 'bg-gradient-to-r from-[#FF3366]/15 to-[#38BDF8]/15 border border-[#38BDF8]/40 text-[#F5FAFF] font-bold shadow-[0_0_15px_rgba(56,189,248,0.2)]'
                      : 'text-[#A7B8CA] hover:text-[#F5FAFF] hover:bg-white/[0.05] border border-transparent hover:border-white/10'
                    }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isActive && (
                      <span className="absolute left-1 w-1 h-3.5 bg-gradient-to-b from-[#FF3366] to-[#38BDF8] rounded-full shadow-[0_0_8px_rgba(255,51,102,0.6)]" />
                    )}
                    <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-[#38BDF8]' : 'text-[#A7B8CA] group-hover:text-[#FF3366]'
                      }`} />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {/* Collapsed mode tooltip */}
                  {isCollapsed && (
                    <span className="lg-micro absolute left-full ml-2 px-2 py-1 rounded-lg text-[10px] font-semibold text-[#F5FAFF] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                      {item.label}
                    </span>
                  )}

                  {!isCollapsed && item.badge && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#FF3366]/20 border border-[#FF3366]/30 text-[#F5FAFF] text-[9px] font-mono font-bold">
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
            <div className="text-[9px] font-extrabold text-[#73869A] uppercase tracking-widest px-1 font-display">
              Intelligence &amp; Labs
            </div>
            <div className="grid grid-cols-3 gap-1 px-0.5">
              {onOpenAi && (
                <button
                  onClick={onOpenAi}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-[#38BDF8]/12 hover:bg-[#38BDF8]/22 text-[#38BDF8] border border-[#38BDF8]/30 hover:border-[#38BDF8]/55 hover:shadow-[0_0_15px_rgba(56,189,248,0.25)] transition-all cursor-pointer"
                  title="AI Document Assistant"
                >
                  <Sparkles className="w-3.5 h-3.5 mb-0.5 text-[#38BDF8]" />
                  <span className="text-[9px] font-bold">AI Help</span>
                </button>
              )}
              {onOpenDiff && (
                <button
                  onClick={onOpenDiff}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-[#FF3366]/12 hover:bg-[#FF3366]/22 text-[#FF3366] border border-[#FF3366]/30 hover:border-[#FF3366]/55 hover:shadow-[0_0_15px_rgba(255,51,102,0.25)] transition-all cursor-pointer"
                  title="Document Comparison (Diff)"
                >
                  <GitCompare className="w-3.5 h-3.5 mb-0.5 text-[#FF3366]" />
                  <span className="text-[9px] font-bold">Compare</span>
                </button>
              )}
              {onOpenBatch && (
                <button
                  onClick={onOpenBatch}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-[#38BDF8]/10 hover:bg-[#38BDF8]/20 text-[#7DD3FC] border border-[#38BDF8]/25 hover:border-[#38BDF8]/50 hover:shadow-[0_0_15px_rgba(56,189,248,0.25)] transition-all cursor-pointer"
                  title="Batch Convert & ZIP"
                >
                  <Layers className="w-3.5 h-3.5 mb-0.5 text-[#38BDF8]" />
                  <span className="text-[9px] font-bold">Batch ZIP</span>
                </button>
              )}
              {onOpenForensics && (
                <button
                  onClick={onOpenForensics}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-[#FF3366]/12 hover:bg-[#FF3366]/22 text-[#FF6688] border border-[#FF3366]/30 hover:border-[#FF3366]/55 hover:shadow-[0_0_15px_rgba(255,51,102,0.25)] transition-all cursor-pointer"
                  title="Document Forensics & Threat Lab"
                >
                  <Binary className="w-3.5 h-3.5 mb-0.5 text-[#FF6688]" />
                  <span className="text-[9px] font-bold">Forensics</span>
                </button>
              )}
              {onOpenLineage && (
                <button
                  onClick={onOpenLineage}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-[#38BDF8]/12 hover:bg-[#38BDF8]/22 text-[#7DD3FC] border border-[#38BDF8]/30 hover:border-[#38BDF8]/55 hover:shadow-[0_0_15px_rgba(56,189,248,0.25)] transition-all cursor-pointer"
                  title="Document Data Lineage"
                >
                  <GitCommit className="w-3.5 h-3.5 mb-0.5 text-[#7DD3FC]" />
                  <span className="text-[9px] font-bold">Lineage</span>
                </button>
              )}
              {onOpenReceipts && (
                <button
                  onClick={onOpenReceipts}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-gradient-to-tr from-[#FF3366]/12 to-[#38BDF8]/12 hover:from-[#FF3366]/22 hover:to-[#38BDF8]/22 text-[#F5FAFF] border border-white/20 hover:border-white/40 hover:shadow-[0_0_15px_rgba(56,189,248,0.25)] transition-all cursor-pointer"
                  title="Transformation Receipts & Certs"
                >
                  <Boxes className="w-3.5 h-3.5 mb-0.5 text-[#FF3366]" />
                  <span className="text-[9px] font-bold">Receipts</span>
                </button>
              )}
              {onOpenPrivacy && (
                <button
                  onClick={onOpenPrivacy}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-[#FF3366]/14 hover:bg-[#FF3366]/25 text-[#FF3366] border border-[#FF3366]/35 hover:border-[#FF3366]/60 hover:shadow-[0_0_15px_rgba(255,51,102,0.3)] transition-all cursor-pointer"
                  title="Privacy Guardian & Verified Redaction"
                >
                  <ShieldAlert className="w-3.5 h-3.5 mb-0.5 text-[#FF3366]" />
                  <span className="text-[9px] font-bold">Privacy</span>
                </button>
              )}
              {onOpenWhatIf && (
                <button
                  onClick={onOpenWhatIf}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-[#38BDF8]/12 hover:bg-[#38BDF8]/22 text-[#38BDF8] border border-[#38BDF8]/30 hover:border-[#38BDF8]/55 hover:shadow-[0_0_15px_rgba(56,189,248,0.25)] transition-all cursor-pointer"
                  title="Document What-If Simulator"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 mb-0.5 text-[#38BDF8]" />
                  <span className="text-[9px] font-bold">What-If</span>
                </button>
              )}
              {onOpenCollab && (
                <button
                  onClick={onOpenCollab}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-gradient-to-tr from-[#FF3366]/10 to-[#38BDF8]/12 hover:from-[#FF3366]/20 hover:to-[#38BDF8]/22 text-[#7DD3FC] border border-white/18 hover:border-white/40 hover:shadow-[0_0_15px_rgba(255,51,102,0.2)] transition-all cursor-pointer"
                  title="Team Workspace & Review Comments"
                >
                  <Users className="w-3.5 h-3.5 mb-0.5 text-[#38BDF8]" />
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
            className={`p-2 rounded-[22px] lg-secondary hover:border-[#38BDF8]/40 flex items-center justify-between cursor-pointer transition-all ${isCollapsed ? 'justify-center p-1.5' : ''
              }`}
            title="Open User & Billing Panel"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={userName}
                    className="w-7 h-7 rounded-full object-cover ring-1 ring-[#38BDF8]/40"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#FF3366] via-[#E11D48] to-[#38BDF8] flex items-center justify-center text-white font-black text-xs ring-1 ring-white/20">
                    {userInitial}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-[#070B13]" />
              </div>
              {!isCollapsed && (
                <div className="text-left min-w-0">
                  <div className="text-xs font-bold text-[#F5FAFF] leading-tight truncate">{userName}</div>
                  <div className="text-[10px] text-[#38BDF8] font-semibold leading-tight flex items-center gap-1 mt-0.5">
                    <Zap className="w-2.5 h-2.5 text-[#FF3366]" />
                    <span>Pro Workspace</span>
                  </div>
                </div>
              )}
            </div>
            {!isCollapsed && <ChevronDown className="w-3.5 h-3.5 text-[#A7B8CA] shrink-0 ml-1" />}
          </div>

          {/* Quick Help & Logout Toolbar */}
          {!isCollapsed ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenHelp}
                className="flex-1 py-1.5 px-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#A7B8CA] hover:text-[#F5FAFF] text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-[rgba(255, 255, 255,0.12)]"
                title="Keyboard Shortcuts & Guide"
              >
                <HelpCircle className="w-3.5 h-3.5 text-[#38BDF8]" />
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
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={onLogout}
                className="w-8 h-8 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 flex items-center justify-center transition-colors cursor-pointer border border-rose-500/20"
                title="Log Out & Switch Account"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
