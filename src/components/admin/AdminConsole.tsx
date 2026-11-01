import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Activity, 
  Cpu, 
  UserCheck, 
  CheckCircle2, 
  Download, 
  Zap,
  Terminal
} from 'lucide-react';
import { UserRole, PlanTier, UserSession, getConversionHistory, getStoredProjects } from '../../services/storageService';
import { formatFileSize } from '../../services/formatDetector';
import { useToast } from '../../services/toastService';
import saveAs from 'file-saver';

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

  // Diagnostic log entries
  const [logs, setLogs] = useState<Array<{ timestamp: string; level: 'info' | 'warn' | 'error'; message: string }>>(() => {
    const now = Date.now();
    return [
      { timestamp: new Date(now - 3600000).toLocaleTimeString(), level: 'info', message: 'WASM Runtime initialized: pdf-lib v1.17.1' },
      { timestamp: new Date(now - 3200000).toLocaleTimeString(), level: 'info', message: 'OpenXML Engine online: docx & pptxgenjs' },
      { timestamp: new Date(now - 2500000).toLocaleTimeString(), level: 'info', message: 'OCR Engine worker ready (Tesseract.js v5)' },
      { timestamp: new Date(now - 1200000).toLocaleTimeString(), level: 'info', message: 'SheetJS XLSX memory driver ready' },
    ];
  });

  const history = getConversionHistory();
  const projects = getStoredProjects();

  const handleRoleChange = (role: UserRole) => {
    const updated: UserSession = { ...userSession, role };
    onUpdateSession(updated);
    addToast('success', 'Role Updated', `Active user role changed to ${role.toUpperCase()}`);
  };

  const handleTierChange = (tier: PlanTier) => {
    const updated: UserSession = { ...userSession, planTier: tier };
    onUpdateSession(updated);
    addToast('success', 'Plan Tier Updated', `Active subscription plan changed to ${tier.toUpperCase()}`);
  };

  const handleExportAuditLogs = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      user: userSession.userEmail || userSession.userName,
      role: userSession.role,
      planTier: userSession.planTier,
      totalConversions: history.length,
      totalProjects: projects.length,
      systemLogs: logs,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    saveAs(blob, `omnidoc_audit_log_${Date.now()}.json`);
    addToast('info', 'Audit Log Exported', 'Telemetry audit log downloaded successfully.');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Header */}
      <div className="h-14 border-b border-slate-800 bg-slate-900/90 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white leading-tight">Admin &amp; Architecture Console</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/20 text-red-400 border border-red-500/30">
                ROOT PRIVILEGES
              </span>
            </div>
            <p className="text-[11px] text-slate-400">System metrics, engine telemetry, and subscription role management</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportAuditLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Export Audit Trail</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Nav */}
        <div className="w-56 border-r border-slate-800/80 bg-slate-950/60 p-4 space-y-1 shrink-0">
          {[
            { id: 'metrics', label: 'Telemetry & Health', icon: Activity },
            { id: 'engines', label: 'WASM & Engines', icon: Cpu },
            { id: 'users', label: 'Tiers & Access Control', icon: UserCheck },
            { id: 'logs', label: 'System Audit Logs', icon: Terminal },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  active 
                    ? 'bg-red-600/90 text-white shadow-md shadow-red-600/30' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content View */}
        <div className="flex-1 overflow-y-auto p-6 max-w-5xl space-y-6">
          {activeTab === 'metrics' && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Engine Status</div>
                  <div className="text-xl font-extrabold text-emerald-400 mt-1 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Healthy</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">100% Client-side sandbox</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Conversions</div>
                  <div className="text-xl font-extrabold text-white mt-1">{history.length}</div>
                  <div className="text-[11px] text-indigo-400 mt-1">Logged locally</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Projects</div>
                  <div className="text-xl font-extrabold text-white mt-1">{projects.length}</div>
                  <div className="text-[11px] text-purple-400 mt-1">IndexedDB storage</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Storage Footprint</div>
                  <div className="text-xl font-extrabold text-white mt-1">{formatFileSize(totalStorageBytes)}</div>
                  <div className="text-[11px] text-amber-400 mt-1">Local Browser DB</div>
                </div>
              </div>

              {/* Engine Telemetry Table */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Subsystem Telemetry</span>
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">Subsystem</th>
                        <th className="pb-3 font-semibold">Driver / Package</th>
                        <th className="pb-3 font-semibold">Execution Context</th>
                        <th className="pb-3 font-semibold">State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      <tr>
                        <td className="py-2.5 font-bold text-white">PDF Manipulation &amp; Signatures</td>
                        <td className="py-2.5 text-slate-400 font-mono">pdf-lib / pdfjs-dist</td>
                        <td className="py-2.5 text-slate-300">Client Memory (TypedArray)</td>
                        <td className="py-2.5 text-emerald-400 font-bold">ONLINE</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-bold text-white">OpenXML Document Engine</td>
                        <td className="py-2.5 text-slate-400 font-mono">docx + OpenXML DOM</td>
                        <td className="py-2.5 text-slate-300">Client Zip Container</td>
                        <td className="py-2.5 text-emerald-400 font-bold">ONLINE</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-bold text-white">Presentation Slide Deck Builder</td>
                        <td className="py-2.5 text-slate-400 font-mono">pptxgenjs + JSZip</td>
                        <td className="py-2.5 text-slate-300">Client Presentation Engine</td>
                        <td className="py-2.5 text-emerald-400 font-bold">ONLINE</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-bold text-white">Spreadsheet Data Processor</td>
                        <td className="py-2.5 text-slate-400 font-mono">xlsx (SheetJS)</td>
                        <td className="py-2.5 text-slate-300">Client Memory Array</td>
                        <td className="py-2.5 text-emerald-400 font-bold">ONLINE</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-bold text-white">Optical Character Recognition</td>
                        <td className="py-2.5 text-slate-400 font-mono">tesseract.js</td>
                        <td className="py-2.5 text-slate-300">Dedicated Web Worker</td>
                        <td className="py-2.5 text-emerald-400 font-bold">ONLINE</td>
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
                  <span>Processing Engine Configuration Flags</span>
                </h3>

                <div className="flex items-center justify-between py-2 border-b border-slate-800">
                  <div>
                    <div className="text-xs font-semibold text-white">SIMD Acceleration</div>
                    <div className="text-[11px] text-slate-400">Execute vector transforms for image resizing and background extraction</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowSimd}
                    onChange={(e) => setAllowSimd(e.target.checked)}
                    className="w-4 h-4 accent-red-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-800">
                  <div>
                    <div className="text-xs font-semibold text-white">Debug Logging to Console</div>
                    <div className="text-[11px] text-slate-400">Output detailed step-by-step conversion traces to browser console</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={debugLogging}
                    onChange={(e) => setDebugLogging(e.target.checked)}
                    className="w-4 h-4 accent-red-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-xs font-semibold text-white">Batch Queue Concurrency Cap</div>
                    <div className="text-[11px] text-slate-400">Maximum concurrent files allowed in single conversion queue</div>
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
                  <span>Session Role &amp; Entitlement Tier Management</span>
                </h3>

                <p className="text-xs text-slate-400">
                  Toggle session role or subscription tier to test feature gating, quota boundaries, and admin controls.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">Active User Role</label>
                    <div className="flex items-center gap-2">
                      {(['user', 'staff', 'admin'] as UserRole[]).map((r) => (
                        <button
                          key={r}
                          onClick={() => handleRoleChange(r)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                            userSession.role === r
                              ? 'bg-red-600 text-white shadow-sm'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">Active Plan Tier</label>
                    <div className="flex items-center gap-2">
                      {(['free', 'starter', 'pro', 'enterprise'] as PlanTier[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => handleTierChange(t)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                            (userSession.planTier || 'pro') === t
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
                    <span>Real-Time Subsystem Log Stream</span>
                  </h3>
                  <button
                    onClick={() => setLogs([])}
                    className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                  >
                    Clear Stream
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-2 max-h-80 overflow-y-auto">
                  {logs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                      <span className={log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-amber-400' : 'text-emerald-400 font-bold'}>
                        [{log.level.toUpperCase()}]
                      </span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
