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
  CheckCircle2,
  Mail,
  Send,
  Bell,
  Archive,
  MessageSquare
} from 'lucide-react';
import { UserRole, PlanTier, UserSession } from '../../services/storageService';
import { omniDocClient } from '../../sdk/omnidocClient';
import { useToast } from '../../services/toastService';
import { formatFileSize } from '../../services/formatDetector';
import { DirectMessage, Announcement } from '../../types';

interface AdminConsoleProps {
  userSession: UserSession;
  onUpdateSession: (newSession: UserSession) => void;
  totalStorageBytes: number;
  onStartViewAsUser?: (targetUser: any, sessionToken: string, scopedToken?: string) => void;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({
  userSession,
  onUpdateSession,
  totalStorageBytes,
  onStartViewAsUser
}) => {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'users' | 'messages' | 'announcements' | 'plans' | 'features' | 'ui' | 'audit'
  >('dashboard');
  
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

  // Suspension Modal State (Replaces window.prompt)
  const [suspensionModalUser, setSuspensionModalUser] = useState<any | null>(null);
  const [suspensionReason, setSuspensionReason] = useState<string>('');
  const [isSubmittingSuspension, setIsSubmittingSuspension] = useState<boolean>(false);

  // Create User Modal
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'staff' | 'admin'>('user');
  const [newUserPlan, setNewUserPlan] = useState<'free' | 'starter' | 'pro' | 'enterprise'>('free');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Direct Messages Workspace State
  const [adminMessages, setAdminMessages] = useState<DirectMessage[]>([]);
  const [isLoadingAdminMessages, setIsLoadingAdminMessages] = useState(false);
  const [targetRecipientId, setTargetRecipientId] = useState('');
  const [messageSubject, setMessageSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [messagePriority, setMessagePriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [recipientFilter, setRecipientFilter] = useState('');

  // Announcements Workspace State
  const [adminAnnouncements, setAdminAnnouncements] = useState<Announcement[]>([]);
  const [isLoadingAdminAnnouncements, setIsLoadingAdminAnnouncements] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annPriority, setAnnPriority] = useState<'informational' | 'important' | 'critical'>('informational');
  const [annAudienceType, setAnnAudienceType] = useState<'all' | 'plan' | 'role' | 'user'>('all');
  const [annAudienceRef, setAnnAudienceRef] = useState('');
  const [annExpiresAt, setAnnExpiresAt] = useState('');
  const [isCreatingAnn, setIsCreatingAnn] = useState(false);

  // Plans Management State (Preserved)
  const [plans, setPlans] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);

  // UI Management State
  const [uiConfig, setUiConfig] = useState<any>({ announcement_banner: '', maintenance_mode: false, disabled_modules: [] });
  const [isSavingUi, setIsSavingUi] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Fetch Telemetry
  const refreshTelemetry = async () => {
    setIsLoadingTelemetry(true);
    try {
      const data = await omniDocClient.getAdminTelemetry();
      setTelemetry(data);
    } catch (err: any) {
      addToast('error', 'Telemetry Error', 'Could not load platform metrics: ' + err.message);
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
      addToast('error', 'Directory Error', 'Could not fetch user directory: ' + err.message);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const refreshAdminMessages = async () => {
    setIsLoadingAdminMessages(true);
    try {
      const res = await omniDocClient.getAdminMessageHistory({
        recipient_id: recipientFilter || undefined,
      });
      setAdminMessages(res.items);
    } catch (err: any) {
      addToast('error', 'Messages Error', 'Failed to load dispatch history: ' + err.message);
    } finally {
      setIsLoadingAdminMessages(false);
    }
  };

  const refreshAdminAnnouncements = async () => {
    setIsLoadingAdminAnnouncements(true);
    try {
      const res = await omniDocClient.getAdminAnnouncements();
      setAdminAnnouncements(res.items);
    } catch (err: any) {
      addToast('error', 'Announcements Error', 'Failed to load announcements: ' + err.message);
    } finally {
      setIsLoadingAdminAnnouncements(false);
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
      addToast('error', 'Plans Error', 'Could not fetch plans/features: ' + err.message);
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
      addToast('error', 'Audit Log Error', 'Could not load audit log: ' + err.message);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'dashboard') refreshTelemetry();
    if (activeTab === 'users') refreshUsers();
    if (activeTab === 'messages') {
      refreshUsers();
      refreshAdminMessages();
    }
    if (activeTab === 'announcements') refreshAdminAnnouncements();
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
    } catch (err: any) {
      addToast('error', 'Failed to load details', err.message);
    }
  };

  const handleSaveOverrides = async () => {
    if (!selectedUser) return;
    setIsSavingOverrides(true);
    try {
      const overridePayload: any = {
        overrides: Object.entries(overrideForm).map(([feature_key, is_enabled]) => ({
          feature_key,
          is_enabled
        })),
        admin_notes: adminNotes || undefined,
      };

      if (customStorageMB !== '') {
        overridePayload.storage_quota_bytes = Number(customStorageMB) * 1024 * 1024;
      }

      await omniDocClient.saveAdminUserOverrides(selectedUser.id, overridePayload);
      addToast('success', 'Overrides Saved', `Individual entitlements saved for ${selectedUser.email}.`);
      handleSelectUser(selectedUser);
    } catch (err: any) {
      addToast('error', 'Save Failed', err.message);
    } finally {
      setIsSavingOverrides(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPassword) {
      addToast('error', 'Validation Error', 'Email and password are required.');
      return;
    }
    setIsCreatingUser(true);
    try {
      await omniDocClient.createAdminUser({
        email: newUserEmail,
        password: newUserPassword,
        full_name: newUserName || 'Studio User',
        role: newUserRole,
        plan_tier: newUserPlan,
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

  // Replaces window.prompt() with accessible modal execution
  const handleConfirmSuspension = async () => {
    if (!suspensionModalUser) return;
    setIsSubmittingSuspension(true);
    try {
      await omniDocClient.suspendUser(suspensionModalUser.id, suspensionReason.trim() || 'Administrative policy suspension');
      addToast('info', 'User Suspended', `User ${suspensionModalUser.email} has been suspended.`);
      setSuspensionModalUser(null);
      setSuspensionReason('');
      refreshUsers();
    } catch (err: any) {
      addToast('error', 'Suspension Failed', err.message);
    } finally {
      setIsSubmittingSuspension(false);
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
      addToast('info', 'Admin View Session', `Entering portal as ${user.email} (Scoped JWT, Read-Only 30m)...`);
      if (onStartViewAsUser) {
        onStartViewAsUser(res.target_user, res.view_session_id, res.scoped_token);
      }
    } catch (err: any) {
      addToast('error', 'View As User Failed', err.message);
    }
  };

  const handleSendAdminMessage = async () => {
    if (!targetRecipientId) {
      addToast('error', 'Validation Error', 'Please select a recipient user from the directory.');
      return;
    }
    if (!messageSubject.trim() || !messageBody.trim()) {
      addToast('error', 'Validation Error', 'Message subject and content body are required.');
      return;
    }
    setIsSendingMessage(true);
    try {
      await omniDocClient.sendDirectMessage({
        recipient_user_id: targetRecipientId,
        subject: messageSubject.trim(),
        body: messageBody.trim(),
        priority: messagePriority,
      });
      addToast('success', 'Message Dispatched', 'Direct message persisted to recipient inbox.');
      setMessageSubject('');
      setMessageBody('');
      setMessagePriority('normal');
      refreshAdminMessages();
    } catch (err: any) {
      addToast('error', 'Dispatch Failed', err.message || 'Could not send message.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!annTitle.trim() || !annBody.trim()) {
      addToast('error', 'Validation Error', 'Announcement title and content body are required.');
      return;
    }
    setIsCreatingAnn(true);
    try {
      await omniDocClient.createAnnouncement({
        title: annTitle.trim(),
        body: annBody.trim(),
        priority: annPriority,
        audience_type: annAudienceType,
        audience_reference: annAudienceRef.trim() || undefined,
        expires_at: annExpiresAt ? new Date(annExpiresAt).toISOString() : undefined,
        is_published: true,
      });
      addToast('success', 'Announcement Published', 'Notice is now live for targeted users.');
      setAnnTitle('');
      setAnnBody('');
      setAnnPriority('informational');
      setAnnAudienceType('all');
      setAnnAudienceRef('');
      setAnnExpiresAt('');
      refreshAdminAnnouncements();
    } catch (err: any) {
      addToast('error', 'Publish Failed', err.message || 'Could not publish announcement.');
    } finally {
      setIsCreatingAnn(false);
    }
  };

  const handleArchiveAnnouncement = async (annId: string) => {
    if (!confirm('Are you sure you want to archive and unpublish this notice?')) return;
    try {
      await omniDocClient.archiveAnnouncement(annId);
      addToast('info', 'Notice Archived', 'The announcement has been withdrawn.');
      refreshAdminAnnouncements();
    } catch (err: any) {
      addToast('error', 'Archive Failed', err.message);
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

  // Enforce consistent role check for both admin and superadmin
  if (userSession.role !== 'admin' && userSession.role !== 'superadmin') {
    return (
      <div className="w-full h-full flex items-center justify-center p-6 bg-[#03050C] text-[#F5FAFF]">
        <div className="p-8 rounded-[28px] lg-primary max-w-md text-center space-y-4 border border-rose-500/30">
          <ShieldAlert className="w-12 h-12 text-[#FF3366] mx-auto" />
          <h2 className="text-xl font-bold font-display">Administrative Privileges Required</h2>
          <p className="text-xs text-[#A7B8CA]">
            Your current authenticated account ({userSession.userEmail}) does not possess administrative or superadministrative privileges.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-[#03050C] text-[#F5FAFF] select-none custom-scrollbar">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 mb-6 border-b border-white/10 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-[#38BDF8]" />
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#F5FAFF] font-display">
              Administrative Operations &amp; Communications
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#38BDF8]/15 text-[#38BDF8] font-mono text-[10px] font-bold border border-[#38BDF8]/30 uppercase">
              {userSession.role === 'superadmin' ? 'SUPERADMIN VERIFIED' : 'ADMIN ROLE VERIFIED'}
            </span>
          </div>
          <p className="text-xs text-[#A7B8CA] mt-1">
            Logged in as <span className="text-white font-bold">{userSession.userEmail}</span>. Full backend governance, telemetry, direct messaging, notices, and user entitlements.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 rounded-2xl bg-white/[0.04] border border-white/10 text-xs font-bold overflow-x-auto custom-scrollbar">
          {[
            { id: 'dashboard', label: 'Telemetry', icon: Activity },
            { id: 'users', label: 'User Directory', icon: Users },
            { id: 'messages', label: 'Direct Messages', icon: Mail },
            { id: 'announcements', label: 'Announcements', icon: Bell },
            { id: 'plans', label: 'Plans & Pricing', icon: DollarSign },
            { id: 'features', label: 'Feature Registry', icon: Sliders },
            { id: 'ui', label: 'UI Configuration', icon: Settings },
            { id: 'audit', label: 'Audit Trail', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); setSelectedUser(null); }}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-[#FF3366] to-[#38BDF8] text-white font-black shadow-md'
                    : 'text-[#A7B8CA] hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: TELEMETRY DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#F5FAFF] font-display">Real Database Platform Telemetry</h2>
            <button
              onClick={refreshTelemetry}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTelemetry ? 'animate-spin text-[#38BDF8]' : ''}`} />
              <span>Refresh Metrics</span>
            </button>
          </div>

          {isLoadingTelemetry ? (
            <div className="p-12 text-center text-xs text-[#A7B8CA]">Querying PostgreSQL / SQLite metrics...</div>
          ) : telemetry ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-[#060914] border border-white/10 space-y-1">
                <div className="flex items-center justify-between text-xs text-[#A7B8CA]">
                  <span>Total Registered Users</span>
                  <Users className="w-4 h-4 text-[#38BDF8]" />
                </div>
                <div className="text-2xl font-black text-white">{telemetry.users_count}</div>
                <div className="text-[10px] text-emerald-400 font-mono">Isolated Multi-Tenant Engine</div>
              </div>

              <div className="p-5 rounded-2xl bg-[#060914] border border-white/10 space-y-1">
                <div className="flex items-center justify-between text-xs text-[#A7B8CA]">
                  <span>Stored Digital Twin Documents</span>
                  <FileText className="w-4 h-4 text-[#FF3366]" />
                </div>
                <div className="text-2xl font-black text-white">{telemetry.documents_count}</div>
                <div className="text-[10px] text-[#A7B8CA] font-mono">Zero-leak client isolation</div>
              </div>

              <div className="p-5 rounded-2xl bg-[#060914] border border-white/10 space-y-1">
                <div className="flex items-center justify-between text-xs text-[#A7B8CA]">
                  <span>Total Vault Storage</span>
                  <HardDrive className="w-4 h-4 text-[#38BDF8]" />
                </div>
                <div className="text-2xl font-black text-white">
                  {formatFileSize(telemetry.total_storage_bytes || totalStorageBytes)}
                </div>
                <div className="text-[10px] text-emerald-400 font-mono">Backend Vault Allocation</div>
              </div>

              <div className="p-5 rounded-2xl bg-[#060914] border border-white/10 space-y-1">
                <div className="flex items-center justify-between text-xs text-[#A7B8CA]">
                  <span>Total Background Jobs</span>
                  <Activity className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-white">{telemetry.jobs_count}</div>
                <div className="text-[10px] text-[#A7B8CA] font-mono">Deterministic pipelines</div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-[#A7B8CA] rounded-2xl border border-white/10 bg-white/[0.02]">
              Failed to query telemetry. Ensure the backend engine is running.
            </div>
          )}
        </div>
      )}

      {/* TAB 2: USER DIRECTORY & MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <input
                  type="text"
                  placeholder="Search by email, name..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && refreshUsers()}
                  className="w-full text-xs py-2 px-3 pl-8 rounded-xl bg-white/[0.04] border border-white/15 text-white placeholder:text-[#A7B8CA]/50 focus:border-[#38BDF8] outline-none"
                />
                <Search className="w-3.5 h-3.5 text-[#A7B8CA] absolute left-2.5 top-2.5" />
              </div>

              <select
                value={userPlanFilter}
                onChange={(e) => { setUserPlanFilter(e.target.value); setTimeout(refreshUsers, 50); }}
                className="text-xs py-2 px-3 rounded-xl bg-[#060914] border border-white/15 text-white outline-none"
              >
                <option value="">All Plans</option>
                <option value="free">Free Community</option>
                <option value="starter">Starter Pro</option>
                <option value="pro">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>

              <select
                value={userStatusFilter}
                onChange={(e) => { setUserStatusFilter(e.target.value); setTimeout(refreshUsers, 50); }}
                className="text-xs py-2 px-3 rounded-xl bg-[#060914] border border-white/15 text-white outline-none"
              >
                <option value="">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended Only</option>
              </select>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={() => setIsCreateUserOpen(true)}
                className="lg-btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create User</span>
              </button>

              <button
                onClick={refreshUsers}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
                title="Refresh Directory"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin text-[#38BDF8]' : ''}`} />
              </button>
            </div>
          </div>

          {/* User Table Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className={`${selectedUser ? 'lg:col-span-7' : 'lg:col-span-12'} overflow-x-auto rounded-2xl border border-white/10 bg-[#060914]`}>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 text-[#A7B8CA] font-mono text-[10px] uppercase bg-white/[0.02]">
                  <tr>
                    <th className="p-3 pl-4">User</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Plan</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className={`hover:bg-white/[0.03] transition-colors cursor-pointer ${
                        selectedUser?.id === u.id ? 'bg-[#38BDF8]/10' : ''
                      }`}
                      onClick={() => handleSelectUser(u)}
                    >
                      <td className="p-3 pl-4">
                        <div className="font-bold text-white">{u.full_name || 'User'}</div>
                        <div className="text-[11px] text-[#A7B8CA] font-mono">{u.email}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                          u.role === 'superadmin' ? 'bg-[#FF3366]/20 text-[#FF3366] border border-[#FF3366]/40' :
                          u.role === 'admin' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-white/10 text-white/70'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="font-mono text-[11px] uppercase font-semibold text-[#38BDF8]">
                          {u.plan_tier || 'free'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.is_active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
                        }`}>
                          {u.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="p-3 text-right pr-4 space-x-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleStartViewAsUser(u)}
                          className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold cursor-pointer transition-colors"
                          title="View As User (Scoped Session)"
                        >
                          View As
                        </button>
                        {u.is_active ? (
                          <button
                            onClick={() => {
                              setSuspensionModalUser(u);
                              setSuspensionReason('');
                            }}
                            className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivateUser(u)}
                            className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold cursor-pointer transition-colors"
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

            {/* Selected User Feature Control & Overrides Panel */}
            {selectedUser && (
              <div className="lg:col-span-5 p-6 rounded-2xl bg-[#060914] border border-[#38BDF8]/30 shadow-2xl space-y-5 animate-in fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display">
                      <Sliders className="w-4 h-4 text-[#38BDF8]" />
                      <span>Individual Feature Overrides</span>
                    </h3>
                    <p className="text-[11px] text-[#A7B8CA]">
                      Configuring overrides for <span className="text-[#38BDF8] font-bold">{selectedUser.email}</span>
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
                    <label className="text-[11px] text-[#A7B8CA] font-bold uppercase block mb-1.5">
                      Custom Storage Quota (MB)
                    </label>
                    <input
                      type="number"
                      value={customStorageMB}
                      onChange={(e) => setCustomStorageMB(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="e.g. 500 (Leave empty to inherit plan default)"
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#38BDF8]"
                    />
                  </div>

                  <div>
                    <span className="text-[11px] text-[#A7B8CA] font-bold uppercase block mb-2">
                      Feature Permissions Overrides:
                    </span>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
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
                    <label className="text-[11px] text-[#A7B8CA] font-bold uppercase block mb-1">
                      Administrative Audit Note
                    </label>
                    <input
                      type="text"
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="e.g. Approved custom trial exception"
                      className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#38BDF8]"
                    />
                  </div>

                  <button
                    onClick={handleSaveOverrides}
                    disabled={isSavingOverrides}
                    className="w-full py-2.5 rounded-xl lg-btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer"
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

      {/* TAB 3: DIRECT MESSAGES WORKSPACE */}
      {activeTab === 'messages' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Message Composer */}
            <div className="lg:col-span-5 p-5 rounded-2xl bg-[#060914] border border-white/10 space-y-4">
              <div className="pb-3 border-b border-white/10">
                <h3 className="text-sm font-bold text-[#F5FAFF] flex items-center gap-2 font-display">
                  <Send className="w-4 h-4 text-[#38BDF8]" />
                  <span>Dispatch Direct Message</span>
                </h3>
                <p className="text-[11px] text-[#A7B8CA]">
                  Persist and deliver an authoritative direct message to a user inbox
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-xs font-bold text-[#F5FAFF] block mb-1">
                    Select Target Recipient
                  </label>
                  <select
                    value={targetRecipientId}
                    onChange={(e) => setTargetRecipientId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white/[0.04] border border-white/15 text-white outline-none focus:border-[#38BDF8]"
                  >
                    <option value="" className="bg-[#060914]">-- Choose User --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id} className="bg-[#060914]">
                        {u.full_name || 'User'} ({u.email}) [{u.role}]
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#F5FAFF] block mb-1">
                    Urgency Priority
                  </label>
                  <select
                    value={messagePriority}
                    onChange={(e) => setMessagePriority(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-white/[0.04] border border-white/15 text-white outline-none focus:border-[#38BDF8]"
                  >
                    <option value="normal" className="bg-[#060914]">Normal Priority</option>
                    <option value="important" className="bg-[#060914]">Important Priority</option>
                    <option value="urgent" className="bg-[#060914]">Urgent Priority</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#F5FAFF] block mb-1">
                    Subject Line
                  </label>
                  <input
                    type="text"
                    value={messageSubject}
                    onChange={(e) => setMessageSubject(e.target.value)}
                    placeholder="e.g. Account Security Review or Quota Update"
                    className="w-full p-2.5 rounded-xl bg-white/[0.04] border border-white/15 text-white outline-none focus:border-[#38BDF8]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#F5FAFF] block mb-1">
                    Message Body (Persisted)
                  </label>
                  <textarea
                    rows={5}
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    placeholder="Enter official message to be stored in the user inbox..."
                    className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/15 text-white outline-none focus:border-[#38BDF8]"
                  />
                </div>

                <button
                  onClick={handleSendAdminMessage}
                  disabled={isSendingMessage || !targetRecipientId || !messageSubject.trim() || !messageBody.trim()}
                  className="w-full py-2.5 rounded-xl lg-btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingMessage ? 'Dispatching...' : 'Dispatch Message'}</span>
                </button>
              </div>
            </div>

            {/* Right: Sent Messages Log with Read Receipts */}
            <div className="lg:col-span-7 p-5 rounded-2xl bg-[#060914] border border-white/10 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-sm font-bold text-[#F5FAFF] font-display">Dispatched Message History</h3>
                  <p className="text-[11px] text-[#A7B8CA]">Verified delivery log with recipient read receipts</p>
                </div>
                <button
                  onClick={refreshAdminMessages}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white cursor-pointer"
                  title="Reload History"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAdminMessages ? 'animate-spin text-[#38BDF8]' : ''}`} />
                </button>
              </div>

              {isLoadingAdminMessages ? (
                <div className="py-12 text-center text-xs text-[#A7B8CA]">Loading dispatched messages...</div>
              ) : adminMessages.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#A7B8CA] rounded-2xl border border-white/5 bg-white/[0.01]">
                  No administrative direct messages sent yet.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                  {adminMessages.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-mono uppercase px-2 py-0.2 rounded-full font-bold ${
                            m.priority === 'urgent' ? 'bg-[#FF3366]/20 text-[#FF3366]' :
                            m.priority === 'important' ? 'bg-amber-500/20 text-amber-300' : 'bg-[#38BDF8]/20 text-[#38BDF8]'
                          }`}>
                            {m.priority}
                          </span>
                          <span className="font-bold text-white truncate">{m.subject}</span>
                        </div>
                        <p className="text-[11px] text-[#A7B8CA] line-clamp-1">{m.body}</p>
                        <div className="text-[10px] text-[#73869A] font-mono flex items-center gap-2">
                          <span>To: <strong>{m.recipient_email || m.recipient_name || m.recipient_user_id}</strong></span>
                          <span>•</span>
                          <span>Sent: {new Date(m.created_at).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {m.read_at ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>Read</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-[#A7B8CA]">
                            Delivered
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ANNOUNCEMENTS WORKSPACE */}
      {activeTab === 'announcements' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Compose Announcement */}
            <div className="lg:col-span-5 p-5 rounded-2xl bg-[#060914] border border-white/10 space-y-4">
              <div className="pb-3 border-b border-white/10">
                <h3 className="text-sm font-bold text-[#F5FAFF] flex items-center gap-2 font-display">
                  <Bell className="w-4 h-4 text-[#FF3366]" />
                  <span>Publish System Announcement</span>
                </h3>
                <p className="text-[11px] text-[#A7B8CA]">
                  Broadcast global or targeted bulletins across the workspace
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-xs font-bold text-[#F5FAFF] block mb-1">
                    Announcement Headline
                  </label>
                  <input
                    type="text"
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    placeholder="e.g. Scheduled Infrastructure Maintenance Window"
                    className="w-full p-2.5 rounded-xl bg-white/[0.04] border border-white/15 text-white outline-none focus:border-[#38BDF8]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold text-[#F5FAFF] block mb-1">
                      Urgency Level
                    </label>
                    <select
                      value={annPriority}
                      onChange={(e) => setAnnPriority(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl bg-white/[0.04] border border-white/15 text-white outline-none focus:border-[#38BDF8]"
                    >
                      <option value="informational" className="bg-[#060914]">Informational (Cyan)</option>
                      <option value="important" className="bg-[#060914]">Important (Amber)</option>
                      <option value="critical" className="bg-[#060914]">Critical (Crimson Red)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#F5FAFF] block mb-1">
                      Target Audience
                    </label>
                    <select
                      value={annAudienceType}
                      onChange={(e) => setAnnAudienceType(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl bg-white/[0.04] border border-white/15 text-white outline-none focus:border-[#38BDF8]"
                    >
                      <option value="all" className="bg-[#060914]">All Workspace Users</option>
                      <option value="plan" className="bg-[#060914]">By Plan Tier</option>
                      <option value="role" className="bg-[#060914]">By Role</option>
                      <option value="user" className="bg-[#060914]">Specific User ID</option>
                    </select>
                  </div>
                </div>

                {annAudienceType !== 'all' && (
                  <div>
                    <label className="text-xs font-bold text-[#F5FAFF] block mb-1">
                      Audience Parameter
                    </label>
                    <input
                      type="text"
                      value={annAudienceRef}
                      onChange={(e) => setAnnAudienceRef(e.target.value)}
                      placeholder={
                        annAudienceType === 'plan' ? 'e.g. pro or enterprise' :
                        annAudienceType === 'role' ? 'e.g. admin or staff' : 'Target User UUID'
                      }
                      className="w-full p-2.5 rounded-xl bg-white/[0.04] border border-white/15 text-white outline-none focus:border-[#38BDF8]"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-[#F5FAFF] block mb-1">
                    Expiration Date (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={annExpiresAt}
                    onChange={(e) => setAnnExpiresAt(e.target.value)}
                    className="w-full p-2 rounded-xl bg-white/[0.04] border border-white/15 text-white outline-none focus:border-[#38BDF8]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#F5FAFF] block mb-1">
                    Bulletin Body (Markdown Supported)
                  </label>
                  <textarea
                    rows={4}
                    value={annBody}
                    onChange={(e) => setAnnBody(e.target.value)}
                    placeholder="Enter detailed notice contents..."
                    className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/15 text-white outline-none focus:border-[#38BDF8]"
                  />
                </div>

                <button
                  onClick={handleCreateAnnouncement}
                  disabled={isCreatingAnn || !annTitle.trim() || !annBody.trim()}
                  className="w-full py-2.5 rounded-xl lg-btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>{isCreatingAnn ? 'Publishing...' : 'Publish Announcement'}</span>
                </button>
              </div>
            </div>

            {/* Right: Published Announcements Table */}
            <div className="lg:col-span-7 p-5 rounded-2xl bg-[#060914] border border-white/10 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-sm font-bold text-[#F5FAFF] font-display">Published Announcements</h3>
                  <p className="text-[11px] text-[#A7B8CA]">Current active bulletins and readership tracking</p>
                </div>
                <button
                  onClick={refreshAdminAnnouncements}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white cursor-pointer"
                  title="Reload Notices"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAdminAnnouncements ? 'animate-spin text-[#38BDF8]' : ''}`} />
                </button>
              </div>

              {isLoadingAdminAnnouncements ? (
                <div className="py-12 text-center text-xs text-[#A7B8CA]">Loading announcements...</div>
              ) : adminAnnouncements.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#A7B8CA] rounded-2xl border border-white/5 bg-white/[0.01]">
                  No system announcements created yet.
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                  {adminAnnouncements.map((ann) => (
                    <div
                      key={ann.id}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 text-xs ${
                        ann.priority === 'critical' ? 'border-[#FF3366]/40 bg-[#FF3366]/[0.05]' :
                        ann.priority === 'important' ? 'border-amber-500/30 bg-amber-500/[0.05]' : 'border-white/10 bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] uppercase px-2 py-0.2 rounded-full font-bold ${
                            ann.priority === 'critical' ? 'bg-[#FF3366] text-white' :
                            ann.priority === 'important' ? 'bg-amber-500/20 text-amber-300' : 'bg-[#38BDF8]/20 text-[#38BDF8]'
                          }`}>
                            {ann.priority}
                          </span>
                          <span className="font-bold text-white">{ann.title}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-[#A7B8CA] px-2 py-0.5 rounded-full bg-white/10">
                            {ann.read_count ?? 0} Readers
                          </span>
                          {!ann.is_archived && (
                            <button
                              onClick={() => handleArchiveAnnouncement(ann.id)}
                              className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-[11px] text-[#A7B8CA] leading-relaxed line-clamp-2">
                        {ann.body}
                      </p>

                      <div className="pt-1 flex items-center justify-between text-[10px] text-[#73869A] font-mono">
                        <span>Audience: <strong>{ann.audience_type} {ann.audience_reference ? `(${ann.audience_reference})` : ''}</strong></span>
                        <span>Published: {new Date(ann.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PLANS & PRICING MANAGEMENT (PRESERVED UNCHANGED) */}
      {activeTab === 'plans' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white font-display">Configurable Subscription Plans</h2>
              <p className="text-xs text-[#A7B8CA]">Administrators can view published tier pricing and quota configurations.</p>
            </div>
            <button
              onClick={refreshPlansAndFeatures}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPlans ? 'animate-spin' : ''}`} />
              <span>Reload Plans</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((p) => (
              <div key={p.id} className="p-5 rounded-2xl bg-[#060914] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-white text-base">{p.name}</h3>
                  <span className="font-mono text-xs text-[#38BDF8] uppercase">{p.slug}</span>
                </div>
                <div className="text-2xl font-black text-white">
                  ${(p.monthly_price_cents / 100).toFixed(2)}
                  <span className="text-xs text-[#A7B8CA] font-normal"> / mo</span>
                </div>
                <p className="text-xs text-[#A7B8CA]">{p.description}</p>
                <div className="text-xs space-y-1.5 border-t border-white/10 pt-3">
                  <div className="flex justify-between">
                    <span className="text-[#A7B8CA]">Storage:</span>
                    <span className="font-bold">{formatFileSize(p.storage_quota_bytes)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A7B8CA]">Monthly Docs:</span>
                    <span className="font-bold">{p.monthly_processing_quota}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A7B8CA]">API Access:</span>
                    <span className="font-bold">{p.has_api_access ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: FEATURE REGISTRY */}
      {activeTab === 'features' && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-white font-display">Centralized Feature Registry</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {features.map((feat) => (
              <div key={feat.id} className="p-4 rounded-2xl bg-[#060914] border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{feat.name}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#38BDF8]/20 text-[#38BDF8] font-bold">
                    {feat.category}
                  </span>
                </div>
                <p className="text-xs text-[#A7B8CA]">{feat.description}</p>
                <div className="text-[10px] font-mono text-[#73869A]">Key: {feat.key}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: UI CONFIGURATION */}
      {activeTab === 'ui' && (
        <div className="space-y-6 max-w-xl">
          <h2 className="text-lg font-bold text-white font-display">Global Workspace UI Customization</h2>
          <div className="p-5 rounded-2xl bg-[#060914] border border-white/10 space-y-4 text-xs">
            <div>
              <label className="text-xs font-bold text-[#F5FAFF] block mb-1">
                Announcement Banner Text
              </label>
              <input
                type="text"
                value={uiConfig.announcement_banner || ''}
                onChange={(e) => setUiConfig({ ...uiConfig, announcement_banner: e.target.value })}
                placeholder="Notice displayed at the top of all user workspaces"
                className="w-full p-2.5 rounded-xl bg-white/[0.04] border border-white/15 text-white outline-none focus:border-[#38BDF8]"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div>
                <span className="font-bold text-white block">Emergency Maintenance Mode</span>
                <span className="text-[11px] text-[#A7B8CA]">Restricts regular studio actions to administrators only</span>
              </div>
              <input
                type="checkbox"
                checked={uiConfig.maintenance_mode || false}
                onChange={(e) => setUiConfig({ ...uiConfig, maintenance_mode: e.target.checked })}
                className="w-4 h-4 accent-[#FF3366] cursor-pointer"
              />
            </div>

            <button
              onClick={handleSaveUiConfig}
              disabled={isSavingUi}
              className="lg-btn-primary text-xs py-2 px-4 cursor-pointer"
            >
              {isSavingUi ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 8: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white font-display">System Audit Trail</h2>
            <button
              onClick={refreshAuditLogs}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAudit ? 'animate-spin' : ''}`} />
              <span>Reload Logs</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#060914]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-[#A7B8CA] font-mono text-[10px] uppercase bg-white/[0.02]">
                <tr>
                  <th className="p-3 pl-4">Timestamp</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Target</th>
                  <th className="p-3">User</th>
                  <th className="p-3 pr-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02]">
                    <td className="p-3 pl-4 text-[#A7B8CA]">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="p-3 text-[#38BDF8] font-bold">{log.action}</td>
                    <td className="p-3 text-white">{log.target_type || '-'}</td>
                    <td className="p-3 text-[#A7B8CA]">{log.user_id || 'System'}</td>
                    <td className="p-3 pr-4 text-[#A7B8CA] truncate max-w-xs">{log.details_json}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUSPENSION MODAL (ACCESSIBLE, REPLACES WINDOW.PROMPT) */}
      {suspensionModalUser && (
        <div className="fixed inset-0 z-50 bg-[#03050C]/85 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in">
          <div className="lg-primary border border-rose-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-[#F5FAFF]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-display">Confirm Account Suspension</h3>
                <p className="text-xs text-[#A7B8CA] font-mono truncate">{suspensionModalUser.email}</p>
              </div>
            </div>

            <p className="text-xs text-[#A7B8CA] leading-relaxed">
              Suspending this account will immediately revoke all active JWT tokens, block login, and freeze processing pipelines.
            </p>

            <div>
              <label className="text-xs font-bold text-[#F5FAFF] block mb-1.5">
                Reason for Suspension (Recorded in Audit Trail)
              </label>
              <input
                type="text"
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                placeholder="e.g. Terms of service violation, billing dispute"
                className="w-full p-2.5 rounded-xl bg-white/[0.04] border border-white/15 text-white text-xs outline-none focus:border-rose-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setSuspensionModalUser(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-[#A7B8CA] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSuspension}
                disabled={isSubmittingSuspension}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                {isSubmittingSuspension ? 'Suspending...' : 'Confirm Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {isCreateUserOpen && (
        <div className="fixed inset-0 z-50 bg-[#03050C]/85 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in">
          <form onSubmit={handleCreateUser} className="lg-primary border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-[#F5FAFF]">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white font-display">Provision New User Account</h3>
              <button
                type="button"
                onClick={() => setIsCreateUserOpen(false)}
                className="p-1 rounded-lg text-[#A7B8CA] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#F5FAFF] block mb-1">Full Name</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Taylor Swift"
                  className="w-full p-2.5 rounded-xl bg-white/[0.04] border border-white/15 text-white outline-none focus:border-[#38BDF8]"
                />
              </div>

              <div>
                <label className="font-bold text-[#F5FAFF] block mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="taylor@company.com"
                  className="w-full p-2.5 rounded-xl bg-white/[0.04] border border-white/15 text-white outline-none focus:border-[#38BDF8]"
                />
              </div>

              <div>
                <label className="font-bold text-[#F5FAFF] block mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full p-2.5 rounded-xl bg-white/[0.04] border border-white/15 text-white outline-none focus:border-[#38BDF8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-[#F5FAFF] block mb-1">Role</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-[#060914] border border-white/15 text-white outline-none focus:border-[#38BDF8]"
                  >
                    <option value="user">User</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[#F5FAFF] block mb-1">Plan Tier</label>
                  <select
                    value={newUserPlan}
                    onChange={(e) => setNewUserPlan(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-[#060914] border border-white/15 text-white outline-none focus:border-[#38BDF8]"
                  >
                    <option value="free">Free Community</option>
                    <option value="starter">Starter Pro</option>
                    <option value="pro">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsCreateUserOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-[#A7B8CA] hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingUser}
                className="lg-btn-primary text-xs py-2 px-4 cursor-pointer"
              >
                {isCreatingUser ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
