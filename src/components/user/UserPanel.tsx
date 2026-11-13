import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  ShieldCheck, 
  HardDrive, 
  Key, 
  Sparkles, 
  CheckCircle2, 
  CreditCard, 
  Lock, 
  Trash2, 
  Download, 
  Save, 
  Check, 
  Copy,
  Zap,
  Globe,
  LogOut,
  AlertCircle,
  Plus,
  RefreshCw,
  Mail,
  Bell,
  MessageSquare,
  Archive,
  ArrowLeft,
  Send,
  Calendar,
  Layers,
  FileText,
  AlertTriangle,
  Info
} from 'lucide-react';
import { UserSession, purgeAllLocalData } from '../../services/storageService';
import { formatFileSize } from '../../services/formatDetector';
import { useToast } from '../../services/toastService';
import { omniDocClient } from '../../sdk/omnidocClient';
import { DirectMessage, Announcement } from '../../types';

interface UserPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userSession: UserSession;
  onUpdateSession: (newSession: UserSession) => void;
  totalStorageBytes: number;
  totalProjectsCount: number;
  onLogout?: () => void;
  initialTab?: UserPanelTab;
}

export type UserPanelTab = 
  | 'overview' 
  | 'inbox' 
  | 'announcements' 
  | 'profile' 
  | 'plan' 
  | 'security' 
  | 'api' 
  | 'privacy';

