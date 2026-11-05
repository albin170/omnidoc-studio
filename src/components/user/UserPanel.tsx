import React, { useState } from 'react';
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
  LogOut
} from 'lucide-react';
import { UserSession, purgeAllLocalData } from '../../services/storageService';
import { formatFileSize } from '../../services/formatDetector';
import { useToast } from '../../services/toastService';

interface UserPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userSession: UserSession;
  onUpdateSession: (newSession: UserSession) => void;
  totalStorageBytes: number;
  totalProjectsCount: number;
  onLogout?: () => void;
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
  const [userName, setUserName] = useState(userSession.userName || 'Document Architect');
  const [userEmail, setUserEmail] = useState(userSession.userEmail || 'architect@omnidoc.studio');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(
    userSession.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
  );

  // Security Toggles
  const [autoSave, setAutoSave] = useState(true);
  const [localEncryption, setLocalEncryption] = useState(true);
  const [autoPurge, setAutoPurge] = useState(false);

  // Mock API Token
  const [apiToken, setApiToken] = useState('ods_live_948f29d8a1c4b7298371ef');
  const [copiedToken, setCopiedToken] = useState(false);

  if (!isOpen) return null;

  const avatarOptions = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop&q=80',
  ];

  const handleSaveProfile = () => {
    onUpdateSession({
      ...userSession,
      isGuest: false,
      userName: userName.trim() || 'Document Architect',
      userEmail: userEmail.trim(),
      avatarUrl: selectedAvatar,
    });
    addToast('success', 'Profile Updated', 'Your user preferences were saved successfully.');
    onClose();
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(apiToken);
    setCopiedToken(true);
    addToast('info', 'Token Copied', 'API token copied to clipboard.');
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleGenerateNewToken = () => {
    const newToken = `ods_live_${Math.random().toString(36).substring(2, 12)}${Math.random().toString(36).substring(2, 12)}`;
    setApiToken(newToken);
    addToast('success', 'New Token Generated', 'Previous tokens have been invalidated.');
  };

  const handlePurgeAllData = () => {
    if (confirm('Are you sure you want to permanently delete all local projects, conversions, and cache?')) {
      purgeAllLocalData();
      addToast('warning', 'Data Purged', 'All local memory and records have been wiped.');
      window.location.reload();
    }
  };

  // 100MB quota simulation
  const maxQuotaBytes = 100 * 1024 * 1024;
  const quotaPct = Math.min(100, Math.max(1, Math.round((totalStorageBytes / maxQuotaBytes) * 100)));

  return (
    <div className="fixed inset-0 z-50 bg-[#080B18]/80 backdrop-blur-xl flex items-center justify-center p-3 sm:p-5 select-none animate-in fade-in">
      <div className="glass-panel border-white/15 rounded-[28px] max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl text-[#F4F5FF]">
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
                Manage your user identity, storage quota, and security settings
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
            <span>Plan &amp; Quota</span>
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
            <span>API &amp; Integrations</span>
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
                  <label className="font-bold text-[#9BA3BD] block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="e.g. user@company.com"
                    className="w-full p-2.5 rounded-xl border border-white/15 bg-white/[0.04] focus:border-[#8B7CFF] outline-none text-[#F4F5FF] placeholder:text-[#9BA3BD]/50 font-medium"
                  />
                </div>
              </div>

              {/* Status info box */}
              <div className="p-4 rounded-2xl bg-[#8B7CFF]/10 border border-[#8B7CFF]/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-[#42D6E8]" />
                  <div>
                    <div className="font-bold text-[#F4F5FF]">Local Identity Active</div>
                    <div className="text-[#9BA3BD] text-[11px]">No personal data transmitted to external servers</div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#8B7CFF] text-white font-bold text-[10px] shadow-sm shadow-[#8B7CFF]/40">
                  VERIFIED
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: PLAN & QUOTA */}
          {activeTab === 'plan' && (
            <div className="space-y-6">
              {/* Billing Cycle Switcher */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="text-xs font-bold text-[#F4F5FF]">Billing Cadence</span>
                <div className="flex items-center gap-1 bg-white/[0.06] p-1 rounded-xl border border-white/10 text-xs font-semibold">
                  <button
                    onClick={() => {
                      onUpdateSession({ ...userSession, billingCycle: 'monthly' });
                      addToast('info', 'Monthly Billing', 'Switched to monthly billing cycle.');
                    }}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      (userSession.billingCycle || 'annual') === 'monthly'
                        ? 'bg-gradient-to-r from-[#8B7CFF] to-[#7363f8] text-white shadow-xs'
                        : 'text-[#9BA3BD] hover:text-white'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => {
                      onUpdateSession({ ...userSession, billingCycle: 'annual' });
                      addToast('success', 'Annual Billing', 'Annual plan active — 20% discount applied!');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      (userSession.billingCycle || 'annual') === 'annual'
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

              {/* Plan Cards Comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    tier: 'free' as const,
                    name: 'Starter Free',
                    price: '$0',
                    period: 'forever',
                    badge: 'BASIC',
                    maxSize: '25 MB max file',
                    batchLimit: '5 files/batch',
                    desc: 'Essential document tools for personal use.',
                  },
                  {
                    tier: 'pro' as const,
                    name: 'OmniDoc Pro',
                    price: userSession.billingCycle === 'monthly' ? '$19' : '$15',
                    period: '/month',
                    badge: 'POPULAR',
                    maxSize: '150 MB max file',
                    batchLimit: '50 files/batch',
                    desc: 'High-speed conversions, unlimited OCR, full suite.',
                  },
                  {
                    tier: 'enterprise' as const,
                    name: 'Enterprise',
                    price: userSession.billingCycle === 'monthly' ? '$49' : '$39',
                    period: '/month',
                    badge: 'MAX SPEED',
                    maxSize: '500 MB max file',
                    batchLimit: 'Unlimited batch',
                    desc: 'Dedicated memory headroom, priority WASM acceleration.',
                  },
                ].map((p) => {
                  const isCurrent = (userSession.planTier || 'pro') === p.tier;
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
                            <span className="text-xl font-extrabold text-[#F4F5FF]">{p.price}</span>
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
                            <span>{p.batchLimit}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          onUpdateSession({ ...userSession, planTier: p.tier });
                          addToast('success', 'Plan Activated', `Successfully switched to ${p.name}`);
                        }}
                        disabled={isCurrent}
                        className={`w-full mt-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-[#8B7CFF]/20 text-[#8B7CFF] cursor-default'
                            : 'glass-btn-primary text-white shadow-xs'
                        }`}
                      >
                        {isCurrent ? 'Current Plan' : `Select ${p.name}`}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Storage Quota Usage */}
              <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="font-bold text-[#F4F5FF] flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-[#42D6E8]" />
                    <span>Local Device Storage Quota</span>
                  </div>
                  <div className="font-mono text-[#9BA3BD] font-semibold">
                    {formatFileSize(totalStorageBytes)} / 100 MB ({quotaPct}%)
                  </div>
                </div>

                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#8B7CFF] to-[#42D6E8] rounded-full transition-all"
                    style={{ width: `${quotaPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#9BA3BD] pt-0.5">
                  <span>{totalProjectsCount} projects stored in browser local storage</span>
                  <span className="text-emerald-400 font-bold">100% Client-Side Free</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SECURITY & PRIVACY */}
          {activeTab === 'security' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between p-4 rounded-2xl border border-white/10 bg-white/[0.03]">
                <div className="space-y-0.5">
                  <div className="font-bold text-[#F4F5FF]">Auto-Save Working Drafts</div>
                  <div className="text-[#9BA3BD] text-[11px]">Automatically preserve edits to browser local storage (localStorage)</div>
                </div>
                <input
                  type="checkbox"
                  checked={autoSave}
                  onChange={(e) => setAutoSave(e.target.checked)}
                  className="w-5 h-5 accent-[#8B7CFF] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl border border-white/10 bg-white/[0.03]">
                <div className="space-y-0.5">
                  <div className="font-bold text-[#F4F5FF]">Client-Side Memory Sandbox</div>
                  <div className="text-[#9BA3BD] text-[11px]">Enforce zero transmission of document bytes over network</div>
                </div>
                <input
                  type="checkbox"
                  checked={localEncryption}
                  onChange={(e) => setLocalEncryption(e.target.checked)}
                  className="w-5 h-5 accent-[#8B7CFF] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl border border-white/10 bg-white/[0.03]">
                <div className="space-y-0.5">
                  <div className="font-bold text-[#F4F5FF]">Auto-Purge on Browser Close</div>
                  <div className="text-[#9BA3BD] text-[11px]">Wipe temporary session blobs on window unload</div>
                </div>
                <input
                  type="checkbox"
                  checked={autoPurge}
                  onChange={(e) => setAutoPurge(e.target.checked)}
                  className="w-5 h-5 accent-[#8B7CFF] cursor-pointer"
                />
              </div>

              {/* Danger Zone */}
              <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/30 space-y-2 mt-4">
                <div className="font-bold text-red-400 flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4" />
                  <span>Danger Zone: Permanent Memory Purge</span>
                </div>
                <p className="text-[11px] text-red-300">
                  Delete all saved projects, conversion history, and local preferences permanently.
                </p>
                <button
                  onClick={handlePurgeAllData}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer transition-colors shadow-sm"
                >
                  Purge All Stored Data
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: API & INTEGRATIONS */}
          {activeTab === 'api' && (
            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-[#F4F5FF]">Personal Access API Token</label>
                <p className="text-[#9BA3BD] text-[11px]">Use this token to authenticate CLI scripts and background workers.</p>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="password"
                    value={apiToken}
                    readOnly
                    className="flex-1 p-2.5 rounded-xl border border-white/15 bg-white/[0.04] font-mono text-[#F4F5FF] text-xs"
                  />
                  <button
                    onClick={handleCopyToken}
                    className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer flex items-center gap-1"
                  >
                    {copiedToken ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleGenerateNewToken}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-[#F4F5FF] font-bold cursor-pointer border border-white/15"
                >
                  Generate New Secret Token
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-[#9BA3BD] space-y-1">
                <div className="font-bold text-[#F4F5FF] flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-[#42D6E8]" />
                  <span>SDK &amp; Webhook Integration</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  OmniDoc Studio exposes client-side WebAssembly bridges for `pdf-lib`, `docx`, `pptxgenjs`, and `tesseract.js`.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[#9BA3BD] hover:bg-white/10 font-semibold cursor-pointer transition-colors"
            >
              Cancel
            </button>
            {onLogout && (
              <button
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="px-3.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 font-bold flex items-center gap-1.5 cursor-pointer border border-red-500/30 transition-colors"
                title="Log Out of this workspace"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            )}
          </div>

          <button
            onClick={handleSaveProfile}
            className="glass-btn-primary flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white font-bold cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
};
