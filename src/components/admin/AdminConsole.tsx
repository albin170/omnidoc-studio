import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Activity, 
  Cpu, 
  UserCheck, 
  Download, 
  Zap,
  Terminal,
  AlertTriangle,
  Info
} from 'lucide-react';
import { UserRole, PlanTier, UserSession, getConversionHistory, getStoredProjects } from '../../services/storageService';
import { formatFileSize } from '../../services/formatDetector';
import { useToast } from '../../services/toastService';
import saveAs from 'file-saver';

const SESSION_START_DATE = new Date().toLocaleDateString();

interface AdminConsoleProps {
  userSession: UserSession;
  onUpdateSession: (newSession: UserSession) => void;
  totalStorageBytes: number;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({
  userSession,
  onUpdateSession,
  totalStorageBytes,
}) => {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'metrics' | 'engines' | 'users' | 'logs'>('metrics');
  const [debugLogging, setDebugLogging] = useState(false);
  const [maxBatchOverride, setMaxBatchOverride] = useState(50);
  const [allowSimd, setAllowSimd] = useState(true);
  const [devModeConfirmed, setDevModeConfirmed] = useState(false);

  const history = getConversionHistory();
  const projects = getStoredProjects();

  // Read real browser memory if exposed by browser
  const memoryInfo = (typeof performance !== 'undefined' && (performance as any).memory)
    ? formatFileSize((performance as any).memory.usedJSHeapSize)
    : 'Unavailable (not exposed by browser)';

  const handleRoleChange = (role: UserRole) => {
    if (!devModeConfirmed) {
      addToast('warning', 'Simulation Gated', 'Enable developer prototype simulation mode first.');
      return;
    }
    const updated: UserSession = { ...userSession, role };
    onUpdateSession(updated);
    addToast('info', 'Prototype Role Changed', `Simulated local role switched to ${role.toUpperCase()} (Client-only).`);
  };

  const handleTierChange = (tier: PlanTier) => {
    if (!devModeConfirmed) {
      addToast('warning', 'Simulation Gated', 'Enable developer prototype simulation mode first.');
      return;
    }
    const updated: UserSession = { ...userSession, planTier: tier };
    onUpdateSession(updated);
    addToast('info', 'Prototype Tier Changed', `Simulated entitlement tier switched to ${tier.toUpperCase()} (Client-only).`);
  };

  const handleExportAuditLogs = () => {
    const data = {
      notice: 'Client-side diagnostic report. Server telemetry is unavailable.',
      exportedAt: new Date().toISOString(),
      clientEnvironment: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        hardwareConcurrency: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 'Unknown',
        memoryUsage: memoryInfo,
      },
      localSession: {
        userEmail: userSession.userEmail || 'Local guest',
        simulatedRole: userSession.role || 'user',
        simulatedTier: userSession.planTier || 'free',
        isPrototype: true,
      },
      localStorageMetrics: {
        totalSavedProjects: projects.length,
        totalStorageBytes,
        historyRecordsCount: history.length,
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    saveAs(blob, `omnidoc_client_diagnostics_${Date.now()}.json`);
    addToast('info', 'Diagnostics Exported', 'Local diagnostics report downloaded.');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#080B18]/60 text-[#F4F5FF]">
      {/* Top Header */}
      <div className="h-14 border-b border-white/10 bg-[#11152A]/85 backdrop-blur-2xl px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-400/15 text-amber-400 border border-amber-400/30">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#F4F5FF] leading-tight">Developer &amp; Diagnostic Console</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-semibold border border-amber-400/30">
                LOCAL PROTOTYPE MODE
              </span>
            </div>
            <p className="text-[11px] text-[#9BA3BD]">Client-side execution telemetry, storage auditing, and developer flags</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportAuditLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card hover:border-[#8B7CFF]/50 text-[#F4F5FF] text-xs font-semibold cursor-pointer transition-all"
          >
            <Download className="w-3.5 h-3.5 text-[#8B7CFF]" />
            <span>Export Diagnostics (.JSON)</span>
          </button>
        </div>
      </div>

      {/* Prototype Disclaimer Banner */}
      <div className="glass-card border-b border-amber-400/30 px-6 py-2.5 flex items-center gap-2 text-xs text-amber-200/90">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          <strong>Architecture Notice:</strong> OmniDoc Studio is running as a client-side web application. Backend authentication and centralized production servers are not configured; metrics below reflect local browser memory and localStorage on this device only.
        </span>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Nav */}
        <div className="w-56 border-r border-white/10 bg-[#11152A]/40 backdrop-blur-xl p-4 space-y-1.5 shrink-0">
          {[
            { id: 'metrics', label: 'Local Diagnostics', icon: Activity },
            { id: 'engines', label: 'Client Engine Flags', icon: Cpu },
            { id: 'users', label: 'Prototype Role Testing', icon: UserCheck },
            { id: 'logs', label: 'Client Event Stream', icon: Terminal },
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

        {/* Content View */}
        <div className="flex-1 overflow-y-auto p-6 max-w-5xl space-y-6 custom-scrollbar">
          {activeTab === 'metrics' && (
            <div className="space-y-6">
              {/* Stat Cards with Real Measurements */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl glass-card border-white/10">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Browser JS Heap</div>
                  <div className="text-sm font-bold text-indigo-300 mt-1 truncate">{memoryInfo}</div>
                  <div className="text-[11px] text-slate-500 mt-1">performance.memory</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Local History Count</div>
                  <div className="text-xl font-extrabold text-white mt-1">{history.length}</div>
                  <div className="text-[11px] text-slate-400 mt-1">Records in localStorage</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Local Saved Projects</div>
                  <div className="text-xl font-extrabold text-white mt-1">{projects.length}</div>
                  <div className="text-[11px] text-slate-400 mt-1">In browser localStorage</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Storage Consumed</div>
                  <div className="text-xl font-extrabold text-white mt-1">{formatFileSize(totalStorageBytes)}</div>
                  <div className="text-[11px] text-amber-400 mt-1">localStorage estimate</div>
                </div>
              </div>

              {/* Subsystem Capabilities Table */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Client-Side Subsystem Verification</span>
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">Subsystem</th>
                        <th className="pb-3 font-semibold">Client Engine / Library</th>
                        <th className="pb-3 font-semibold">Runtime Environment</th>
                        <th className="pb-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      <tr>
                        <td className="py-2.5 font-bold text-white">PDF Manipulation &amp; Signatures</td>
                        <td className="py-2.5 text-slate-400 font-mono">pdf-lib / pdfjs-dist</td>
                        <td className="py-2.5 text-slate-300">Client Memory (TypedArray)</td>
                        <td className="py-2.5 text-emerald-400 font-bold">AVAILABLE (CLIENT)</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-bold text-white">OpenXML Document Engine</td>
                        <td className="py-2.5 text-slate-400 font-mono">docx + OpenXML DOM</td>
                        <td className="py-2.5 text-slate-300">Client Zip Container</td>
                        <td className="py-2.5 text-emerald-400 font-bold">AVAILABLE (CLIENT)</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-bold text-white">Presentation Slide Deck Builder</td>
                        <td className="py-2.5 text-slate-400 font-mono">pptxgenjs + JSZip</td>
                        <td className="py-2.5 text-slate-300">Client Presentation Engine</td>
                        <td className="py-2.5 text-emerald-400 font-bold">AVAILABLE (CLIENT)</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-bold text-white">Spreadsheet Data Processor</td>
                        <td className="py-2.5 text-slate-400 font-mono">xlsx (SheetJS)</td>
                        <td className="py-2.5 text-slate-300">Client Memory Array</td>
                        <td className="py-2.5 text-emerald-400 font-bold">AVAILABLE (CLIENT)</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-bold text-white">OCR Optical Scanner</td>
                        <td className="py-2.5 text-slate-400 font-mono">tesseract.js</td>
                        <td className="py-2.5 text-slate-300">Web Worker</td>
                        <td className="py-2.5 text-emerald-400 font-bold">AVAILABLE (CLIENT)</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-bold text-slate-400">Server Fleet &amp; Worker Cluster</td>
                        <td className="py-2.5 text-slate-500 font-mono">Backend Microservices</td>
                        <td className="py-2.5 text-slate-500">Cloud Infrastructure</td>
                        <td className="py-2.5 text-amber-500 font-bold">UNAVAILABLE (NO BACKEND)</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-bold text-slate-400">Central IAM &amp; Session Authority</td>
                        <td className="py-2.5 text-slate-500 font-mono">OAuth / Identity Server</td>
                        <td className="py-2.5 text-slate-500">Cloud Infrastructure</td>
                        <td className="py-2.5 text-amber-500 font-bold">UNAVAILABLE (NO BACKEND)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'engines' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  <span>Client-Side Engine Execution Flags</span>
                </h3>

                <div className="flex items-center justify-between py-2 border-b border-slate-800">
                  <div>
                    <div className="text-xs font-semibold text-white">SIMD Acceleration</div>
                    <div className="text-[11px] text-slate-400">Use vector instructions when supported by browser</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowSimd}
                    onChange={(e) => setAllowSimd(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-800">
                  <div>
                    <div className="text-xs font-semibold text-white">Debug Logging to Console</div>
                    <div className="text-[11px] text-slate-400">Output detailed conversion traces to browser console</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={debugLogging}
                    onChange={(e) => setDebugLogging(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-xs font-semibold text-white">Batch Queue Limit Override</div>
                    <div className="text-[11px] text-slate-400">Client-side throttle cap for bulk conversions</div>
                  </div>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={maxBatchOverride}
                    onChange={(e) => setMaxBatchOverride(Number(e.target.value))}
                    className="w-20 bg-slate-950 border border-slate-700 text-white text-xs px-2.5 py-1 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-indigo-400" />
                  <span>Prototype Role &amp; Entitlement Simulation</span>
                </h3>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-900/40 text-xs text-amber-200/90 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Testing Tool:</strong> Role switching is a client-side simulation tool for testing feature gating. It does not establish cryptographic server identity or grant production administrative access.
                  </div>
                </div>

                <div className="flex items-center gap-2 py-2 border-b border-slate-800">
                  <input
                    type="checkbox"
                    id="devModeToggle"
                    checked={devModeConfirmed}
                    onChange={(e) => setDevModeConfirmed(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 cursor-pointer"
                  />
                  <label htmlFor="devModeToggle" className="text-xs text-slate-300 font-semibold cursor-pointer">
                    I understand this is a client simulation for developer testing
                  </label>
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 ${!devModeConfirmed ? 'opacity-40 pointer-events-none' : ''}`}>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">Simulate Local Role</label>
                    <div className="flex items-center gap-2">
                      {(['user', 'staff', 'admin'] as UserRole[]).map((r) => (
                        <button
                          key={r}
                          onClick={() => handleRoleChange(r)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                            userSession.role === r
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">Simulate Plan Tier</label>
                    <div className="flex items-center gap-2">
                      {(['free', 'starter', 'pro', 'enterprise'] as PlanTier[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => handleTierChange(t)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                            (userSession.planTier || 'free') === t
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span>Local Session Event Log</span>
                  </h3>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
                  <div className="text-slate-500">[Client Session Started: {SESSION_START_DATE}]</div>
                  <div className="text-emerald-400">[LOCAL] Browser storage active: {projects.length} saved project(s)</div>
                  <div className="text-indigo-400">[LOCAL] Conversion history active: {history.length} completed task(s)</div>
                  <div className="text-amber-400">[NOTICE] Central server logging: Unavailable (standalone client mode)</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

