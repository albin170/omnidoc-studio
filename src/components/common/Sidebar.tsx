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
  ShieldAlert,
  X,
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
  ChevronLeft,
  ChevronRight,
  HardDrive,
  MessageSquare,
  Megaphone,
  Crown,
  ArrowRight,
  Headphones
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
  userName = 'John Doe',
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
  disabledModules = [],
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    {
      id: 'dashboard',
      tab: 'dashboard' as WorkspaceTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'projects',
      tab: 'projects' as WorkspaceTab,
      label: 'My Documents',
      icon: FolderArchive,
      badge: projectCount > 0 ? `${projectCount}` : null,
    },
    {
      id: 'converter',
      tab: 'converter' as WorkspaceTab,
      label: 'Conversion Studio',
      icon: RefreshCw,
      badge: conversionCount > 0 ? `${conversionCount}` : null,
    },
    {
      id: 'pdf',
      tab: 'pdf' as WorkspaceTab,
      label: 'PDF Studio',
      icon: FileText,
    },
    {
      id: 'sheets',
      tab: 'sheets' as WorkspaceTab,
      label: 'Excel Sheets',
      icon: Table,
    },
    {
      id: 'docx',
      tab: 'docx' as WorkspaceTab,
      label: 'Word Studio',
      icon: PenTool,
    },
    {
      id: 'slides',
      tab: 'slides' as WorkspaceTab,
      label: 'PowerPoint Studio',
      icon: Presentation,
    },
    {
      id: 'image',
      tab: 'image' as WorkspaceTab,
      label: 'Image Studio',
      icon: ImageIcon,
    },
    {
      id: 'ocr',
      tab: 'ocr' as WorkspaceTab,
      label: 'OCR & Extract',
      icon: ScanText,
    },
    {
      id: 'storage',
      tab: 'projects' as WorkspaceTab,
      label: 'Storage',
      icon: HardDrive,
    },
    {
      id: 'messages',
      tab: 'settings' as WorkspaceTab,
      label: 'Messages',
      icon: MessageSquare,
      badge: '3',
      badgeColor: 'pink',
      customAction: onOpenUserPanel,
    },
    {
      id: 'announcements',
      tab: 'settings' as WorkspaceTab,
      label: 'Announcements',
      icon: Megaphone,
      badge: '1',
      badgeColor: 'cyan',
      customAction: onOpenUserPanel,
    },
    {
      id: 'settings',
      tab: 'settings' as WorkspaceTab,
      label: 'Settings',
      icon: Settings,
    },
    {
      id: 'support',
      tab: 'dashboard' as WorkspaceTab,
      label: 'Support',
      icon: Headphones,
      customAction: onOpenHelp,
    },
    {
      id: 'admin',
      tab: 'admin' as WorkspaceTab,
      label: 'Admin Console',
      icon: ShieldAlert,
      badge: (userRole === 'admin' || userRole === 'superadmin') ? 'ACTIVE' : 'GOV',
      badgeColor: 'pink',
    },
  ];

  const handleSelectNav = (item: typeof navItems[0]) => {
    if (item.customAction) {
      item.customAction();
    } else {
      setActiveTab(item.tab);
    }
    if (onCloseMobile) onCloseMobile();
  };

  const visibleNavItems = navItems.filter((item) => {
    if (!disabledModules || disabledModules.length === 0) return true;
    if (item.tab === 'dashboard' || item.tab === 'settings' || item.tab === 'admin') return true;
    return !disabledModules.includes(item.tab);
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md md:hidden"
        />
      )}

      {/* Floating Liquid Glass Sidebar */}
      <aside
        className={`h-full flex flex-col shrink-0 p-3 select-none transition-all duration-300 z-50 overflow-hidden bg-[#071329]/75 backdrop-blur-2xl border-r border-white/10 ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${
          isMobileOpen
            ? 'fixed inset-y-0 left-0 shadow-2xl translate-x-0 w-72 bg-[#071329]/95'
            : 'hidden md:flex'
        }`}
      >
        {/* Brand Header */}
        <div className="shrink-0 pb-3 mb-2 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-2.5 cursor-pointer min-w-0"
              onClick={() => setActiveTab('dashboard')}
              title="OmniDoc Studio"
            >
              <OmniDocLogo size={isCollapsed ? 32 : 36} />
              {!isCollapsed && (
                <div className="flex flex-col text-left leading-tight min-w-0">
                  <span className="font-black text-sm text-[#F8FAFC] tracking-tight font-display truncate">
                    OmniDoc Studio
                  </span>
                  <span className="text-[10px] text-[#A7B5CC] font-medium tracking-wide">
                    Create • Convert • Organize
                  </span>
                </div>
              )}
            </div>

            {/* Collapse toggle / mobile close */}
            {isMobileOpen ? (
              <button
                onClick={onCloseMobile}
                className="p-1 rounded-lg hover:bg-white/10 text-[#A7B5CC] hover:text-white md:hidden cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="hidden md:flex p-1 rounded-lg hover:bg-white/10 text-[#A7B5CC] hover:text-white transition-colors cursor-pointer"
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            )}
          </div>

          {/* Quick Search Trigger */}
          {onOpenCommandPalette && !isCollapsed && (
            <button
              onClick={onOpenCommandPalette}
              className="w-full mt-3 flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[#A7B5CC] hover:text-[#F8FAFC] text-xs transition-all cursor-pointer shadow-inner"
              title="Open Command Palette (Ctrl+K)"
            >
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span className="font-medium text-[11px]">Quick Search</span>
              </div>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 font-mono text-[9px] text-[#A7B5CC]">
                Ctrl+K
              </kbd>
            </button>
          )}
        </div>

        {/* Scrollable Navigation List */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <nav className="flex-1 min-h-0 space-y-1 overflow-y-auto pr-0.5 custom-scrollbar">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.tab && item.id !== 'storage' && item.id !== 'messages' && item.id !== 'announcements' && item.id !== 'support';

              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectNav(item)}
                  title={item.label}
                  className={`group w-full flex items-center rounded-xl text-xs transition-all cursor-pointer relative ${
                    isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  } ${
                    isActive
                      ? 'bg-gradient-to-r from-[#FF3366] to-[#E11D48] text-white font-bold shadow-[0_4px_20px_rgba(255,51,102,0.45)] border border-white/25'
                      : 'text-[#A7B5CC] hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-white' : 'text-[#A7B5CC] group-hover:text-white'
                      }`}
                    />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isCollapsed && item.badge && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold leading-none ${
                        item.badgeColor === 'cyan'
                          ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40'
                          : 'bg-[#FF3366] text-white shadow-sm'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Intelligence Quick Labs */}
        {!isCollapsed && (
          <div className="pt-2 pb-1 space-y-1.5 border-t border-white/10 shrink-0">
            <div className="text-[9px] font-extrabold text-[#73869A] uppercase tracking-widest px-1 font-display">
              Intelligence &amp; Labs
            </div>
            <div className="grid grid-cols-3 gap-1 px-0.5">
              {onOpenAi && (
                <button
                  onClick={onOpenAi}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-[#38BDF8]/10 hover:bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/25 transition-all cursor-pointer"
                  title="AI Document Assistant"
                >
                  <Sparkles className="w-3.5 h-3.5 mb-0.5" />
                  <span className="text-[9px] font-bold">AI Help</span>
                </button>
              )}
              {onOpenDiff && (
                <button
                  onClick={onOpenDiff}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-[#FF3366]/10 hover:bg-[#FF3366]/20 text-[#FF3366] border border-[#FF3366]/25 transition-all cursor-pointer"
                  title="Compare Revisions"
                >
                  <GitCompare className="w-3.5 h-3.5 mb-0.5" />
                  <span className="text-[9px] font-bold">Compare</span>
                </button>
              )}
              {onOpenBatch && (
                <button
                  onClick={onOpenBatch}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-[#38BDF8]/10 hover:bg-[#38BDF8]/20 text-[#7DD3FC] border border-[#38BDF8]/25 transition-all cursor-pointer"
                  title="Batch Convert & ZIP"
                >
                  <Layers className="w-3.5 h-3.5 mb-0.5" />
                  <span className="text-[9px] font-bold">Batch ZIP</span>
                </button>
              )}
              {onOpenForensics && (
                <button
                  onClick={onOpenForensics}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-[#FF3366]/10 hover:bg-[#FF3366]/20 text-[#FF6688] border border-[#FF3366]/25 transition-all cursor-pointer"
                  title="Document Forensics"
                >
                  <Binary className="w-3.5 h-3.5 mb-0.5" />
                  <span className="text-[9px] font-bold">Forensics</span>
                </button>
              )}
              {onOpenLineage && (
                <button
                  onClick={onOpenLineage}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-[#38BDF8]/10 hover:bg-[#38BDF8]/20 text-[#7DD3FC] border border-[#38BDF8]/25 transition-all cursor-pointer"
                  title="Data Lineage"
                >
                  <GitCommit className="w-3.5 h-3.5 mb-0.5" />
                  <span className="text-[9px] font-bold">Lineage</span>
                </button>
              )}
              {onOpenReceipts && (
                <button
                  onClick={onOpenReceipts}
                  className="flex flex-col items-center justify-center p-1.5 rounded-xl bg-white/[0.05] hover:bg-white/10 text-white border border-white/15 transition-all cursor-pointer"
                  title="Receipts & Integrity"
                >
                  <Boxes className="w-3.5 h-3.5 mb-0.5 text-[#FF3366]" />
                  <span className="text-[9px] font-bold">Receipts</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Upgrade to Pro Card */}
        {!isCollapsed ? (
          <div className="mt-auto pt-3 shrink-0">
            <div className="relative p-3.5 rounded-2xl bg-gradient-to-b from-[#101b38]/80 to-[#071329]/90 border border-white/15 overflow-hidden shadow-xl">
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-[#FF3366]/20 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500/20 to-[#FF3366]/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-sm">
                  <Crown className="w-4 h-4 fill-amber-400/80" />
                </div>
                <span className="text-xs font-bold text-white font-display">Upgrade to Pro</span>
              </div>
              <p className="text-[11px] text-[#A7B5CC] leading-relaxed mb-3">
                Unlock more features and increase your limits.
              </p>
              <button
                onClick={() => setActiveTab('pricing')}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#FF3366] to-[#E11D48] hover:from-[#FF4D79] hover:to-[#FF3366] text-white text-xs font-bold shadow-[0_4px_16px_rgba(255,51,102,0.4)] transition-all cursor-pointer flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>View Plans</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setActiveTab('pricing')}
            className="w-10 h-10 mx-auto mt-auto mb-2 rounded-xl bg-gradient-to-tr from-[#FF3366] to-amber-500 flex items-center justify-center text-white shadow-lg shadow-[#FF3366]/30 cursor-pointer"
            title="Upgrade to Pro"
          >
            <Crown className="w-5 h-5 fill-amber-300" />
          </button>
        )}
      </aside>
    </>
  );
};
