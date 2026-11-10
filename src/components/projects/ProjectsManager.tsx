import React, { useState } from 'react';
import { 
  FolderArchive, 
  Clock, 
  Trash2, 
  Download, 
  ArrowRight, 
  ShieldCheck, 
  HardDrive, 
  FileText, 
  PenTool, 
  Presentation, 
  Table, 
  Image as ImageIcon, 
  AlertTriangle,
  RefreshCw,
  FileCode
} from 'lucide-react';
import { ConversionHistoryItem, StoredProject, WorkspaceTab } from '../../types';
import { formatFileSize } from '../../services/formatDetector';
import { clearConversionHistory, purgeAllLocalData } from '../../services/storageService';

interface ProjectsManagerProps {
  projects: StoredProject[];
  history: ConversionHistoryItem[];
  onLoadProject: (project: StoredProject) => void;
  onDeleteProject: (id: string) => void;
  onRefreshData: () => void;
}

export const ProjectsManager: React.FC<ProjectsManagerProps> = ({
  projects,
  history,
  onLoadProject,
  onDeleteProject,
  onRefreshData,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'projects' | 'history' | 'privacy'>('projects');

  const getIconForType = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-4 h-4 text-red-400" />;
      case 'docx':
        return <PenTool className="w-4 h-4 text-blue-400" />;
      case 'slides':
        return <Presentation className="w-4 h-4 text-amber-400" />;
      case 'sheets':
        return <Table className="w-4 h-4 text-emerald-400" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-[#A8DEFA]" />;
      default:
        return <FileCode className="w-4 h-4 text-indigo-400" />;
    }
  };

  const handlePurgeAll = () => {
    if (confirm('Are you sure you want to delete all saved projects, conversion history, and local memory? This action is permanent.')) {
      purgeAllLocalData();
      onRefreshData();
    }
  };

  const handleExportBackup = () => {
    const backupData = {
      projects,
      history,
      exportedAt: new Date().toISOString(),
      app: 'OmniDoc Studio',
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omnidoc_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 text-[#F5FAFF] custom-scrollbar">
      {/* Top Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-white/12 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FolderArchive className="w-5 h-5 text-[#A8DEFA]" />
            <h1 className="text-xl md:text-2xl font-bold text-[#F5FAFF] tracking-tight">
              Projects, History &amp; Privacy
            </h1>
          </div>
          <p className="text-xs md:text-sm text-[#A7B8CA] mt-1">
            Manage your local projects, review past conversion tasks, and control device storage and data retention.
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center glass-card border-white/10 p-1 rounded-2xl text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('projects')}
            className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeSubTab === 'projects'
                ? 'glass-btn-primary shadow-md shadow-[#A8DEFA]/20 lg-glow-ice'
                : 'text-[#A7B8CA] hover:text-[#F5FAFF]'
            }`}
          >
            Saved Projects ({projects.length})
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeSubTab === 'history'
                ? 'glass-btn-primary shadow-md shadow-[#A8DEFA]/20 lg-glow-ice'
                : 'text-[#A7B8CA] hover:text-[#F5FAFF]'
            }`}
          >
            History ({history.length})
          </button>
          <button
            onClick={() => setActiveSubTab('privacy')}
            className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeSubTab === 'privacy'
                ? 'glass-btn-primary shadow-md shadow-[#A8DEFA]/20 lg-glow-ice'
                : 'text-[#A7B8CA] hover:text-[#F5FAFF]'
            }`}
          >
            Privacy &amp; Data
          </button>
        </div>
      </div>

      {/* 1. Projects View */}
      {activeSubTab === 'projects' && (
        <div className="space-y-4">
          {projects.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-white/15 rounded-3xl p-6 glass-panel">
              <FolderArchive className="w-10 h-10 mx-auto text-[#A7B8CA]/50 mb-3" />
              <h3 className="text-base font-semibold text-[#F5FAFF]">No Saved Projects Yet</h3>
              <p className="text-xs text-[#A7B8CA] max-w-sm mx-auto mt-1">
                When you click "Save" in any workspace (PDF, Word, Slides, Sheets, Image), your progress is saved locally here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  className="p-5 rounded-2xl glass-card border-white/10 hover:border-[#A8DEFA]/50 transition-all flex flex-col justify-between group shadow-lg"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
                        {getIconForType(proj.type)}
                      </div>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-white/[0.08] text-[#A7B8CA]">
                        {proj.type}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-[#F5FAFF] group-hover:text-[#A8DEFA] transition-colors truncate">
                        {proj.title}
                      </h4>
                      <p className="text-[11px] text-[#A7B8CA] mt-1">
                        Updated: {new Date(proj.updatedAt).toLocaleDateString()} • {formatFileSize(proj.sizeBytes)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 mt-3 border-t border-white/10">
                    <button
                      onClick={() => onLoadProject(proj)}
                      className="flex items-center gap-1.5 text-xs text-[#A8DEFA] hover:text-[#A8DEFA] font-semibold cursor-pointer transition-colors"
                    >
                      <span>Open Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onDeleteProject(proj.id)}
                      className="p-1.5 rounded-lg text-[#A7B8CA] hover:text-rose-400 hover:bg-white/10 cursor-pointer transition-colors"
                      title="Delete Project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. History View */}
      {activeSubTab === 'history' && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-2xl p-6 bg-slate-900/20">
              <Clock className="w-10 h-10 mx-auto text-slate-600 mb-3" />
              <h3 className="text-base font-semibold text-slate-300">No Conversions Recorded</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Completed file conversions will be logged here for convenient review.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/40">
              <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Recent Tasks</span>
                <button
                  onClick={() => {
                    clearConversionHistory();
                    onRefreshData();
                  }}
                  className="text-xs text-slate-500 hover:text-red-400 cursor-pointer"
                >
                  Clear History
                </button>
              </div>

              <div className="divide-y divide-slate-800/80">
                {history.map((item) => (
                  <div key={item.id} className="p-3.5 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-200">{item.sourceName}</div>
                      <div className="text-[11px] text-slate-500">
                        {item.sourceFormat.toUpperCase()} → {item.targetFormat.toUpperCase()} • {formatFileSize(item.sizeBytes)} • {new Date(item.completedAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Success
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Privacy & Storage Management */}
      {activeSubTab === 'privacy' && (
        <div className="space-y-6 max-w-3xl">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-white font-bold text-base">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Offline &amp; Privacy-First Architecture</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              OmniDoc Studio is designed so that document parsing, OCR text recognition, image modification, and file format conversions happen locally in your browser memory using client-side WebAssembly, Canvas, and JavaScript libraries.
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
              <li>No document contents or images are uploaded to external tracking servers.</li>
              <li>Saved projects reside in your browser's private LocalStorage / IndexedDB storage.</li>
              <li>You can purge all stored memory and project records at any moment.</li>
            </ul>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-indigo-400" />
              <span>Data Export &amp; Backup</span>
            </h3>
            <p className="text-xs text-slate-400">
              Export your saved projects and history as a JSON backup bundle to import later or transfer to another device.
            </p>
            <button
              onClick={handleExportBackup}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              <span>Export Local Backup (.json)</span>
            </button>
          </div>

          <div className="p-6 rounded-2xl bg-red-950/20 border border-red-900/40 space-y-4">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>Danger Zone: Purge All Local Memory</span>
            </div>
            <p className="text-xs text-slate-400">
              Permanently erase all stored projects, cached conversions, and browser settings from this device.
            </p>
            <button
              onClick={handlePurgeAll}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer shadow-md shadow-red-600/30"
            >
              <Trash2 className="w-4 h-4" />
              <span>Purge All Local Data</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