interface ApiKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string;
  rate_limit_rpm: number;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export const UserPanel: React.FC<UserPanelProps> = ({
  isOpen,
  onClose,
  userSession,
  onUpdateSession,
  totalStorageBytes,
  totalProjectsCount,
  onLogout,
  initialTab = 'overview',
}) => {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<UserPanelTab>(initialTab);
  const [userName, setUserName] = useState(userSession.userName || '');
  const [userEmail, setUserEmail] = useState(userSession.userEmail || '');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(
    userSession.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
  );

  // Profile Save State
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Backend Usage & Entitlements
  const [backendUsage, setBackendUsage] = useState<any>(null);
  const [backendEntitlements, setBackendEntitlements] = useState<any>(null);
  const [billingStatus, setBillingStatus] = useState<any>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);

  // API Keys State
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [createdKeySecret, setCreatedKeySecret] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Security & Privacy State
  const [autoSave, setAutoSave] = useState(true);
  const [autoPurge, setAutoPurge] = useState(false);
  const [aiConsentEnabled, setAiConsentEnabled] = useState(true);
  const [marketingConsentEnabled, setMarketingConsentEnabled] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Direct Messages (Inbox) State
  const [inboxMessages, setInboxMessages] = useState<DirectMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoadingInbox, setIsLoadingInbox] = useState<boolean>(false);
  const [selectedMessage, setSelectedMessage] = useState<DirectMessage | null>(null);
  const [inboxSearch, setInboxSearch] = useState<string>('');
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [replyText, setReplyText] = useState<string>('');
  const [isReplying, setIsReplying] = useState<boolean>(false);

  // Announcements State
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState<boolean>(false);

  // Load real data when panel opens
  useEffect(() => {
    if (!isOpen) return;

    // Fetch user profile from backend
    omniDocClient.getProfile()
      .then((profile) => {
        if (profile) {
          setUserName(profile.full_name || userSession.userName || '');
          setUserEmail(profile.email || userSession.userEmail || '');
        }
      })
      .catch(() => {});

    // Fetch usage and entitlements
    setIsLoadingMetrics(true);
    Promise.all([
      omniDocClient.getMyUsage().catch(() => null),
      omniDocClient.getMyEntitlements().catch(() => null),
      omniDocClient.getBillingStatus().catch(() => null),
    ]).then(([usage, entitlements, billing]) => {
      if (usage) setBackendUsage(usage);
      if (entitlements) setBackendEntitlements(entitlements);
      if (billing) setBillingStatus(billing);
      setIsLoadingMetrics(false);
    });

    // Fetch real API keys
    setIsLoadingKeys(true);
    omniDocClient.getApiKeys()
      .then((keys) => {
        if (Array.isArray(keys)) setApiKeys(keys);
      })
      .catch(() => setApiKeys([]))
      .finally(() => setIsLoadingKeys(false));

    // Fetch initial inbox counts
    refreshInbox();
    // Fetch initial announcements
    refreshAnnouncements();
  }, [isOpen, userSession.userName, userSession.userEmail]);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const refreshInbox = async () => {
    setIsLoadingInbox(true);
    try {
      const res = await omniDocClient.getMyInbox({
        include_archived: showArchived,
        search: inboxSearch.trim() || undefined,
      });
      setInboxMessages(res.items);
      setUnreadCount(res.unread_count);
    } catch (err: any) {
      console.warn('Could not load inbox:', err);
    } finally {
      setIsLoadingInbox(false);
    }
  };

  const refreshAnnouncements = async () => {
    setIsLoadingAnnouncements(true);
    try {
      const res = await omniDocClient.getActiveAnnouncements({ include_dismissed: true });
      setAnnouncements(res.items);
    } catch (err: any) {
      console.warn('Could not load announcements:', err);
    } finally {
      setIsLoadingAnnouncements(false);
    }
  };

  const handleMarkMessageRead = async (msgId: string) => {
    try {
      const updated = await omniDocClient.markMessageRead(msgId);
      setInboxMessages((prev) => prev.map((m) => (m.id === msgId ? updated : m)));
      if (selectedMessage?.id === msgId) {
        setSelectedMessage(updated);
      }
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      addToast('error', 'Update Failed', err.message);
    }
  };

  const handleArchiveMessage = async (msgId: string) => {
    try {
      const updated = await omniDocClient.archiveMessage(msgId);
      if (showArchived) {
        setInboxMessages((prev) => prev.map((m) => (m.id === msgId ? updated : m)));
      } else {
        setInboxMessages((prev) => prev.filter((m) => m.id !== msgId));
      }
      if (selectedMessage?.id === msgId) {
        setSelectedMessage(null);
      }
      addToast('info', 'Message Archived', 'The conversation has been moved to archive.');
    } catch (err: any) {
      addToast('error', 'Archive Failed', err.message);
    }
  };

  const handleSendReply = async () => {
    if (!selectedMessage || !replyText.trim()) return;
    setIsReplying(true);
    try {
      await omniDocClient.replyToMessage(selectedMessage.id, replyText.trim());
      setReplyText('');
      addToast('success', 'Reply Dispatched', 'Your message has been delivered to administrators.');
      refreshInbox();
    } catch (err: any) {
      addToast('error', 'Reply Failed', err.message || 'Could not send reply.');
    } finally {
      setIsReplying(false);
    }
  };

  const handleMarkAnnouncementRead = async (annId: string) => {
    try {
      await omniDocClient.markAnnouncementRead(annId);
      setAnnouncements((prev) => prev.map((a) => (a.id === annId ? { ...a, is_read: true } : a)));
    } catch (err: any) {
      addToast('error', 'Failed', err.message);
    }
  };

  const handleDismissAnnouncement = async (annId: string) => {
    try {
      await omniDocClient.dismissAnnouncement(annId);
      setAnnouncements((prev) => prev.filter((a) => a.id !== annId));
      addToast('info', 'Dismissed', 'Notice dismissed from your dashboard.');
    } catch (err: any) {
      addToast('error', 'Dismiss Failed', err.message);
    }
  };

  if (!isOpen) return null;

  const avatarOptions = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop&q=80',
  ];

  const handleSaveProfile = async () => {
    if (!userName.trim()) {
      addToast('error', 'Validation Error', 'Full Name cannot be empty.');
      return;
    }
    setIsSavingProfile(true);
    try {
      await omniDocClient.updateProfile(userName.trim());
      onUpdateSession({
        ...userSession,
        userName: userName.trim(),
        avatarUrl: selectedAvatar,
      });
      addToast('success', 'Profile Updated', 'Your identity preferences were saved to the backend database.');
    } catch (err: any) {
      addToast('error', 'Update Failed', err.message || 'Could not update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      addToast('error', 'Validation Error', 'Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      addToast('error', 'Validation Error', 'New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast('error', 'Validation Error', 'New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await omniDocClient.changePassword(currentPassword, newPassword);
      addToast('success', 'Password Updated', 'Your password has been changed securely.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      addToast('error', 'Password Change Failed', err.message || 'Could not change password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) {
      addToast('error', 'Validation Error', 'Please provide a name for this API key.');
      return;
    }
    setIsCreatingKey(true);
    try {
      const res = await omniDocClient.createApiKey(newKeyName.trim());
      setCreatedKeySecret(res.api_key);
      setNewKeyName('');
      const updatedKeys = await omniDocClient.getApiKeys();
      setApiKeys(updatedKeys);
      addToast('success', 'API Key Created', 'Make sure to copy your secret key now. It will not be shown again.');
    } catch (err: any) {
      addToast('error', 'Key Creation Failed', err.message || 'Could not generate API key.');
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleRevokeApiKey = async (keyId: string, keyName: string) => {
    if (!confirm(`Are you sure you want to revoke API key "${keyName}"? All services using this key will immediately lose access.`)) {
      return;
    }
    try {
      await omniDocClient.revokeApiKey(keyId);
      setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
      addToast('info', 'Key Revoked', `API key "${keyName}" has been permanently disabled.`);
    } catch (err: any) {
      addToast('error', 'Revocation Failed', err.message || 'Could not revoke API key.');
    }
  };

  const handlePlanCheckout = async (tier: string, name: string) => {
    addToast(
      'info',
      'Free Community Tier Active',
      `Card payments are currently disabled. Your organization has full access to core conversion, OCR, and document intelligence tools under the Community plan. For custom enterprise quotas, contact sales@omnidoc.studio.`
    );
  };

  const handleExportUserData = async () => {
    try {
      const [profile, history] = await Promise.all([
        omniDocClient.getProfile().catch(() => ({ email: userEmail, full_name: userName })),
        omniDocClient.getConsentHistory().catch(() => []),
      ]);
      const exportBlob = new Blob(
        [JSON.stringify({ profile, consent_history: history, export_timestamp: new Date().toISOString() }, null, 2)],
        { type: 'application/json' }
      );
      const url = URL.createObjectURL(exportBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `omnidoc_user_data_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', 'Export Ready', 'Your verified account data has been downloaded.');
    } catch (err: any) {
      addToast('error', 'Export Failed', 'Could not export user data.');
    }
  };

  const handlePurgeAllData = () => {
    if (confirm('Are you sure you want to permanently delete all local projects, conversions, and cache?')) {
      purgeAllLocalData();
      addToast('warning', 'Data Purged', 'All local memory and records have been wiped.');
      window.location.reload();
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you absolutely certain you want to delete your OmniDoc Studio account? This action will deactivate your credentials, revoke active sessions, and request data erasure under GDPR/CCPA.')) {
      return;
    }
    setIsDeletingAccount(true);
    try {
      await omniDocClient.deleteAccount();
      addToast('warning', 'Account Deactivated', 'Your account has been successfully deactivated.');
      onClose();
      if (onLogout) onLogout();
    } catch (err: any) {
      addToast('error', 'Deletion Failed', err.message || 'Could not process account deletion.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleToggleAiConsent = async (val: boolean) => {
    setAiConsentEnabled(val);
    try {
      if (val) {
        await omniDocClient.updateConsent({ ai_consent: true });
        addToast('success', 'Consent Granted', 'Autonomous AI document intelligence consent has been recorded.');
      } else {
        await omniDocClient.withdrawConsent('ai_processing');
        addToast('warning', 'Consent Withdrawn', 'Autonomous AI processing consent has been revoked.');
      }
    } catch (err: any) {
      addToast('error', 'Consent Update Failed', err.message);
    }
  };

  // Authoritative Quota Calculation
  const planDefaultQuota: Record<string, number> = {
    free: 100 * 1024 * 1024,
    starter: 1024 * 1024 * 1024,
    pro: 10 * 1024 * 1024 * 1024,
    enterprise: 100 * 1024 * 1024 * 1024,
  };
  const maxQuotaBytes = backendEntitlements?.storage_quota_bytes ?? (planDefaultQuota[userSession.planTier || 'free'] || 100 * 1024 * 1024);
  const currentUsedBytes = backendUsage?.storage_used_bytes ?? totalStorageBytes;
  const quotaPct = Math.min(100, Math.max(1, Math.round((currentUsedBytes / maxQuotaBytes) * 100)));

  // PRESERVED PRICING PLANS EXACTLY AS DEFINED
  const authoritativePlans = [
    {
      tier: 'free',
      name: 'Free Community',
      monthlyPrice: '$0',
      annualPrice: '$0',
      annualTotal: '$0/yr',
      period: 'forever',
      badge: 'COMMUNITY',
      maxSize: '25 MB max file',
      storage: '100 MB vault',
      monthlyProcessing: '50 jobs/mo',
      desc: 'Essential document viewing and basic conversions for individuals.',
    },
    {
      tier: 'starter',
      name: 'Starter Pro',
      monthlyPrice: '$19',
      annualPrice: '$15.83',
      annualTotal: '$190/yr',
      period: '/month',
      badge: 'STARTER',
      maxSize: '50 MB max file',
      storage: '1 GB vault',
      monthlyProcessing: '250 jobs/mo',
      desc: 'Extended document workflows, OCR scanning, and visual presentations.',
    },
    {
      tier: 'pro',
      name: 'Professional Suite',
      monthlyPrice: '$49',
      annualPrice: '$40.83',
      annualTotal: '$490/yr',
      period: '/month',
      badge: 'MOST POPULAR',
      maxSize: '100 MB max file',
      storage: '10 GB vault',
      monthlyProcessing: '1,500 jobs/mo',
      desc: 'Complete Autonomous Document Engineering with AI intelligence and API access.',
    },
    {
      tier: 'enterprise',
      name: 'Enterprise Cloud',
      monthlyPrice: '$199',
      annualPrice: '$165.83',
      annualTotal: '$1,990/yr',
      period: '/month',
      badge: 'ENTERPRISE',
      maxSize: '500 MB max file',
      storage: '100 GB vault',
      monthlyProcessing: 'Unlimited',
      desc: 'Unlimited capacity, bespoke workflows, maximum security, and dedicated support.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#03050C]/85 backdrop-blur-2xl flex items-center justify-center p-3 sm:p-5 select-none animate-in fade-in">
      <div className="lg-primary border border-white/15 rounded-[28px] max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl text-[#F5FAFF]">
        {/* Header Bar */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF3366]/20 to-[#38BDF8]/20 border border-[#38BDF8]/30 text-[#38BDF8] flex items-center justify-center font-bold shadow-md shadow-[#38BDF8]/20 shrink-0">
              <User className="w-5 h-5 text-[#38BDF8]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-[#F5FAFF] leading-tight font-display">
                  User Workspace &amp; Communications
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#38BDF8]/15 border border-[#38BDF8]/30 text-[#38BDF8] font-bold uppercase">
                  {userSession.role || 'Member'}
                </span>
              </div>
              <p className="text-xs text-[#A7B8CA]">
                Manage verified account identity, direct administrator messages, notices, and quotas
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 text-[#A7B8CA] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
            title="Close Panel"
            aria-label="Close user panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-4 border-b border-white/10 bg-white/[0.02] gap-1 overflow-x-auto text-xs font-semibold text-[#A7B8CA] custom-scrollbar">
          {/* Overview */}
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-[#38BDF8] text-[#38BDF8] font-bold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Overview</span>
          </button>

          {/* Inbox (New Direct Messaging) */}
          <button
            onClick={() => {
              setActiveTab('inbox');
              refreshInbox();
            }}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'inbox'
                ? 'border-[#38BDF8] text-[#38BDF8] font-bold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Inbox</span>
            {unreadCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#FF3366] text-white font-black animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Announcements (New Announcement Centre) */}
          <button
            onClick={() => {
              setActiveTab('announcements');
              refreshAnnouncements();
            }}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'announcements'
                ? 'border-[#38BDF8] text-[#38BDF8] font-bold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Announcements</span>
            {announcements.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#38BDF8]/20 border border-[#38BDF8]/40 text-[#38BDF8] font-bold">
                {announcements.length}
              </span>
            )}
          </button>

          {/* Profile */}
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-[#38BDF8] text-[#38BDF8] font-bold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profile</span>
          </button>

          {/* Plans & Quota (Untouched Pricing System) */}
          <button
            onClick={() => setActiveTab('plan')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'plan'
                ? 'border-[#38BDF8] text-[#38BDF8] font-bold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4 text-[#38BDF8]" />
            <span>Plans &amp; Quota</span>
          </button>

          {/* Security */}
          <button
            onClick={() => setActiveTab('security')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'security'
                ? 'border-[#38BDF8] text-[#38BDF8] font-bold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Security</span>
          </button>

          {/* API Keys */}
          <button
            onClick={() => setActiveTab('api')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'api'
                ? 'border-[#38BDF8] text-[#38BDF8] font-bold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>API Keys</span>
          </button>

          {/* Privacy */}
          <button
            onClick={() => setActiveTab('privacy')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'privacy'
                ? 'border-[#38BDF8] text-[#38BDF8] font-bold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Privacy</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">

          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Identity Banner */}
              <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.03] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img
                    src={selectedAvatar}
                    alt={userName}
                    className="w-14 h-14 rounded-2xl object-cover ring-2 ring-[#38BDF8]/40 shadow-md"
                  />
                  <div>
                    <h3 className="text-base font-bold text-[#F5FAFF] font-display">
                      {userName || 'Studio User'}
                    </h3>
                    <p className="text-xs text-[#A7B8CA]">{userEmail}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono font-bold">
                        Isolated Vault Active
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#A7B8CA] font-mono">
                        Tier: {(userSession.planTier || 'free').toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('profile')}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/15 text-xs text-[#F5FAFF] font-semibold border border-white/10 transition-colors cursor-pointer"
                >
                  Edit Profile
                </button>
              </div>

              {/* Real Storage Quota */}
              <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="font-bold text-[#F5FAFF] flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-[#38BDF8]" />
                    <span>Vault Storage Allocation</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                      userSession.authSource === 'backend' || backendUsage?.storage_used_bytes != null
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30'
                    }`}>
                      {userSession.authSource === 'backend' || backendUsage?.storage_used_bytes != null
                        ? 'Backend Vault Storage'
                        : 'Browser Storage Sandbox'}
                    </span>
                  </div>
                  <div className="font-mono text-[#A7B8CA] font-semibold">
                    {formatFileSize(currentUsedBytes)} / {formatFileSize(maxQuotaBytes)} ({quotaPct}%)
                  </div>
                </div>

                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      quotaPct > 90 ? 'bg-rose-500' : 'bg-gradient-to-r from-[#FF3366] to-[#38BDF8]'
                    }`}
                    style={{ width: `${quotaPct}%` }}
                  />
                </div>
              </div>

              {/* Communications Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Direct Messages Card */}
                <div 
                  onClick={() => {
                    setActiveTab('inbox');
                    refreshInbox();
                  }}
                  className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:border-[#38BDF8]/40 transition-all cursor-pointer group space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-[#38BDF8]/15 text-[#38BDF8] flex items-center justify-center">
                      <Mail className="w-4 h-4" />
                    </div>
                    {unreadCount > 0 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF3366] text-white font-bold">
                        {unreadCount} UNREAD
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#A7B8CA] font-mono">
                        Up to date
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#F5FAFF] group-hover:text-[#38BDF8] transition-colors">
                      Administrative Direct Messages
                    </h4>
                    <p className="text-[11px] text-[#A7B8CA] mt-0.5">
                      {inboxMessages.length} total messages in vault. Click to inspect conversations or send replies.
                    </p>
                  </div>
                </div>

                {/* Announcements Card */}
                <div 
                  onClick={() => {
                    setActiveTab('announcements');
                    refreshAnnouncements();
                  }}
                  className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:border-[#FF3366]/40 transition-all cursor-pointer group space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-[#FF3366]/15 text-[#FF3366] flex items-center justify-center">
                      <Bell className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#A7B8CA] font-mono">
                      {announcements.length} active
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#F5FAFF] group-hover:text-[#FF3366] transition-colors">
                      System &amp; Workspace Notices
                    </h4>
                    <p className="text-[11px] text-[#A7B8CA] mt-0.5">
                      Platform updates, scheduled maintenance windows, and security announcements.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: INBOX (DIRECT ADMIN MESSAGING) */}
          {activeTab === 'inbox' && (
            <div className="space-y-4">
              {/* Header and Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#F5FAFF] font-display">Direct Admin Messages</h3>
                  {unreadCount > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF3366] text-white font-black">
                      {unreadCount} Unread
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-48">
                    <input
                      type="text"
                      placeholder="Search messages..."
                      value={inboxSearch}
                      onChange={(e) => setInboxSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && refreshInbox()}
                      className="w-full text-xs py-1.5 px-3 pl-8 rounded-xl bg-white/[0.04] border border-white/15 text-[#F5FAFF] placeholder:text-[#A7B8CA]/50 focus:border-[#38BDF8] outline-none"
                    />
                    <MessageSquare className="w-3.5 h-3.5 text-[#A7B8CA] absolute left-2.5 top-2" />
                  </div>

                  <button
                    onClick={() => {
                      setShowArchived(!showArchived);
                      setTimeout(refreshInbox, 50);
                    }}
                    className={`text-xs px-2.5 py-1.5 rounded-xl border transition-colors cursor-pointer flex items-center gap-1 ${
                      showArchived
                        ? 'bg-[#38BDF8]/20 border-[#38BDF8]/40 text-[#38BDF8]'
                        : 'bg-white/[0.04] border-white/10 text-[#A7B8CA] hover:text-white'
                    }`}
                  >
                    <Archive className="w-3 h-3" />
                    <span>Archived</span>
                  </button>

                  <button
                    onClick={refreshInbox}
                    className="p-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-[#A7B8CA] hover:text-white transition-colors cursor-pointer"
                    title="Refresh Messages"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingInbox ? 'animate-spin text-[#38BDF8]' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Message Viewer Modal / Thread */}
              {selectedMessage ? (
                <div className="p-5 rounded-2xl border border-white/15 bg-white/[0.03] space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <button
                      onClick={() => setSelectedMessage(null)}
                      className="text-xs text-[#38BDF8] hover:text-[#FF3366] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Messages</span>
                    </button>

                    <div className="flex items-center gap-2">
                      {!selectedMessage.read_at && (
                        <button
                          onClick={() => handleMarkMessageRead(selectedMessage.id)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>Mark Read</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleArchiveMessage(selectedMessage.id)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[#A7B8CA] hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Archive className="w-3 h-3" />
                        <span>Archive</span>
                      </button>
                    </div>
                  </div>

                  {/* Subject & Metadata */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold ${
                        selectedMessage.priority === 'urgent'
                          ? 'bg-[#FF3366]/20 border border-[#FF3366]/40 text-[#FF3366]'
                          : selectedMessage.priority === 'important'
                            ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                            : 'bg-[#38BDF8]/20 border border-[#38BDF8]/40 text-[#38BDF8]'
                      }`}>
                        {selectedMessage.priority}
                      </span>
                      <h4 className="text-base font-bold text-[#F5FAFF] font-display">
                        {selectedMessage.subject}
                      </h4>
                    </div>
                    <div className="text-[11px] text-[#A7B8CA] flex items-center gap-2 pt-1">
                      <span>From: <strong>{selectedMessage.sender_name || selectedMessage.sender_email || 'OmniDoc Operations'}</strong></span>
                      <span>•</span>
                      <span>{new Date(selectedMessage.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 rounded-xl bg-black/40 border border-white/10 text-xs text-[#F5FAFF] leading-relaxed whitespace-pre-wrap">
                    {selectedMessage.body}
                  </div>

                  {/* Reply Box */}
                  <div className="pt-2 space-y-2">
                    <label className="text-xs font-bold text-[#F5FAFF] block">
                      Respond to Administrator
                    </label>
                    <textarea
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your response to the administration team..."
                      className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/15 text-xs text-[#F5FAFF] placeholder:text-[#A7B8CA]/50 focus:border-[#38BDF8] outline-none"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleSendReply}
                        disabled={isReplying || !replyText.trim()}
                        className="lg-btn-primary text-xs flex items-center gap-1.5 py-1.5 px-4"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isReplying ? 'Sending...' : 'Send Response'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Message List */
                <div className="space-y-2">
                  {isLoadingInbox ? (
                    <div className="py-12 text-center text-xs text-[#A7B8CA]">
                      <RefreshCw className="w-6 h-6 animate-spin text-[#38BDF8] mx-auto mb-2" />
                      <span>Loading messages...</span>
                    </div>
                  ) : inboxMessages.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl border border-white/10 bg-white/[0.02] space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/15 flex items-center justify-center text-[#A7B8CA] mx-auto">
                        <Mail className="w-6 h-6 text-[#38BDF8]" />
                      </div>
                      <p className="text-xs font-bold text-[#F5FAFF]">No Direct Messages</p>
                      <p className="text-[11px] text-[#A7B8CA] max-w-sm mx-auto">
                        Your administrative inbox is clean. Messages sent directly from platform administrators will appear here.
                      </p>
                    </div>
                  ) : (
                    inboxMessages.map((msg) => {
                      const isUnread = !msg.read_at;
                      return (
                        <div
                          key={msg.id}
                          onClick={() => {
                            setSelectedMessage(msg);
                            if (isUnread) handleMarkMessageRead(msg.id);
                          }}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer group flex items-start justify-between gap-3 ${
                            isUnread
                              ? 'border-[#38BDF8]/40 bg-[#38BDF8]/[0.06] hover:bg-[#38BDF8]/[0.10]'
                              : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                              msg.priority === 'urgent'
                                ? 'bg-[#FF3366]/20 text-[#FF3366]'
                                : msg.priority === 'important'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-[#38BDF8]/20 text-[#38BDF8]'
                            }`}>
                              <Mail className="w-4 h-4" />
                            </div>

                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[#F5FAFF] group-hover:text-[#38BDF8] transition-colors truncate">
                                  {msg.subject}
                                </span>
                                {isUnread && (
                                  <span className="w-2 h-2 rounded-full bg-[#FF3366] shrink-0" />
                                )}
                              </div>
                              <p className="text-[11px] text-[#A7B8CA] line-clamp-1">
                                {msg.body}
                              </p>
                              <div className="text-[10px] text-[#73869A] flex items-center gap-2 pt-0.5 font-mono">
                                <span>{msg.sender_name || 'Admin'}</span>
                                <span>•</span>
                                <span>{new Date(msg.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-mono font-bold ${
                              msg.priority === 'urgent'
                                ? 'bg-[#FF3366]/20 text-[#FF3366]'
                                : msg.priority === 'important'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-[#38BDF8]/20 text-[#38BDF8]'
                            }`}>
                              {msg.priority}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB: ANNOUNCEMENTS CENTRE */}
          {activeTab === 'announcements' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-sm font-bold text-[#F5FAFF] font-display">System &amp; Workspace Notices</h3>
                  <p className="text-[11px] text-[#A7B8CA]">Platform notifications and critical operational bulletins</p>
                </div>

                <button
                  onClick={refreshAnnouncements}
                  className="p-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-[#A7B8CA] hover:text-white transition-colors cursor-pointer"
                  title="Refresh Notices"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAnnouncements ? 'animate-spin text-[#38BDF8]' : ''}`} />
                </button>
              </div>

              {isLoadingAnnouncements ? (
                <div className="py-12 text-center text-xs text-[#A7B8CA]">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#38BDF8] mx-auto mb-2" />
                  <span>Loading announcements...</span>
                </div>
              ) : announcements.length === 0 ? (
                <div className="py-12 text-center rounded-2xl border border-white/10 bg-white/[0.02] space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/15 flex items-center justify-center text-[#A7B8CA] mx-auto">
                    <Bell className="w-6 h-6 text-[#38BDF8]" />
                  </div>
                  <p className="text-xs font-bold text-[#F5FAFF]">All Clear</p>
                  <p className="text-[11px] text-[#A7B8CA] max-w-sm mx-auto">
                    There are no active system maintenance notices or critical bulletins targeted to your account.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {announcements.map((ann) => (
                    <div
                      key={ann.id}
                      className={`p-4 rounded-2xl border transition-all space-y-2 ${
                        ann.priority === 'critical'
                          ? 'border-[#FF3366]/50 bg-[#FF3366]/[0.08] shadow-lg shadow-[#FF3366]/10'
                          : ann.priority === 'important'
                            ? 'border-amber-500/40 bg-amber-500/[0.05]'
                            : 'border-[#38BDF8]/40 bg-[#38BDF8]/[0.05]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            ann.priority === 'critical'
                              ? 'bg-[#FF3366] text-white'
                              : ann.priority === 'important'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40'
                          }`}>
                            {ann.priority}
                          </span>
                          <h4 className="text-xs sm:text-sm font-bold text-[#F5FAFF] font-display">
                            {ann.title}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2">
                          {ann.is_read ? (
                            <span className="text-[10px] font-mono text-[#A7B8CA] flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Read</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleMarkAnnouncementRead(ann.id)}
                              className="text-[11px] font-semibold text-[#38BDF8] hover:text-white px-2 py-0.5 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                            >
                              Mark Read
                            </button>
                          )}

                          {ann.priority !== 'critical' && (
                            <button
                              onClick={() => handleDismissAnnouncement(ann.id)}
                              className="text-[11px] text-[#A7B8CA] hover:text-rose-400 px-2 py-0.5 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                              title="Dismiss Notice"
                            >
                              Dismiss
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-[#A7B8CA] leading-relaxed whitespace-pre-wrap">
                        {ann.body}
                      </p>

                      <div className="pt-1 flex items-center justify-between text-[10px] text-[#73869A] font-mono">
                        <span>Published: {new Date(ann.created_at).toLocaleDateString()}</span>
                        {ann.expires_at && (
                          <span>Expires: {new Date(ann.expires_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Avatar Chooser */}
              <div>
                <label className="text-xs font-bold text-[#F5FAFF] block mb-2">
                  Spatial Avatar Profile
                </label>
                <div className="flex flex-wrap gap-3">
                  {avatarOptions.map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedAvatar(opt)}
                      className={`relative w-12 h-12 rounded-2xl overflow-hidden cursor-pointer transition-all ${
                        selectedAvatar === opt
                          ? 'ring-2 ring-[#38BDF8] scale-105 shadow-md shadow-[#38BDF8]/30'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={opt} alt="Avatar option" className="w-full h-full object-cover" />
                      {selectedAvatar === opt && (
                        <div className="absolute inset-0 bg-[#38BDF8]/20 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Identity Form */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[#F5FAFF] block mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="w-full p-2.5 rounded-xl border border-white/15 bg-white/[0.04] focus:border-[#38BDF8] outline-none text-[#F5FAFF] text-xs placeholder:text-[#A7B8CA]/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#F5FAFF] block mb-1.5">
                    Account Email
                  </label>
                  <input
                    type="email"
                    value={userEmail}
                    disabled
                    className="w-full p-2.5 rounded-xl border border-white/10 bg-white/[0.02] text-[#A7B8CA] text-xs font-mono cursor-not-allowed"
                  />
                  <p className="text-[11px] text-[#A7B8CA] mt-1">
                    Verified organization email identity. Contact your security administrator to request email alteration.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className="lg-btn-primary flex items-center gap-2 text-xs py-2 px-5"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingProfile ? 'Saving Changes...' : 'Save Profile Preferences'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB: PLAN & QUOTA (PRESERVED EXACTLY AS AUTHORITATIVE) */}
          {activeTab === 'plan' && (
            <div className="space-y-6">
              {/* Storage Quota Usage */}
              <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="font-bold text-[#F5FAFF] flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-[#38BDF8]" />
                    <span>Storage Quota</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                      userSession.authSource === 'backend' || backendUsage?.storage_used_bytes != null
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30'
                    }`}>
                      {userSession.authSource === 'backend' || backendUsage?.storage_used_bytes != null
                        ? 'Cloud Vault (Supabase)'
                        : 'Local Sandbox (IndexedDB)'}
                    </span>
                  </div>
                  <div className="font-mono text-[#A7B8CA] font-semibold">
                    {formatFileSize(currentUsedBytes)} / {formatFileSize(maxQuotaBytes)} ({quotaPct}%)
                  </div>
                </div>

                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      quotaPct > 90 ? 'bg-rose-500' : 'bg-gradient-to-r from-[#38BDF8] to-[#38BDF8]'
                    }`}
                    style={{ width: `${quotaPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#A7B8CA] pt-0.5">
                  <span>{backendUsage?.documents_count ?? totalProjectsCount} documents stored</span>
                  <span className="text-[#38BDF8] font-semibold">
                    Active Plan: {(backendEntitlements?.plan_name || userSession.planTier || 'Free Community').toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Billing Cycle Switcher */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="text-xs font-bold text-[#F5FAFF]">Billing Cadence</span>
                <div className="flex items-center gap-1 bg-white/[0.06] p-1 rounded-xl border border-white/10 text-xs font-semibold">
                  <button
                    onClick={() => onUpdateSession({ ...userSession, billingCycle: 'monthly' })}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      (userSession.billingCycle || 'monthly') === 'monthly'
                        ? 'bg-gradient-to-r from-[#38BDF8] to-[#7363f8] text-white shadow-xs'
                        : 'text-[#A7B8CA] hover:text-white'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => onUpdateSession({ ...userSession, billingCycle: 'annual' })}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      (userSession.billingCycle || 'monthly') === 'annual'
                        ? 'bg-gradient-to-r from-[#38BDF8] to-[#7363f8] text-white shadow-xs'
                        : 'text-[#A7B8CA] hover:text-white'
                    }`}
                  >
                    <span>Annual</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/80 text-white font-bold">
                      SAVE 20%
                    </span>
                  </button>
                </div>
              </div>

              {/* Authoritative Plans Comparison (UNTOUCHED) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {authoritativePlans.map((p) => {
                  const currentPlanSlug = backendEntitlements?.plan_slug || userSession.planTier || 'free';
                  const isCurrent = currentPlanSlug === p.tier;
                  const price = (userSession.billingCycle || 'monthly') === 'annual' ? p.annualPrice : p.monthlyPrice;

                  return (
                    <div
                      key={p.tier}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                        isCurrent
                          ? 'border-[#38BDF8] bg-[#38BDF8]/15 shadow-lg shadow-[#38BDF8]/20 ring-1 ring-[#38BDF8]/40'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-[#A7B8CA]">
                            {p.badge}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#38BDF8] text-white">
                              ACTIVE
                            </span>
                          )}
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-[#F5FAFF]">{p.name}</h4>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-xl font-extrabold text-[#F5FAFF]">{price}</span>
                            <span className="text-xs text-[#A7B8CA]">{p.period}</span>
                          </div>
                          {(userSession.billingCycle || 'monthly') === 'annual' && p.tier !== 'free' && (
                            <div className="text-[10px] text-[#38BDF8] font-mono mt-0.5">{p.annualTotal} billed annually</div>
                          )}
                        </div>

                        <p className="text-[11px] text-[#A7B8CA] leading-tight">{p.desc}</p>

                        <div className="pt-2 border-t border-white/10 space-y-1 text-[11px] text-[#A7B8CA]">
                          <div className="flex items-center gap-1.5 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#38BDF8]" />
                            <span>{p.maxSize}</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#38BDF8]" />
                            <span>{p.storage}</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#38BDF8]" />
                            <span>{p.monthlyProcessing}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handlePlanCheckout(p.tier, p.name)}
                        disabled={isCurrent}
                        className={`w-full mt-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-[#38BDF8]/20 text-[#38BDF8] cursor-default'
                            : 'glass-btn-primary text-white shadow-xs'
                        }`}
                      >
                        {isCurrent ? 'Current Plan' : `Upgrade to ${p.name}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-6 text-xs">
              {/* Change Password */}
              <form onSubmit={handleChangePassword} className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-3">
                <span className="font-bold text-[#F5FAFF] block text-sm font-display">Account Password &amp; Session Invalidation</span>
                <p className="text-[11px] text-[#A7B8CA]">
                  Changing your password increments your account token version and automatically revokes all other active device tokens.
                </p>
                <div className="space-y-2">
                  <input
                    type="password"
                    placeholder="Current Password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-white/15 bg-white/[0.04] focus:border-[#38BDF8] outline-none text-[#F5FAFF] text-xs placeholder:text-[#A7B8CA]/50"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="password"
                      placeholder="New Password (min 8 chars)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="p-2.5 rounded-xl border border-white/15 bg-white/[0.04] focus:border-[#38BDF8] outline-none text-[#F5FAFF] text-xs placeholder:text-[#A7B8CA]/50"
                    />
                    <input
                      type="password"
                      placeholder="Confirm New Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="p-2.5 rounded-xl border border-white/15 bg-white/[0.04] focus:border-[#38BDF8] outline-none text-[#F5FAFF] text-xs placeholder:text-[#A7B8CA]/50"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="lg-btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-4"
                  >
                    <Lock className="w-3.5 h-3.5 text-[#38BDF8]" />
                    <span>{isChangingPassword ? 'Updating...' : 'Update Password'}</span>
                  </button>
                </div>
              </form>

              {/* Active Sessions Overview */}
              <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-3">
                <span className="font-bold text-[#F5FAFF] block text-sm font-display">Session Architecture</span>
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-[#F5FAFF]">Current Active Session</span>
                    <p className="text-[11px] text-[#A7B8CA]">Authenticated via JWT Bearer Token with Token-Revocation Verification</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                    VALIDATED
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB: API KEYS */}
          {activeTab === 'api' && (
            <div className="space-y-6 text-xs">
              {backendEntitlements && !backendEntitlements.has_api_access ? (
                <div className="p-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center mx-auto">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-[#F5FAFF]">Developer API Keys Require Professional Tier</h3>
                  <p className="text-[#A7B8CA] text-xs max-w-md mx-auto">
                    Programmatic REST API keys and automated webhooks require the <strong>Professional Suite</strong> or <strong>Enterprise Cloud</strong> tier.
                  </p>
                  <button
                    onClick={() => setActiveTab('plan')}
                    className="px-4 py-2 rounded-xl bg-[#38BDF8] text-white font-bold cursor-pointer hover:bg-[#7363f8] transition-colors"
                  >
                    View Upgrade Options
                  </button>
                </div>
              ) : (
                <>
                  {createdKeySecret && (
                    <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-300 font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>API Key Generated Successfully</span>
                      </div>
                      <p className="text-[#A7B8CA] text-[11px]">
                        Copy your key secret now. For security reasons, it will never be displayed again.
                      </p>
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/10 font-mono text-emerald-400 text-xs">
                        <span className="flex-1 select-all break-all">{createdKeySecret}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(createdKeySecret);
                            setCopiedToken(true);
                            addToast('info', 'Copied', 'API key copied to clipboard.');
                            setTimeout(() => setCopiedToken(false), 2000);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          {copiedToken ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Create New Key Section */}
                  <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-3">
                    <span className="font-bold text-[#F5FAFF] block text-sm font-display">Create New API Key</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="Key Identifier (e.g. CI/CD Pipeline, Production Worker)"
                        className="flex-1 p-2.5 rounded-xl border border-white/15 bg-white/[0.04] focus:border-[#38BDF8] outline-none text-[#F5FAFF] placeholder:text-[#A7B8CA]/50"
                      />
                      <button
                        onClick={handleCreateApiKey}
                        disabled={isCreatingKey}
                        className="px-4 py-2.5 rounded-xl bg-[#38BDF8] hover:bg-[#7363f8] text-white font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{isCreatingKey ? 'Generating...' : 'Generate Key'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Active Keys List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#F5FAFF]">Active API Keys</span>
                      <span className="text-[#A7B8CA] font-mono text-[11px]">{apiKeys.length} keys active</span>
                    </div>

                    {isLoadingKeys ? (
                      <div className="p-6 text-center text-[#A7B8CA]">Loading active keys...</div>
                    ) : apiKeys.length === 0 ? (
                      <div className="p-6 text-center rounded-2xl border border-white/10 bg-white/[0.02] text-[#A7B8CA]">
                        No active API keys found. Generate one above to access the REST API.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {apiKeys.map((k) => (
                          <div
                            key={k.id}
                            className="p-3 rounded-2xl border border-white/10 bg-white/[0.02] flex items-center justify-between"
                          >
                            <div className="space-y-0.5">
                              <div className="font-bold text-[#F5FAFF] flex items-center gap-2">
                                <span>{k.name}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                                  {k.key_prefix}••••
                                </span>
                              </div>
                              <div className="text-[11px] text-[#A7B8CA] space-x-2">
                                <span>Created: {new Date(k.created_at).toLocaleDateString()}</span>
                                <span>•</span>
                                <span>Limit: {k.rate_limit_rpm} req/min</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRevokeApiKey(k.id, k.name)}
                              className="px-3 py-1 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold cursor-pointer transition-colors"
                            >
                              Revoke
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB: PRIVACY & DATA GOVERNANCE */}
          {activeTab === 'privacy' && (
            <div className="space-y-6 text-xs">
              <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-4">
                <span className="font-bold text-[#F5FAFF] block text-sm font-display">Consent &amp; Privacy Telemetry</span>
                <div className="flex items-center justify-between py-2 border-b border-white/10">
                  <div>
                    <span className="font-bold text-[#F5FAFF] block">Autonomous AI Document Processing</span>
                    <p className="text-[11px] text-[#A7B8CA]">Enable intelligent extraction, semantic classification, and OCR parsing</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={aiConsentEnabled}
                    onChange={(e) => handleToggleAiConsent(e.target.checked)}
                    className="w-4 h-4 accent-[#38BDF8] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-2 border-b border-white/10">
                  <div>
                    <span className="font-bold text-[#F5FAFF] block">Product Updates &amp; Release Communications</span>
                    <p className="text-[11px] text-[#A7B8CA]">Receive periodic digests regarding security enhancements</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={marketingConsentEnabled}
                    onChange={(e) => setMarketingConsentEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[#38BDF8] cursor-pointer"
                  />
                </div>
              </div>

              {/* Verified Data Export */}
              <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-[#F5FAFF] block">Download Account &amp; Consent History</span>
                  <p className="text-[11px] text-[#A7B8CA]">
                    Export your full profile, verified consent history, and audit log as an encrypted JSON archive.
                  </p>
                </div>
                <button
                  onClick={handleExportUserData}
                  className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/15 border border-white/10 text-[#F5FAFF] font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Archive</span>
                </button>
              </div>

              {/* Danger Zone */}
              <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 space-y-3">
                <span className="font-bold text-rose-300 block text-sm font-display">Permanent Erasure (GDPR / CCPA)</span>
                <p className="text-[#A7B8CA] text-[11px]">
                  Requesting account deletion immediately revokes access, terminates all active JWT sessions, and queues your personal storage files for cryptographic zero-overwrite.
                </p>
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={handlePurgeAllData}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#F5FAFF] text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Clear Local Browser Cache
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeletingAccount}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{isDeletingAccount ? 'Erasing Account...' : 'Delete Account Permanently'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Persistent Modal Footer */}
        <div className="p-4 px-6 border-t border-white/10 bg-white/[0.03] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FF3366] to-[#38BDF8] flex items-center justify-center font-bold text-xs text-[#070B13] uppercase shadow-sm shrink-0">
              {(userName || userEmail || 'U').charAt(0)}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-[#F5FAFF] truncate">
                {userEmail || 'Active Session'}
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-[#A7B8CA]">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Active Account</span>
                <span>•</span>
                <span className="uppercase font-mono text-[10px] text-[#38BDF8] font-bold">
                  {userSession.role || 'Member'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
            {onLogout && (
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm active:scale-95"
                title="Sign out of OmniDoc Studio"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>Sign Out</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[#A7B8CA] hover:text-white text-xs font-medium cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
