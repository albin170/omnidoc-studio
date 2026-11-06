import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Activity, 
  Users, 
  DollarSign, 
  HardDrive, 
  FileText, 
  Sliders, 
  Eye, 
  RefreshCw, 
  Search, 
  Plus, 
  Check, 
  X, 
  AlertTriangle, 
  ArrowRight, 
  Lock, 
  UserX, 
  UserCheck, 
  Settings, 
  Layers, 
  Sparkles, 
  HelpCircle,
  Database,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { UserRole, PlanTier, UserSession } from '../../services/storageService';
import { omniDocClient } from '../../sdk/omnidocClient';
import { useToast } from '../../services/toastService';
import { formatFileSize } from '../../services/formatDetector';

interface AdminConsoleProps {
  userSession: UserSession;
  onUpdateSession: (newSession: UserSession) => void;
  totalStorageBytes: number;
  onStartViewAsUser?: (targetUser: any, sessionToken: string) => void;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({
  userSession,
  onUpdateSession,
  totalStorageBytes,
  onStartViewAsUser
}) => {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'plans' | 'features' | 'ui' | 'audit'>('dashboard');
  const [telemetry, setTelemetry] = useState<any>(null);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState(false);

  // User Management State
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Selected User for Overrides
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userEntitlements, setUserEntitlements] = useState<any | null>(null);
  const [overrideForm, setOverrideForm] = useState<Record<string, boolean | null>>({});
  const [customStorageMB, setCustomStorageMB] = useState<number | ''>('');
  const [adminNotes, setAdminNotes] = useState('');
  const [isSavingOverrides, setIsSavingOverrides] = useState(false);

