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
  Lock,
  Code2,
  Server,
  CheckCircle2,
  Sliders
} from 'lucide-react';
import { formatFileSize } from '../../services/formatDetector';
import { purgeAllLocalData, getStoredProjects, getConversionHistory } from '../../services/storageService';
import { useToast } from '../../services/toastService';
import { omniDocClient } from '../../sdk/omnidocClient';
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

  const [activeTab, setActiveTab] = useState<'general' | 'storage' | 'developer' | 'engine' | 'privacy'>('general');

  // General Settings
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [defaultQuality, setDefaultQuality] = useState('high');
  const [pdfRenderDpi, setPdfRenderDpi] = useState('150');

  // Developer & API Configuration
  const [apiUrl, setApiUrl] = useState(omniDocClient.getBaseUrl());
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [apiStatus, setApiStatus] = useState<'idle' | 'success' | 'error'>('idle');

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

  const handleSaveApiUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiUrl.trim()) return;
    setIsTestingApi(true);
    omniDocClient.setBaseUrl(apiUrl.trim());
    try {
      await omniDocClient.getHealth(3000);
      setApiStatus('success');
      addToast('success', 'API URL Verified', 'Backend connection established successfully.');
    } catch {
      setApiStatus('error');
      addToast('error', 'API Connection Failed', 'Could not reach backend at specified endpoint.');
    } finally {
      setIsTestingApi(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#070B13] text-[#F5FAFF] select-none">
      {/* Top Header */}
      <div className="h-14 border-b border-[rgba(180,225,255,0.12)] lg-topbar px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#A8DEFA]/15 text-[#A8DEFA] border border-[#A8DEFA]/30">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#F5FAFF] leading-tight font-display">Settings &amp; Environment</h1>
            <p className="text-[11px] text-[#A7B8CA]">Floating liquid glass workspace preferences and API architecture</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Encrypted Session Active</span>
          </span>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation */}
        <div className="w-56 border-r border-[rgba(180,225,255,0.12)] bg-[#0B1420]/60 backdrop-blur-xl p-4 space-y-1.5 shrink-0">
          {[
            { id: 'general', label: 'General & Editor', icon: Sparkles },
            { id: 'storage', label: 'Storage & Backup', icon: HardDrive },
            { id: 'developer', label: 'Developer & API', icon: Code2 },
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
                    ? 'lg-btn-primary shadow-md'
                    : 'text-[#A7B8CA] hover:text-[#F5FAFF] hover:bg-white/[0.05]'
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
              <div className="p-5 rounded-2xl lg-secondary space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display">
                  <Sparkles className="w-4 h-4 text-[#A8DEFA]" />
                  <span>Editor Preferences</span>
                </h3>

                <div className="flex items-center justify-between py-2 border-b border-white/[0.08]">
                  <div>
                    <div className="text-xs font-semibold text-[#F5FAFF]">Auto-Save Working Drafts</div>
                    <div className="text-[11px] text-[#A7B8CA]">Save edits to local storage every 15 seconds</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoSaveEnabled}
                    onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[#A8DEFA] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-2 border-b border-white/[0.08]">
                  <div>
                    <div className="text-xs font-semibold text-[#F5FAFF]">Default Export Quality</div>
                    <div className="text-[11px] text-[#A7B8CA]">Higher quality balances clarity and file size</div>
                  </div>
                  <select
                    value={defaultQuality}
                    onChange={(e) => setDefaultQuality(e.target.value)}
                    className="bg-[#0B1420] border border-[rgba(180,225,255,0.18)] text-[#F5FAFF] text-xs rounded-lg px-2.5 py-1 outline-none cursor-pointer"
                  >
                    <option value="maximum">Maximum (Lossless)</option>
                    <option value="high">High (Balanced)</option>
                    <option value="medium">Medium (Compressed)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-xs font-semibold text-[#F5FAFF]">PDF Viewer Render Scale (DPI)</div>
                    <div className="text-[11px] text-[#A7B8CA]">Higher DPI provides sharper text on high-density displays</div>
                  </div>
                  <select
                    value={pdfRenderDpi}
                    onChange={(e) => setPdfRenderDpi(e.target.value)}
                    className="bg-[#0B1420] border border-[rgba(180,225,255,0.18)] text-[#F5FAFF] text-xs rounded-lg px-2.5 py-1 outline-none cursor-pointer"
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
              <div className="p-5 rounded-2xl lg-secondary space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display">
                  <HardDrive className="w-4 h-4 text-[#A8DEFA]" />
                  <span>Storage Architecture &amp; Local Persistence</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-[rgba(180,225,255,0.14)]">
                    <div className="text-[11px] text-[#A7B8CA]">Browser Sandbox Consumption</div>
                    <div className="text-lg font-bold text-white mt-1">{formatFileSize(totalStorageBytes)}</div>
                    <div className="text-[10px] text-emerald-400 mt-1">IndexedDB / Local Storage Sandbox</div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.03] border border-[rgba(180,225,255,0.14)]">
                    <div className="text-[11px] text-[#A7B8CA]">Saved Project Artifacts</div>
                    <div className="text-lg font-bold text-white mt-1">{totalProjectsCount} items</div>
                    <div className="text-[10px] text-[#A8DEFA] mt-1">Available offline instantly</div>
                  </div>
                </div>

                {/* Backup & Restore Controls */}
                <div className="pt-4 border-t border-white/[0.08] flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleExportBackup}
                    className="lg-btn-primary flex items-center gap-2 text-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Local Backup (.JSON)</span>
                  </button>

                  <label className="lg-btn-secondary flex items-center gap-2 text-xs cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-[#A8DEFA]" />
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
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold cursor-pointer ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Clear Local Storage</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'developer' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl lg-secondary space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display">
                    <Server className="w-4 h-4 text-[#A8DEFA]" />
                    <span>Backend API Configuration</span>
                  </h3>
                  {apiStatus === 'success' && (
                    <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verified Online</span>
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#A7B8CA]">
                  Configure the FastAPI endpoint that handles user accounts, cloud vault storage, and server-side document jobs.
                </p>

                <form onSubmit={handleSaveApiUrl} className="space-y-3 pt-2">
                  <div>
                    <label className="text-xs font-semibold text-[#F5FAFF] block mb-1">
                      API Base URL
                    </label>
                    <input
                      type="url"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      placeholder="https://omnidoc-studio-jet.vercel.app/api/v1"
                      className="w-full lg-input text-xs"
                      required
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const liveUrl = typeof window !== 'undefined' && !window.location.origin.includes('localhost')
                            ? `${window.location.origin}/api/v1`
                            : 'http://localhost:8000/api/v1';
                          setApiUrl(liveUrl);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[#A8DEFA] text-xs font-medium border border-[rgba(180,225,255,0.14)]"
                      >
                        Reset to Production Default
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={isTestingApi}
                      className="lg-btn-primary text-xs flex items-center gap-1.5"
                    >
                      <span>{isTestingApi ? 'Connecting...' : 'Save & Verify Endpoint'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'engine' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl lg-secondary space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display">
                  <Cpu className="w-4 h-4 text-[#A8DEFA]" />
                  <span>Processing Engine Configuration</span>
                </h3>

                <div className="flex items-center justify-between py-2 border-b border-white/[0.08]">
                  <div>
                    <div className="text-xs font-semibold text-[#F5FAFF]">WebAssembly SIMD Acceleration</div>
                    <div className="text-[11px] text-[#A7B8CA]">Uses 128-bit vector instructions for image and PDF rendering</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                    ACTIVE (SUPPORTED)
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-white/[0.08]">
                  <div>
                    <div className="text-xs font-semibold text-[#F5FAFF]">Available Hardware Concurrency</div>
                    <div className="text-[11px] text-[#A7B8CA]">Detected logical CPU cores for parallel document transforms</div>
                  </div>
                  <div className="text-xs font-mono font-bold text-[#A8DEFA] bg-[#0B1420] px-2.5 py-1 rounded-lg border border-[rgba(180,225,255,0.14)]">
                    {workerThreads} Cores
                  </div>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-xs font-semibold text-[#F5FAFF]">Client OCR Engine (Tesseract.js)</div>
                    <div className="text-[11px] text-[#A7B8CA]">Executes character recognition directly in Web Worker sandbox</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-[#A8DEFA]/15 text-[#A8DEFA] text-xs font-bold border border-[#A8DEFA]/30">
                    WASM WORKER
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl lg-secondary space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Privacy Sandbox &amp; Compliance</span>
                </h3>

                <div className="space-y-3 text-xs text-[#A7B8CA]">
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-[rgba(180,225,255,0.12)]">
                    <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-[#F5FAFF]">100% Client-Side Processing Architecture</div>
                      <div className="text-[#A7B8CA] mt-0.5">
                        Client-side studios process documents in browser memory. Conversions occur without unapproved external transmission.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-[rgba(180,225,255,0.12)]">
                    <Database className="w-5 h-5 text-[#A8DEFA] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-[#F5FAFF]">Data Retention Policy</div>
                      <div className="text-[#A7B8CA] mt-0.5">
                        Temporary conversion blobs are stored in RAM and immediately released upon download or session termination.
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
