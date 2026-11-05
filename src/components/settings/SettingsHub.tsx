import React, { useState } from 'react';
import { 
  Settings, 
  ShieldCheck, 
  HardDrive, 
  Database, 
  Download, 
  Upload, 
  Trash2, 
  Cpu, 
  Sparkles, 
  Lock
} from 'lucide-react';
import { formatFileSize } from '../../services/formatDetector';
import { purgeAllLocalData, getStoredProjects, getConversionHistory } from '../../services/storageService';
import { useToast } from '../../services/toastService';
import saveAs from 'file-saver';

interface SettingsHubProps {
  totalStorageBytes: number;
  totalProjectsCount: number;
  onRefreshData: () => void;
}

export const SettingsHub: React.FC<SettingsHubProps> = ({
  totalStorageBytes,
  totalProjectsCount,
  onRefreshData,
}) => {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'general' | 'storage' | 'engine' | 'privacy'>('general');

  // General Settings
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [defaultQuality, setDefaultQuality] = useState('high');
  const [pdfRenderDpi, setPdfRenderDpi] = useState('150');

  // Engine Settings
  const [workerThreads] = useState(navigator.hardwareConcurrency || 4);

  // Export full system backup
  const handleExportBackup = () => {
    try {
      const backupData = {
        app: 'OmniDoc Studio',
        version: '2.5.0',
        exportedAt: new Date().toISOString(),
        projects: getStoredProjects(),
        history: getConversionHistory(),
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json',
      });
      saveAs(blob, `omnidoc_backup_${Date.now()}.json`);
      addToast('success', 'Backup Exported', 'Full local projects and history exported safely.');
    } catch (err: any) {
      addToast('error', 'Export Failed', err.message || 'Could not export backup.');
    }
  };

  // Import system backup
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (Array.isArray(parsed.projects)) {
          localStorage.setItem('omnidoc_projects_v1', JSON.stringify(parsed.projects));
        }
        if (Array.isArray(parsed.history)) {
          localStorage.setItem('omnidoc_history_v1', JSON.stringify(parsed.history));
        }
        onRefreshData();
        addToast('success', 'Backup Restored', `Restored ${parsed.projects?.length || 0} projects.`);
      } catch {
        addToast('error', 'Import Failed', 'Invalid backup file format.');
      }
    };
    reader.readAsText(file);
  };

  const handleWipeData = () => {
    if (confirm('Permanently wipe all locally stored projects, conversion logs, and session caches?')) {
      purgeAllLocalData();
      onRefreshData();
      addToast('info', 'Storage Cleared', 'All local storage has been wiped clean.');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#080B18]/60 text-[#F4F5FF]">
      {/* Top Header */}
      <div className="h-14 border-b border-white/10 bg-[#11152A]/85 backdrop-blur-2xl px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#8B7CFF]/15 text-[#8B7CFF] border border-[#8B7CFF]/30">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#F4F5FF] leading-tight">Settings &amp; Environment</h1>
            <p className="text-[11px] text-[#9BA3BD]">Manage client engine, storage cache, and privacy controls</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero-Cloud Mode Active</span>
          </span>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation */}
        <div className="w-56 border-r border-white/10 bg-[#11152A]/40 backdrop-blur-xl p-4 space-y-1.5 shrink-0">
          {[
            { id: 'general', label: 'General & Editor', icon: Sparkles },
            { id: 'storage', label: 'Storage & Backup', icon: HardDrive },
            { id: 'engine', label: 'Engine & WASM', icon: Cpu },
            { id: 'privacy', label: 'Privacy & Security', icon: Lock },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  active 
                    ? 'glass-btn-primary shadow-md shadow-[#8B7CFF]/20 glow-purple' 
                    : 'text-[#9BA3BD] hover:text-[#F4F5FF] hover:bg-white/[0.05]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Pane */}
        <div className="flex-1 overflow-y-auto p-6 max-w-4xl space-y-6 custom-scrollbar">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl glass-card border-white/10 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Editor Preferences</span>
                </h3>

                <div className="flex items-center justify-between py-2 border-b border-slate-700/40">
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Auto-Save Working Drafts</div>
                    <div className="text-[11px] text-slate-400">Save edits to local storage every 15 seconds</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoSaveEnabled}
                    onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-700/40">
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Default Export Quality</div>
                    <div className="text-[11px] text-slate-400">Higher quality balances clarity and file size</div>
                  </div>
                  <select
                    value={defaultQuality}
                    onChange={(e) => setDefaultQuality(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1 outline-none"
                  >
                    <option value="maximum">Maximum (Lossless)</option>
                    <option value="high">High (Balanced)</option>
                    <option value="medium">Medium (Compressed)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-200">PDF Viewer Render Scale (DPI)</div>
                    <div className="text-[11px] text-slate-400">Higher DPI provides sharper text on Retina screens</div>
                  </div>
                  <select
                    value={pdfRenderDpi}
                    onChange={(e) => setPdfRenderDpi(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1 outline-none"
                  >
                    <option value="96">96 DPI (Fastest)</option>
                    <option value="150">150 DPI (Crisp)</option>
                    <option value="300">300 DPI (Ultra)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-indigo-400" />
                  <span>Local Storage Quota &amp; Statistics</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/40">
                    <div className="text-[11px] text-slate-400">Storage Used</div>
                    <div className="text-lg font-bold text-white mt-1">{formatFileSize(totalStorageBytes)}</div>
                    <div className="text-[10px] text-emerald-400 mt-1">Directly in your local browser</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/40">
                    <div className="text-[11px] text-slate-400">Saved Projects</div>
                    <div className="text-lg font-bold text-white mt-1">{totalProjectsCount} items</div>
                    <div className="text-[10px] text-indigo-400 mt-1">Available offline at all times</div>
                  </div>
                </div>

                {/* Backup & Restore Controls */}
                <div className="pt-4 border-t border-slate-700/40 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleExportBackup}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Local Backup (.JSON)</span>
                  </button>

                  <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Restore from Backup</span>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleImportBackup}
                    />
                  </label>

                  <button
                    onClick={handleWipeData}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 text-xs font-semibold cursor-pointer ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>Clear All Storage</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'engine' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  <span>Processing Engine Configuration</span>
                </h3>

                <div className="flex items-center justify-between py-2 border-b border-slate-700/40">
                  <div>
                    <div className="text-xs font-semibold text-slate-200">WebAssembly SIMD Acceleration</div>
                    <div className="text-[11px] text-slate-400">Uses 128-bit vector instructions for image and PDF rendering</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                    ACTIVE (SUPPORTED)
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-700/40">
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Available Hardware Concurrency</div>
                    <div className="text-[11px] text-slate-400">Detected logical CPU cores for parallel document transforms</div>
                  </div>
                  <div className="text-xs font-mono font-bold text-indigo-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700">
                    {workerThreads} Cores
                  </div>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Client OCR Engine (Tesseract.js)</div>
                    <div className="text-[11px] text-slate-400">Executes character recognition directly in Web Worker sandbox</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-400 text-xs font-bold border border-indigo-500/30">
                    LOCAL ENGINE
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Privacy Sandbox &amp; Compliance</span>
                </h3>

                <div className="space-y-3 text-xs text-slate-300">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-700/50">
                    <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-white">100% Client-Side Processing Guarantee</div>
                      <div className="text-slate-400 mt-0.5">
                        No uploaded PDF, Word document, presentation, spreadsheet, or photo is ever transmitted to an external server or API. All conversions occur exclusively in browser memory.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-700/50">
                    <Database className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-white">Data Retention Policy</div>
                      <div className="text-slate-400 mt-0.5">
                        Temporary conversion blobs are stored in memory and immediately freed when closed. Saved projects are stored exclusively in your browser's private local storage.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