  // Create User Modal
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'staff' | 'admin'>('user');
  const [newUserPlan, setNewUserPlan] = useState<'free' | 'starter' | 'pro' | 'enterprise'>('free');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Plans Management State
  const [plans, setPlans] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);

  // UI Management State
  const [uiConfig, setUiConfig] = useState<any>({ announcement_banner: '', maintenance_mode: false, disabled_modules: [] });
  const [isSavingUi, setIsSavingUi] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Fetch Telemetry on mount or tab change
  const refreshTelemetry = async () => {
    setIsLoadingTelemetry(true);
    try {
      const data = await omniDocClient.getAdminTelemetry();
      setTelemetry(data);
    } catch (err: any) {
      console.warn('Could not fetch telemetry:', err);
    } finally {
      setIsLoadingTelemetry(false);
    }
  };

  const refreshUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const data = await omniDocClient.getAdminUsers({
        search: userSearch,
        plan: userPlanFilter || undefined,
        status_filter: userStatusFilter || undefined,
      });
      setUsers(data);
    } catch (err: any) {
      console.warn('Could not fetch users:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const refreshPlansAndFeatures = async () => {
    setIsLoadingPlans(true);
    try {
      const [pData, fData] = await Promise.all([
        omniDocClient.getAdminPlans(),
        omniDocClient.getAdminFeatures()
      ]);
      setPlans(pData);
      setFeatures(fData);
    } catch (err: any) {
      console.warn('Could not fetch plans/features:', err);
    } finally {
      setIsLoadingPlans(false);
    }
  };

  const refreshUiConfig = async () => {
    try {
      const data = await omniDocClient.getAdminUiConfig();
      setUiConfig(data);
    } catch (err: any) {
      console.warn('Could not fetch UI config:', err);
    }
  };

  const refreshAuditLogs = async () => {
    setIsLoadingAudit(true);
    try {
      const data = await omniDocClient.getAdminAuditLogs({ limit: 50 });
      setAuditLogs(data);
    } catch (err: any) {
      console.warn('Could not fetch audit logs:', err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'dashboard') refreshTelemetry();
    if (activeTab === 'users') refreshUsers();
    if (activeTab === 'plans' || activeTab === 'features') refreshPlansAndFeatures();
    if (activeTab === 'ui') refreshUiConfig();
    if (activeTab === 'audit') refreshAuditLogs();
  }, [activeTab]);

  // Load User Details & Overrides for editing
  const handleSelectUser = async (user: any) => {
    setSelectedUser(user);
    try {
      const detail = await omniDocClient.getAdminUserDetail(user.id);
      setUserEntitlements(detail.entitlements);
      const ovMap: Record<string, boolean | null> = {};
      if (Array.isArray(detail.overrides)) {
        for (const ov of detail.overrides) {
          ovMap[ov.feature_key] = ov.is_enabled;
        }
      }
      setOverrideForm(ovMap);
      if (detail.entitlements?.overrides_applied?.storage_quota_bytes) {
        setCustomStorageMB(Math.round(detail.entitlements.overrides_applied.storage_quota_bytes / (1024 * 1024)));
      } else {
        setCustomStorageMB('');
      }
      setAdminNotes('');
    } catch (err: any) {
      addToast('error', 'Failed to load details', err.message);
    }
  };

  const handleSaveOverrides = async () => {
    if (!selectedUser) return;
    setIsSavingOverrides(true);
    try {
      const overrideItems = Object.entries(overrideForm).map(([feature_key, is_enabled]) => ({
        feature_key,
        is_enabled
      }));

      const payload: any = {
        feature_overrides: overrideItems,
        admin_notes: adminNotes || 'Administrator custom configuration'
      };
      if (customStorageMB !== '') {
        payload.custom_storage_quota_bytes = Number(customStorageMB) * 1024 * 1024;
      }

      await omniDocClient.setUserEntitlements(selectedUser.id, payload);
      addToast('success', 'Overrides Saved', `Custom entitlements applied exclusively to ${selectedUser.email}.`);
      handleSelectUser(selectedUser);
    } catch (err: any) {
      addToast('error', 'Save Failed', err.message);
    } finally {
      setIsSavingOverrides(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserName || !newUserPassword) {
      addToast('warning', 'Missing Fields', 'Please fill all required user fields.');
      return;
    }
    setIsCreatingUser(true);
    try {
      await omniDocClient.createAdminUser({
        email: newUserEmail.trim(),
        full_name: newUserName.trim(),
        password: newUserPassword,
        role: newUserRole,
        plan_tier: newUserPlan
      });
      addToast('success', 'User Created', `Account for ${newUserEmail} provisioned with role: ${newUserRole}.`);
      setIsCreateUserOpen(false);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserPassword('');
      refreshUsers();
    } catch (err: any) {
      addToast('error', 'Creation Failed', err.message);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleSuspendUser = async (user: any) => {
    const reason = prompt(`Enter suspension reason for ${user.email}:`);
    if (!reason) return;
    try {
      await omniDocClient.suspendUser(user.id, reason);
      addToast('info', 'User Suspended', `User ${user.email} suspended.`);
      refreshUsers();
    } catch (err: any) {
      addToast('error', 'Suspension Failed', err.message);
    }
  };

  const handleReactivateUser = async (user: any) => {
    try {
      await omniDocClient.reactivateUser(user.id);
      addToast('success', 'User Reactivated', `User ${user.email} reactivated.`);
      refreshUsers();
    } catch (err: any) {
      addToast('error', 'Reactivation Failed', err.message);
    }
  };

  const handleStartViewAsUser = async (user: any) => {
    try {
      const res = await omniDocClient.createAdminViewSession(user.id, 30);
      addToast('info', 'Admin View Session', `Entering portal as ${user.email} (Read-Only 30m)...`);
      if (onStartViewAsUser) {
        onStartViewAsUser(res.target_user, res.view_session_id);
      }
    } catch (err: any) {
      addToast('error', 'View As User Failed', err.message);
    }
  };

  const handleSaveUiConfig = async () => {
    setIsSavingUi(true);
    try {
      await omniDocClient.updateAdminUiConfig(uiConfig);
      addToast('success', 'UI Config Updated', 'Global UI and announcement settings persisted.');
    } catch (err: any) {
      addToast('error', 'Update Failed', err.message);
    } finally {
      setIsSavingUi(false);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto p-6 md:p-8 bg-[#080B18] text-[#F4F5FF] select-none">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-6 border-b border-white/10 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
            <h1 className="text-2xl font-black tracking-tight text-[#F4F5FF]">
              Administrator Governance Console
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/30">
              ADMIN ROLE VERIFIED
            </span>
          </div>
          <p className="text-xs text-[#9BA3BD] mt-1">
            Logged in as <span className="text-white font-bold">{userSession.userEmail}</span>. Full backend governance, telemetry, and per-user entitlement control.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 rounded-2xl bg-white/[0.05] border border-white/10 text-xs font-bold overflow-x-auto">
          {[
            { id: 'dashboard', label: 'Dashboard & Telemetry' },
            { id: 'users', label: 'User Management' },
            { id: 'plans', label: 'Plans & Pricing' },
            { id: 'features', label: 'Feature Registry' },
            { id: 'ui', label: 'UI Configuration' },
            { id: 'audit', label: 'Audit Trail' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as any); setSelectedUser(null); }}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black shadow-sm'
                  : 'text-[#9BA3BD] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: TELEMETRY DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#F4F5FF]">Real Database Platform Telemetry</h2>
            <button
              onClick={refreshTelemetry}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-[#F4F5FF] flex items-center gap-1.5 border border-white/10 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTelemetry ? 'animate-spin' : ''}`} />
              <span>Refresh Stats</span>
            </button>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[#11152A]/80 border border-white/10 space-y-1">
              <span className="text-[11px] font-bold text-[#9BA3BD] uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#42D6E8]" /> Total Registered Users
              </span>
              <div className="text-2xl font-black text-[#F4F5FF]">{telemetry?.total_users ?? 0}</div>
              <p className="text-[10px] text-emerald-400 font-medium">
                {telemetry?.active_users ?? 0} active ({telemetry?.suspended_users ?? 0} suspended)
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#11152A]/80 border border-white/10 space-y-1">
              <span className="text-[11px] font-bold text-[#9BA3BD] uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Monthly Revenue (MRR)
              </span>
              <div className="text-2xl font-black text-[#F4F5FF]">
                ${((telemetry?.monthly_recurring_revenue_cents ?? 0) / 100).toFixed(2)}
              </div>
              <p className="text-[10px] text-[#9BA3BD]">
                {telemetry?.active_subscriptions ?? 0} active paid subscriptions
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#11152A]/80 border border-white/10 space-y-1">
              <span className="text-[11px] font-bold text-[#9BA3BD] uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#8B7CFF]" /> Documents Vault
              </span>
              <div className="text-2xl font-black text-[#F4F5FF]">{telemetry?.total_documents ?? 0}</div>
              <p className="text-[10px] text-[#9BA3BD]">
                {formatFileSize(telemetry?.total_storage_bytes ?? 0)} stored across tenants
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#11152A]/80 border border-white/10 space-y-1">
              <span className="text-[11px] font-bold text-[#9BA3BD] uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-purple-400" /> Autonomous Jobs
              </span>
              <div className="text-2xl font-black text-[#F4F5FF]">{telemetry?.total_jobs ?? 0}</div>
              <p className="text-[10px] text-red-400">
                {telemetry?.failed_jobs ?? 0} failed / aborted executions
              </p>
            </div>
          </div>

          {/* Activity Feeds */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-[#11152A]/60 border border-white/10 space-y-3">
              <h3 className="text-xs font-bold text-[#9BA3BD] uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-[#42D6E8]" /> Recent Registrations
              </h3>
              <div className="space-y-2">
                {telemetry?.recent_registrations?.length > 0 ? (
                  telemetry.recent_registrations.map((u: any) => (
                    <div key={u.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-[#F4F5FF] block">{u.full_name}</span>
                        <span className="text-[11px] text-[#9BA3BD]">{u.email}</span>
                      </div>
                      <span className="text-[10px] text-white/40">{new Date(u.created_at).toLocaleDateString()}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#9BA3BD]">No recent user registrations recorded.</p>
                )}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#11152A]/60 border border-white/10 space-y-3">
              <h3 className="text-xs font-bold text-[#9BA3BD] uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" /> Recent Administrative Actions
              </h3>
              <div className="space-y-2">
                {telemetry?.recent_audit_events?.length > 0 ? (
                  telemetry.recent_audit_events.map((a: any) => (
                    <div key={a.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono text-amber-300 font-bold block">{a.action}</span>
                        <span className="text-[10px] text-[#9BA3BD]">{a.target}</span>
                      </div>
                      <span className="text-[10px] text-white/40">{new Date(a.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#9BA3BD]">No recent audit events.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#9BA3BD]" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && refreshUsers()}
                  placeholder="Search user name or email..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <button
                onClick={refreshUsers}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white cursor-pointer"
              >
                Filter
              </button>
            </div>

            <button
              onClick={() => setIsCreateUserOpen(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-xs shadow hover:from-amber-400 hover:to-amber-500 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New User</span>
            </button>
          </div>

          {/* User Table & Detail Pane Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className={`${selectedUser ? 'lg:col-span-7' : 'lg:col-span-12'} p-5 rounded-2xl bg-[#11152A]/80 border border-white/10 overflow-x-auto`}>
              <table className="w-full text-left text-xs text-[#F4F5FF]">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase font-bold text-[#9BA3BD]">
                    <th className="pb-3">User &amp; Organization</th>
                    <th className="pb-3">Role</th>
                    <th className="pb-3">Plan</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className={`hover:bg-white/[0.03] transition-colors ${
                        selectedUser?.id === u.id ? 'bg-amber-500/10' : ''
                      }`}
                    >
                      <td className="py-3">
                        <span className="font-bold block text-white">{u.full_name}</span>
                        <span className="text-[11px] text-[#9BA3BD]">{u.email}</span>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                          u.role === 'admin' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-white/10 text-white/70'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="font-bold text-[#42D6E8] uppercase text-[11px] font-mono">
                          {u.plan_tier}
                        </span>
                      </td>
                      <td className="py-3">
                        {u.is_active ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold border border-red-500/30">
                            SUSPENDED
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleSelectUser(u)}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] text-white font-bold cursor-pointer"
                        >
                          Overrides
                        </button>
                        <button
                          onClick={() => handleStartViewAsUser(u)}
                          className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[11px] font-bold cursor-pointer"
                        >
                          View As
                        </button>
                        {u.is_active ? (
                          <button
                            onClick={() => handleSuspendUser(u)}
                            className="px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-[10px] font-bold cursor-pointer"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivateUser(u)}
                            className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold cursor-pointer"
                          >
                            Reactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Selected User Feature Control & Overrides Panel (Phase 5 Requirement) */}
            {selectedUser && (
              <div className="lg:col-span-5 p-6 rounded-2xl bg-[#11152A] border border-amber-500/30 shadow-2xl space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-amber-400" />
                      <span>Individual Feature Overrides</span>
                    </h3>
                    <p className="text-[11px] text-[#9BA3BD]">
                      Configuring overrides for <span className="text-amber-300 font-bold">{selectedUser.email}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="text-[11px] text-[#9BA3BD] font-bold uppercase block mb-1.5">
                      Custom Storage Quota (MB)
                    </label>
                    <input
                      type="number"
                      value={customStorageMB}
                      onChange={(e) => setCustomStorageMB(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="e.g. 500 (Leave empty to inherit plan default)"
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <span className="text-[11px] text-[#9BA3BD] font-bold uppercase block mb-2">
                      Feature Permissions Overrides:
                    </span>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {[
                        { key: 'pdf_tools', label: 'PDF Studio' },
                        { key: 'pdf_sanitizer', label: 'PDF Content Redaction' },
                        { key: 'docx_studio', label: 'Word Document Editor' },
                        { key: 'sheet_studio', label: 'Excel Spreadsheets' },
                        { key: 'slide_studio', label: 'Slide Presentations' },
                        { key: 'image_studio', label: 'Graphics Studio' },
                        { key: 'ocr_engine', label: 'OCR Recognition' },
                        { key: 'workflows', label: 'Visual Workflow Pipelines' },
                        { key: 'autonomous_agent', label: 'Autonomous Document Agent' },
                        { key: 'document_forensics', label: 'Document Forensics & DNA' },
                        { key: 'api_access', label: 'Developer API Keys' }
                      ].map((f) => {
                        const currentVal = overrideForm[f.key];
                        return (
                          <div key={f.key} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/5">
                            <span className="text-white text-xs font-medium">{f.label}</span>
                            <div className="flex items-center gap-1 text-[10px] font-bold">
                              <button
                                type="button"
                                onClick={() => setOverrideForm({ ...overrideForm, [f.key]: true })}
                                className={`px-2 py-0.5 rounded ${currentVal === true ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/50'}`}
                              >
                                Enable
                              </button>
                              <button
                                type="button"
                                onClick={() => setOverrideForm({ ...overrideForm, [f.key]: false })}
                                className={`px-2 py-0.5 rounded ${currentVal === false ? 'bg-red-500 text-white' : 'bg-white/10 text-white/50'}`}
                              >
                                Disable
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const cp = { ...overrideForm };
                                  delete cp[f.key];
                                  setOverrideForm(cp);
                                }}
                                className={`px-2 py-0.5 rounded ${currentVal === undefined ? 'bg-white/20 text-white font-bold' : 'bg-white/5 text-white/30'}`}
                              >
                                Default
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-[#9BA3BD] font-bold uppercase block mb-1">
                      Administrative Audit Note
                    </label>
                    <input
                      type="text"
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="e.g. Approved custom trial exception"
                      className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <button
                    onClick={handleSaveOverrides}
                    disabled={isSavingOverrides}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-xs shadow hover:from-amber-400 hover:to-amber-500 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSavingOverrides ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Save Individual Entitlements</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PLANS & PRICING MANAGEMENT */}
      {activeTab === 'plans' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Configurable Subscription Plans</h2>
              <p className="text-xs text-[#9BA3BD]">Administrators can edit prices, storage quotas, and feature allocations for published plans.</p>
            </div>
            <button
              onClick={refreshPlansAndFeatures}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPlans ? 'animate-spin' : ''}`} />
              <span>Reload Plans</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((p) => (
              <div key={p.id} className="p-5 rounded-2xl bg-[#11152A]/80 border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-white text-base">{p.name}</h3>
                  <span className="font-mono text-xs text-[#42D6E8] uppercase">{p.slug}</span>
                </div>
                <div className="text-2xl font-black text-white">
                  ${(p.monthly_price_cents / 100).toFixed(2)}
                  <span className="text-xs text-[#9BA3BD] font-normal"> / mo</span>
                </div>
                <p className="text-xs text-[#9BA3BD]">{p.description}</p>
                <div className="text-xs space-y-1.5 border-t border-white/10 pt-3">
                  <div className="flex justify-between">
                    <span className="text-[#9BA3BD]">Storage:</span>
                    <span className="font-bold">{formatFileSize(p.storage_quota_bytes)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9BA3BD]">Monthly Docs:</span>
                    <span className="font-bold">{p.monthly_processing_quota}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9BA3BD]">API Access:</span>
                    <span className="font-bold">{p.has_api_access ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: FEATURE REGISTRY */}
      {activeTab === 'features' && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-white">Centralized Feature Registry</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {features.map((feat) => (
              <div key={feat.id} className="p-4 rounded-2xl bg-[#11152A]/70 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{feat.name}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 font-bold">
                    {feat.category}
                  </span>
                </div>
                <p className="text-xs text-[#9BA3BD]">{feat.description}</p>
                <div className="pt-2 text-[10px] font-mono text-[#42D6E8]">
                  Key: {feat.feature_key}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: UI CONFIGURATION */}
      {activeTab === 'ui' && (
        <div className="max-w-2xl p-6 rounded-2xl bg-[#11152A]/80 border border-white/10 space-y-5">
          <h2 className="text-lg font-bold text-white">Admin UI Management &amp; Banners</h2>
          <div>
            <label className="text-xs font-bold text-[#F4F5FF] block mb-1.5">Global Announcement Banner</label>
            <input
              type="text"
              value={uiConfig.announcement_banner || ''}
              onChange={(e) => setUiConfig({ ...uiConfig, announcement_banner: e.target.value })}
              placeholder="e.g. Maintenance scheduled for Saturday 02:00 UTC."
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="maint_mode"
              checked={Boolean(uiConfig.maintenance_mode)}
              onChange={(e) => setUiConfig({ ...uiConfig, maintenance_mode: e.target.checked })}
              className="w-4 h-4 accent-amber-400 rounded"
            />
            <label htmlFor="maint_mode" className="text-xs font-bold text-white cursor-pointer">
              Enable Maintenance Mode (Restricts new document uploads)
            </label>
          </div>

          <button
            onClick={handleSaveUiConfig}
            disabled={isSavingUi}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-xs shadow hover:from-amber-400 hover:to-amber-500 flex items-center gap-2 cursor-pointer"
          >
            {isSavingUi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>Save Global UI Settings</span>
          </button>
        </div>
      )}

      {/* TAB 6: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">Immutable Administrative Audit Log</h2>
          <div className="p-5 rounded-2xl bg-[#11152A]/80 border border-white/10 overflow-x-auto">
            <table className="w-full text-left text-xs text-[#F4F5FF]">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase font-bold text-[#9BA3BD]">
                  <th className="pb-3">Timestamp</th>
                  <th className="pb-3">Action</th>
                  <th className="pb-3">Target</th>
                  <th className="pb-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.03]">
                    <td className="py-2.5 text-white/50">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="py-2.5 text-amber-300 font-bold">{log.action}</td>
                    <td className="py-2.5 text-white/70">{log.target_type}:{log.target_id}</td>
                    <td className="py-2.5 text-white/50 max-w-xs truncate">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {isCreateUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#11152A] border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white">Provision New User Account</h3>
              <button onClick={() => setIsCreateUserOpen(false)} className="text-white/50 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-[#9BA3BD] block mb-1">Full Name</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#9BA3BD] block mb-1">Email Address</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="jane@company.com"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#9BA3BD] block mb-1">Temporary Password</label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#9BA3BD] block mb-1">Role</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#11152A] border border-white/10 text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="user">User</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#9BA3BD] block mb-1">Plan Tier</label>
                  <select
                    value={newUserPlan}
                    onChange={(e) => setNewUserPlan(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#11152A] border border-white/10 text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="free">Free</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateUserOpen(false)}
                  className="px-3 py-2 rounded-xl bg-white/10 text-white text-xs hover:bg-white/15"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-xs shadow hover:from-amber-400 hover:to-amber-500"
                >
                  {isCreatingUser ? 'Creating...' : 'Provision Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
