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
  RefreshCw
} from 'lucide-react';
import { UserSession, purgeAllLocalData } from '../../services/storageService';
import { formatFileSize } from '../../services/formatDetector';
import { useToast } from '../../services/toastService';
import { omniDocClient } from '../../sdk/omnidocClient';

interface UserPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userSession: UserSession;
  onUpdateSession: (newSession: UserSession) => void;
  totalStorageBytes: number;
  totalProjectsCount: number;
  onLogout?: () => void;
}

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
}) => {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'profile' | 'plan' | 'security' | 'api'>('profile');
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
  }, [isOpen, userSession.userName, userSession.userEmail]);

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
      addToast('warning', 'Key Revoked', `API key "${keyName}" was successfully invalidated.`);
    } catch (err: any) {
      addToast('error', 'Revocation Failed', err.message || 'Could not revoke API key.');
    }
  };

  const handlePlanCheckout = async (planSlug: string, planName: string) => {
    try {
      const res = await omniDocClient.createCheckoutSession(planSlug, userSession.billingCycle || 'monthly');
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
      }
    } catch (err: any) {
      addToast('info', 'Checkout Status', err.message || `Direct card checkout for ${planName} is pending gateway configuration. Please contact sales@omnidoc.studio to upgrade.`);
    }
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
      addToast('success', 'Export Ready', 'Your account data has been downloaded.');
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
  const maxQuotaBytes = backendEntitlements?.storage_quota_bytes || 100 * 1024 * 1024;
  const currentUsedBytes = backendUsage?.storage_used_bytes ?? totalStorageBytes;
  const quotaPct = Math.min(100, Math.max(1, Math.round((currentUsedBytes / maxQuotaBytes) * 100)));

  const authoritativePlans = [
    {
      tier: 'free',
      name: 'Free Community',
      monthlyPrice: '$0',
      annualPrice: '$0',
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
      annualPrice: '$15',
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
      annualPrice: '$39',
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
      annualPrice: '$165',
      period: '/month',
      badge: 'ENTERPRISE',
      maxSize: '500 MB max file',
      storage: '100 GB vault',
      monthlyProcessing: 'Unlimited',
      desc: 'Unlimited capacity, bespoke workflows, maximum security, and dedicated support.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#080B18]/80 backdrop-blur-xl flex items-center justify-center p-3 sm:p-5 select-none animate-in fade-in">
      <div className="glass-panel border-white/15 rounded-[28px] max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl text-[#F4F5FF]">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#8B7CFF]/30 to-[#42D6E8]/30 border border-[#8B7CFF]/40 text-[#42D6E8] flex items-center justify-center font-bold shadow-md shadow-[#8B7CFF]/20">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#F4F5FF] leading-tight">
                Account &amp; Studio Panel
              </h2>
              <p className="text-xs text-[#9BA3BD]">
                Manage your user identity, verified quotas, and developer credentials
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 text-[#9BA3BD] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-5 border-b border-white/10 bg-white/[0.02] gap-2 overflow-x-auto text-xs font-semibold text-[#9BA3BD]">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-[#8B7CFF] text-[#8B7CFF] font-bold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profile &amp; Identity</span>
          </button>

          <button
            onClick={() => setActiveTab('plan')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'plan'
                ? 'border-[#8B7CFF] text-[#8B7CFF] font-bold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4 text-[#42D6E8]" />
            <span>Plans &amp; Quota</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'security'
                ? 'border-[#8B7CFF] text-[#8B7CFF] font-bold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Security &amp; Privacy</span>
          </button>

          <button
            onClick={() => setActiveTab('api')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'api'
                ? 'border-[#8B7CFF] text-[#8B7CFF] font-bold'
                : 'border-transparent hover:text-white'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>API Keys</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Avatar Chooser */}
              <div>
                <label className="text-xs font-bold text-[#F4F5FF] block mb-2">
                  Select User Avatar
                </label>
                <div className="flex items-center gap-3 overflow-x-auto pb-1">
                  {avatarOptions.map((avatar, idx) => (
                    <img
                      key={idx}
                      src={avatar}
                      alt="Avatar option"
                      onClick={() => setSelectedAvatar(avatar)}
                      className={`w-12 h-12 rounded-2xl object-cover cursor-pointer transition-all border-2 ${
                        selectedAvatar === avatar
                          ? 'border-[#8B7CFF] ring-2 ring-[#8B7CFF]/40 scale-105'
                          : 'border-transparent hover:opacity-80'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-bold text-[#9BA3BD] block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="e.g. Zach Marion"
                    className="w-full p-2.5 rounded-xl border border-white/15 bg-white/[0.04] focus:border-[#8B7CFF] outline-none text-[#F4F5FF] placeholder:text-[#9BA3BD]/50 font-medium"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#9BA3BD] block mb-1">Email Address (Authoritative)</label>
                  <input
                    type="email"
                    value={userEmail}
                    disabled
                    className="w-full p-2.5 rounded-xl border border-white/10 bg-white/[0.02] text-[#9BA3BD] font-medium cursor-not-allowed"
                    title="Account email address is bound to your organization identity."
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#8B7CFF] to-[#6366F1] text-white font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-2"
                >
                  {isSavingProfile ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Profile</span>
                </button>
              </div>

              {/* Status info box */}
              <div className="p-4 rounded-2xl bg-[#8B7CFF]/10 border border-[#8B7CFF]/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-[#42D6E8]" />
                  <div>
                    <div className="font-bold text-[#F4F5FF]">Authenticated Account</div>
                    <div className="text-[#9BA3BD] text-[11px]">Protected by JWT session authentication and tenant isolation</div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#8B7CFF] text-white font-bold text-[10px] shadow-sm shadow-[#8B7CFF]/40 uppercase">
                  {userSession.role || 'USER'}
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: PLAN & QUOTA */}
          {activeTab === 'plan' && (
            <div className="space-y-6">
              {/* Storage Quota Usage */}
              <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="font-bold text-[#F4F5FF] flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-[#42D6E8]" />
                    <span>Server Storage Quota</span>
                  </div>
                  <div className="font-mono text-[#9BA3BD] font-semibold">
                    {formatFileSize(currentUsedBytes)} / {formatFileSize(maxQuotaBytes)} ({quotaPct}%)
                  </div>
                </div>

                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      quotaPct > 90 ? 'bg-rose-500' : 'bg-gradient-to-r from-[#8B7CFF] to-[#42D6E8]'
                    }`}
                    style={{ width: `${quotaPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#9BA3BD] pt-0.5">
                  <span>{backendUsage?.documents_count ?? totalProjectsCount} documents stored</span>
                  <span className="text-[#42D6E8] font-semibold">
                    Active Plan: {(backendEntitlements?.plan_name || userSession.planTier || 'Free Community').toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Billing Cycle Switcher */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="text-xs font-bold text-[#F4F5FF]">Billing Cadence</span>
                <div className="flex items-center gap-1 bg-white/[0.06] p-1 rounded-xl border border-white/10 text-xs font-semibold">
                  <button
                    onClick={() => onUpdateSession({ ...userSession, billingCycle: 'monthly' })}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      (userSession.billingCycle || 'monthly') === 'monthly'
                        ? 'bg-gradient-to-r from-[#8B7CFF] to-[#7363f8] text-white shadow-xs'
                        : 'text-[#9BA3BD] hover:text-white'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => onUpdateSession({ ...userSession, billingCycle: 'annual' })}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      (userSession.billingCycle || 'monthly') === 'annual'
                        ? 'bg-gradient-to-r from-[#8B7CFF] to-[#7363f8] text-white shadow-xs'
                        : 'text-[#9BA3BD] hover:text-white'
                    }`}
                  >
                    <span>Annual</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/80 text-white font-bold">
                      SAVE 20%
                    </span>
                  </button>
                </div>
              </div>

              {/* Authoritative Plans Comparison */}
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
                          ? 'border-[#8B7CFF] bg-[#8B7CFF]/15 shadow-lg shadow-[#8B7CFF]/20 ring-1 ring-[#8B7CFF]/40'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-[#9BA3BD]">
                            {p.badge}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#8B7CFF] text-white">
                              ACTIVE
                            </span>
                          )}
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-[#F4F5FF]">{p.name}</h4>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-xl font-extrabold text-[#F4F5FF]">{price}</span>
                            <span className="text-xs text-[#9BA3BD]">{p.period}</span>
                          </div>
                        </div>

                        <p className="text-[11px] text-[#9BA3BD] leading-tight">{p.desc}</p>

                        <div className="pt-2 border-t border-white/10 space-y-1 text-[11px] text-[#9BA3BD]">
                          <div className="flex items-center gap-1.5 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#42D6E8]" />
                            <span>{p.maxSize}</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#42D6E8]" />
                            <span>{p.storage}</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#42D6E8]" />
                            <span>{p.monthlyProcessing}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handlePlanCheckout(p.tier, p.name)}
                        disabled={isCurrent}
                        className={`w-full mt-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-[#8B7CFF]/20 text-[#8B7CFF] cursor-default'
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

          {/* TAB 3: SECURITY & PRIVACY */}
          {activeTab === 'security' && (
            <div className="space-y-6 text-xs">
              {/* Password Change Form */}
              <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-3">
                <div className="font-bold text-[#F4F5FF] flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#8B7CFF]" />
                  <span>Update Account Password</span>
                </div>
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div>
                    <label className="block text-[#9BA3BD] mb-1 font-semibold">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-[#8B7CFF]"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#9BA3BD] mb-1 font-semibold">New Password (min 8 chars)</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-[#8B7CFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[#9BA3BD] mb-1 font-semibold">Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-[#8B7CFF]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      className="px-4 py-1.5 rounded-xl bg-[#8B7CFF] hover:bg-[#7363f8] text-white font-bold transition-colors cursor-pointer"
                    >
                      {isChangingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Active Session Information (Phase 5) */}
              <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-3">
                <div className="font-bold text-[#F4F5FF] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#42D6E8]" />
                    <span>Active Session Information</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                    AUTHENTICATED
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[#9BA3BD]">
                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-0.5">
                    <div className="text-[#9BA3BD]/70 text-[10px]">Session Identity</div>
                    <div className="text-white font-mono break-all">{userSession.userEmail || userEmail}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-0.5">
                    <div className="text-[#9BA3BD]/70 text-[10px]">Access Role &amp; Tier</div>
                    <div className="text-white font-semibold">
                      {(userSession.role || 'user').toUpperCase()} • {(backendEntitlements?.plan_name || userSession.planTier || 'Free').toUpperCase()}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-0.5">
                    <div className="text-[#9BA3BD]/70 text-[10px]">Auth Source</div>
                    <div className="text-white font-semibold">{userSession.authSource || 'JWT Bearer (Backend)'}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-0.5">
                    <div className="text-[#9BA3BD]/70 text-[10px]">Security Protocol</div>
                    <div className="text-white font-semibold">TLS Encrypted • SHA-256 Token Vault</div>
                  </div>
                </div>
              </div>

              {/* Privacy Settings & Consent Management (Phase 5) */}
              <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-3">
                <div className="font-bold text-[#F4F5FF] flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#8B7CFF]" />
                  <span>Privacy &amp; Processing Consents</span>
                </div>
                <div className="space-y-2 pt-1 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                    <div>
                      <div className="font-semibold text-white">Autonomous AI Processing</div>
                      <div className="text-[11px] text-[#9BA3BD]">Consent for AI document parsing, OCR and summarization pipelines</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={aiConsentEnabled}
                      onChange={(e) => handleToggleAiConsent(e.target.checked)}
                      className="w-4 h-4 rounded text-[#8B7CFF] cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                    <div>
                      <div className="font-semibold text-white">Security &amp; Operational Updates</div>
                      <div className="text-[11px] text-[#9BA3BD]">Receive transactional emails and critical security disclosures</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={marketingConsentEnabled}
                      onChange={(e) => setMarketingConsentEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-[#8B7CFF] cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Data Export & Account Deletion */}
              <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-3">
                <div className="font-bold text-[#F4F5FF] flex items-center gap-2">
                  <Download className="w-4 h-4 text-[#42D6E8]" />
                  <span>Privacy &amp; Data Rights (GDPR / CCPA)</span>
                </div>
                <p className="text-[#9BA3BD] text-[11px]">
                  Request an immutable copy of your account profile, audit trail, and policy consents, or exercise right to erasure.
                </p>
                <div className="flex items-center gap-3 pt-1 flex-wrap">
                  <button
                    onClick={handleExportUserData}
                    className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export My Data</span>
                  </button>
                  <button
                    onClick={handlePurgeAllData}
                    className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-[#9BA3BD] hover:text-white font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Wipe Local Cache</span>
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeletingAccount}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>{isDeletingAccount ? 'Processing...' : 'Delete My Account'}</span>
                  </button>
                </div>
              </div>

              {/* Real Session Logout */}
              {onLogout && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      onLogout();
                      onClose();
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out of All Sessions</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: API KEYS */}
          {activeTab === 'api' && (
            <div className="space-y-6 text-xs">
              {/* Check if user has API access entitlement */}
              {backendEntitlements && !backendEntitlements.has_api_access ? (
                <div className="p-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center mx-auto">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-[#F4F5FF]">Developer API Keys Unavailable on Free Tier</h3>
                  <p className="text-[#9BA3BD] text-xs max-w-md mx-auto">
                    Programmatic REST API keys and automated webhooks require the <strong>Professional Suite</strong> or <strong>Enterprise Cloud</strong> tier.
                  </p>
                  <button
                    onClick={() => setActiveTab('plan')}
                    className="px-4 py-2 rounded-xl bg-[#8B7CFF] text-white font-bold cursor-pointer hover:bg-[#7363f8] transition-colors"
                  >
                    View Upgrade Options
                  </button>
                </div>
              ) : (
                <>
                  {/* One-Time Secret Display Modal / Box */}
                  {createdKeySecret && (
                    <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-300 font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>API Key Generated Successfully</span>
                      </div>
                      <p className="text-[#9BA3BD] text-[11px]">
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
                    <span className="font-bold text-[#F4F5FF] block">Create New API Key</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="Key Identifier (e.g. CI/CD Pipeline, Production Worker)"
                        className="flex-1 p-2.5 rounded-xl border border-white/15 bg-white/[0.04] focus:border-[#8B7CFF] outline-none text-[#F4F5FF] placeholder:text-[#9BA3BD]/50"
                      />
                      <button
                        onClick={handleCreateApiKey}
                        disabled={isCreatingKey}
                        className="px-4 py-2.5 rounded-xl bg-[#8B7CFF] hover:bg-[#7363f8] text-white font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{isCreatingKey ? 'Generating...' : 'Generate Key'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Active Keys List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#F4F5FF]">Active API Keys</span>
                      <span className="text-[#9BA3BD] font-mono text-[11px]">{apiKeys.length} keys active</span>
                    </div>

                    {isLoadingKeys ? (
                      <div className="p-6 text-center text-[#9BA3BD]">Loading active keys...</div>
                    ) : apiKeys.length === 0 ? (
                      <div className="p-6 text-center rounded-2xl border border-white/10 bg-white/[0.02] text-[#9BA3BD]">
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
                              <div className="font-bold text-[#F4F5FF] flex items-center gap-2">
                                <span>{k.name}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                                  {k.key_prefix}••••
                                </span>
                              </div>
                              <div className="text-[11px] text-[#9BA3BD] space-x-2">
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
        </div>
      </div>
    </div>
  );
};
