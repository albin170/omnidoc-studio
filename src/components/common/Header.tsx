import React from 'react';
import { 
  FileStack, 
  ShieldCheck, 
  FolderOpen, 
  Sparkles, 
  User, 
  Settings, 
  HelpCircle,
  HardDrive
} from 'lucide-react';
import { WorkspaceTab } from '../../types';
import { UserSession } from '../../services/storageService';

interface HeaderProps {
  activeTab: WorkspaceTab;
  setActiveTab: (tab: WorkspaceTab) => void;
  userSession: UserSession;
  onOpenAuthModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenHelpModal: () => void;
  onNewFileClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  setActiveTab,
  userSession,
  onOpenAuthModal,
  onOpenSettingsModal,
  onOpenHelpModal,
  onNewFileClick,
}) => {
  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 px-4 md:px-6 flex items-center justify-between">
      {/* Brand logo & tagline */}
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
          <FileStack className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-white tracking-tight">OmniDoc</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-semibold border border-indigo-500/30">STUDIO</span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">Every file. Every format. One workspace.</p>
        </div>
      </div>

      {/* Middle banner: Security & Local Privacy badge */}
      <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-medium">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>Privacy-First: Files processed securely in your browser</span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 md:gap-3">
        <button
          onClick={onNewFileClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs md:text-sm font-medium shadow-sm transition-colors cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">New Document</span>
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs md:text-sm font-medium border border-slate-700/60 transition-colors cursor-pointer"
        >
          <FolderOpen className="w-4 h-4 text-amber-400" />
          <span>Templates</span>
        </button>

        {/* User profile / Guest pill */}
        <button
          onClick={onOpenAuthModal}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 text-slate-300 text-xs transition-colors cursor-pointer"
          title="Account & Storage Settings"
        >
          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-xs font-bold">
            <User className="w-3.5 h-3.5" />
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-medium text-slate-200 leading-none">
              {userSession.isGuest ? 'Guest Session' : (userSession.userName || 'Account')}
            </span>
            <span className="text-[10px] text-slate-400 leading-none mt-0.5 flex items-center gap-1">
              <HardDrive className="w-2.5 h-2.5" /> Local IDB
            </span>
          </div>
        </button>

        {/* Settings & Help */}
        <button
          onClick={onOpenSettingsModal}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenHelpModal}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          title="Documentation & Shortcuts"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
