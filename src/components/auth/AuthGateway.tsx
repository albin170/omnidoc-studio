import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Building, 
  Server,
  AlertCircle,
  Sliders,
  ShieldAlert,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { OmniDocLogo } from '../common/OmniDocLogo';
import { UserSession } from '../../services/storageService';
import { loginWithBackend, registerWithBackend, createSecureSession, adminLoginWithBackend } from '../../services/authService';
import { omniDocClient } from '../../sdk/omnidocClient';
import { useToast } from '../../services/toastService';

interface AuthGatewayProps {
  onAuthenticate: (session: UserSession) => void;
  initialMode?: 'signin' | 'signup' | 'admin';
}

export const AuthGateway: React.FC<AuthGatewayProps> = ({ onAuthenticate, initialMode = 'signin' }) => {
  const { addToast } = useToast();

  const [mode, setMode] = useState<'signin' | 'signup' | 'admin'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Server Health & Connectivity
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [serverUnreachable, setServerUnreachable] = useState(false);
  const [customApiUrl, setCustomApiUrl] = useState(omniDocClient.getBaseUrl());
  const [showUrlConfig, setShowUrlConfig] = useState(false);

  // Consent Management
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  // Check health on mount and when API URL changes
  useEffect(() => {
    let isMounted = true;
    const probe = async () => {
      setServerStatus('checking');
      try {
        await omniDocClient.getHealth(2500);
        if (isMounted) {
          setServerStatus('online');
          setServerUnreachable(false);
        }
      } catch {
        if (isMounted) {
          setServerStatus('offline');
        }
      }
    };
    probe();
    return () => { isMounted = false; };
  }, [customApiUrl]);

  const handleSaveApiUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customApiUrl.trim()) return;
    omniDocClient.setBaseUrl(customApiUrl.trim());
    addToast('info', 'API URL Updated', `Connecting to ${customApiUrl.trim()}...`);
    setShowUrlConfig(false);
    setServerStatus('checking');
    omniDocClient.getHealth(3000)
      .then(() => {
        setServerStatus('online');
        setServerUnreachable(false);
        addToast('success', 'Backend Connected', 'FastAPI backend connection established.');
      })
      .catch(() => {
        setServerStatus('offline');
        addToast('error', 'Connection Failed', `Could not reach backend at ${customApiUrl.trim()}`);
      });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email.trim())) {
      addToast('warning', 'Valid Email Required', 'Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      addToast('warning', 'Password Required', 'Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    setServerUnreachable(false);

    try {
      if (mode === 'admin') {
        const session = await adminLoginWithBackend(email.trim(), password);
        session.rememberMe = rememberMe;
        onAuthenticate(session);
        addToast('success', 'Admin Authenticated', `Welcome, Administrator ${session.userName}.`);
      } else {
        const session = await loginWithBackend(email.trim(), password);
        session.rememberMe = rememberMe;
        onAuthenticate(session);
        addToast('success', 'Authenticated', `Welcome back, ${session.userName}!`);
      }
    } catch (err: any) {
      console.warn('Login error:', err);
      const isNetworkErr = err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError');
      if (isNetworkErr) {
        setServerUnreachable(true);
        setServerStatus('offline');
        addToast('error', 'Authentication Server Unreachable', `Could not reach ${omniDocClient.getBaseUrl()}. Start your backend with "uvicorn app.main:app" or launch in Offline Studio Sandbox.`);
      } else {
        addToast('error', 'Authentication Failed', err?.message || 'Invalid credentials. Please verify your email and password.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunchLocalSandbox = async () => {
    setIsLoading(true);
    try {
      const sandbox = await createSecureSession(
        email.trim() || 'local.engineer@omnidoc.io',
        name.trim() || (email ? email.split('@')[0] : 'Document Engineer'),
        mode === 'admin' ? 'admin' : 'user',
        mode === 'admin' ? 'enterprise' : 'free'
      );
      sandbox.rememberMe = rememberMe;
      onAuthenticate(sandbox);
      addToast('success', 'Offline Sandbox Launched', 'Entered OmniDoc Studio with browser local vault.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('warning', 'Name Required', 'Please enter your full name.');
      return;
    }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email.trim())) {
      addToast('warning', 'Valid Email Required', 'Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 8) {
      addToast('warning', 'Password Security', 'Password must be at least 8 characters.');
      return;
    }

    if (!termsAccepted || !privacyAccepted || !aiConsent) {
      addToast('warning', 'Consents Required', 'Please accept Terms, Privacy Policy, and AI Processing consent.');
      return;
    }

    setIsLoading(true);
    setServerUnreachable(false);

    try {
      const session = await registerWithBackend({
        email: email.trim(),
        password,
        full_name: name.trim(),
        organization_name: orgName.trim() || `${name.trim()}'s Workspace`,
        terms_accepted: termsAccepted,
        privacy_accepted: privacyAccepted,
        ai_consent: aiConsent,
        marketing_consent: marketingConsent,
      });

      session.rememberMe = rememberMe;
      onAuthenticate(session);
      addToast('success', 'Account Registered', `Welcome, ${session.userName}! Your workspace is ready.`);
    } catch (err: any) {
      console.warn('Registration error:', err);
      const isNetworkErr = err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError');
      if (isNetworkErr) {
        setServerUnreachable(true);
        setServerStatus('offline');
        addToast('error', 'Authentication Server Unreachable', `Could not reach ${omniDocClient.getBaseUrl()}. Start your backend server or use Local Sandbox.`);
      } else {
        addToast('error', 'Registration Failed', err?.message || 'Could not register user. Please verify input.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestEntry = async () => {
    setIsLoading(true);
    try {
      const guestSession = await createSecureSession('guest@omnidoc.local', 'Guest Explorer', 'guest', 'free');
      guestSession.isGuest = true;
      guestSession.isAuthenticated = false;
      guestSession.role = 'guest';
      guestSession.planTier = 'free';
      onAuthenticate(guestSession);
      addToast('info', 'Guest Mode', 'Guest session active. All local document studios are available.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#080B18]/85 backdrop-blur-2xl overflow-y-auto">
      {/* Dynamic Aurora Ambient Lighting */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#8B7CFF]/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-[#42D6E8]/10 blur-[130px] pointer-events-none" />

      {/* Main Glass Modal Card */}
      <div className="relative w-full max-w-4xl rounded-3xl border border-white/10 bg-[#11152A]/90 shadow-2xl shadow-black/80 overflow-hidden grid grid-cols-1 md:grid-cols-12 my-auto">
        
        {/* Left Side: Brand & Live Architecture Badge (5 cols) */}
        <div className="md:col-span-5 p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/10 bg-gradient-to-br from-[#8B7CFF]/10 via-[#11152A] to-transparent relative overflow-hidden">
          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-3">
              <OmniDocLogo className="w-9 h-9" />
              <div>
                <span className="text-xl font-black tracking-tight text-[#F4F5FF]">OmniDoc</span>
                <span className="text-xs px-2 py-0.5 ml-1.5 rounded-full bg-[#8B7CFF]/20 text-[#8B7CFF] font-mono border border-[#8B7CFF]/30 font-bold">
                  {mode === 'admin' ? 'ADMIN' : 'STUDIO'}
                </span>
                <p className="text-[10px] text-[#9BA3BD] font-medium tracking-wide">
                  {mode === 'admin' ? 'Administrative Governance Console' : 'Autonomous Document Engineering'}
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-[#F4F5FF] leading-tight">
                {mode === 'admin' ? (
                  <>Secure Governance &amp; SaaS Management Portal</>
                ) : (
                  <>Convert, Edit &amp; Verify Any Document.</>
                )}
              </h2>
              <p className="text-xs text-[#9BA3BD] mt-2 leading-relaxed">
                {mode === 'admin' ? (
                  'Centrally manage users, plans, pricing limits, feature overrides, and audit trails with verifiable backend enforcement.'
                ) : (
                  'Enterprise workspace with real backend security, cryptographic verification, and strict tenant isolation.'
                )}
              </p>
            </div>

            {/* Feature Bullets */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-2.5 text-xs text-[#F4F5FF]">
                <CheckCircle2 className="w-4 h-4 text-[#42D6E8] shrink-0 mt-0.5" />
                <span>Backend JWT authentication &amp; policy consent auditing</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-[#F4F5FF]">
                <CheckCircle2 className="w-4 h-4 text-[#8B7CFF] shrink-0 mt-0.5" />
                <span>Real multi-sheet Excel, OpenXML Word &amp; PPTX engines</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-[#F4F5FF]">
                <CheckCircle2 className="w-4 h-4 text-[#42D6E8] shrink-0 mt-0.5" />
                <span>Zero-leak PDF sanitization &amp; font glyph destruction</span>
              </div>
            </div>
          </div>

          {/* Dynamic Server Connection Health Badge */}
          <div className="pt-6 border-t border-white/10 flex flex-col gap-2 relative z-10 text-[11px] text-[#9BA3BD]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-[#42D6E8]" />
                <span className="font-medium">FastAPI 2.0 Engine</span>
              </div>
              <div className="flex items-center gap-1.5">
                {serverStatus === 'checking' && (
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold border border-cyan-500/30 animate-pulse">
                    CHECKING...
                  </span>
                )}
                {serverStatus === 'online' && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                    ONLINE
                  </span>
                )}
                {serverStatus === 'offline' && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/30">
                    DISCONNECTED
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px]">
              <span className="truncate max-w-[180px] text-white/50">{customApiUrl}</span>
              <button
                type="button"
                onClick={() => setShowUrlConfig(!showUrlConfig)}
                className="text-[#8B7CFF] hover:underline cursor-pointer flex items-center gap-0.5"
              >
                <Sliders className="w-3 h-3" />
                <span>Configure URL</span>
              </button>
            </div>

            {/* Inline Custom API URL Form */}
            {showUrlConfig && (
              <form onSubmit={handleSaveApiUrl} className="mt-2 space-y-2 p-2.5 rounded-xl bg-black/40 border border-white/10">
                <label className="text-[10px] text-[#9BA3BD] font-medium block">
                  Backend API Base URL:
                </label>
                <input
                  type="url"
                  value={customApiUrl}
                  onChange={(e) => setCustomApiUrl(e.target.value)}
                  placeholder="http://localhost:8000/api/v1"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white/5 border border-white/15 text-white focus:outline-none focus:border-[#8B7CFF]"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomApiUrl('http://localhost:8000/api/v1');
                      omniDocClient.setBaseUrl('http://localhost:8000/api/v1');
                    }}
                    className="px-2 py-1 text-[10px] rounded bg-white/10 text-white/70 hover:text-white"
                  >
                    Reset Default
                  </button>
                  <button
                    type="submit"
                    className="px-2.5 py-1 text-[10px] rounded bg-[#8B7CFF] text-white font-bold"
                  >
                    Save &amp; Reconnect
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right Side: Auth Form (7 cols) */}
        <div className="md:col-span-7 p-7 sm:p-10 flex flex-col justify-between bg-white/[0.02] backdrop-blur-xl text-[#F4F5FF] overflow-y-auto max-h-[85vh]">
          <div>
            {/* Mode Switcher */}
            <div className="flex items-center justify-between pb-5">
              <div className="flex p-1 rounded-2xl bg-white/[0.05] border border-white/10 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                    mode === 'signin'
                      ? 'bg-gradient-to-r from-[#8B7CFF] to-[#7363f8] text-white shadow-sm'
                      : 'text-[#9BA3BD] hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                    mode === 'signup'
                      ? 'bg-gradient-to-r from-[#8B7CFF] to-[#7363f8] text-white shadow-sm'
                      : 'text-[#9BA3BD] hover:text-white'
                  }`}
                >
                  Create Account
                </button>
                <button
                  type="button"
                  onClick={() => setMode('admin')}
                  className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                    mode === 'admin'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-sm font-black'
                      : 'text-amber-400 hover:text-amber-300'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </button>
              </div>

              <span className="text-[11px] font-semibold text-[#9BA3BD] hidden sm:inline">
                {mode === 'admin' ? 'Admin Portal' : (mode === 'signin' ? 'User Portal' : 'Registration')}
              </span>
            </div>

            {/* Form Title */}
            <div className="mb-4">
              <h3 className="text-xl font-extrabold text-[#F4F5FF] tracking-tight flex items-center gap-2">
                {mode === 'admin' && <ShieldAlert className="w-5 h-5 text-amber-400" />}
                {mode === 'admin' && 'Administrator Portal Sign In'}
                {mode === 'signin' && 'Sign In to OmniDoc Studio'}
                {mode === 'signup' && 'Register Enterprise Account'}
              </h3>
              <p className="text-xs text-[#9BA3BD] mt-0.5">
                {mode === 'admin' && 'Enter administrator credentials to manage users, plans, and permissions.'}
                {mode === 'signin' && 'Enter credentials to authenticate with the backend server.'}
                {mode === 'signup' && 'Create your tenant workspace with transactional consent recording.'}
              </p>
            </div>

            {/* Server Unreachable Diagnostic & One-Click Sandbox */}
            {serverUnreachable && (
              <div className="mb-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">FastAPI Server Currently Unreachable</span>
                    <span>Could not connect to <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-300">{customApiUrl}</code>.</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-amber-500/20 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLaunchLocalSandbox}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition-all cursor-pointer flex items-center gap-1.5 shadow"
                  >
                    <span>Launch in Offline Studio Sandbox</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUrlConfig(true)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs transition-all cursor-pointer"
                  >
                    Configure API URL
                  </button>
                </div>
              </div>
            )}

            {/* Form */}
            {(mode === 'signin' || mode === 'admin') ? (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#F4F5FF] mb-1.5">
                    {mode === 'admin' ? 'Administrator Email' : 'Email Address'}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-[#9BA3BD]" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={mode === 'admin' ? 'admin@omnidoc.io' : 'alex@company.com'}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-[#F4F5FF] placeholder:text-[#9BA3BD]/50 focus:outline-none focus:border-[#8B7CFF] transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#F4F5FF] mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-[#9BA3BD]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-[#F4F5FF] placeholder:text-[#9BA3BD]/50 focus:outline-none focus:border-[#8B7CFF] transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-[#9BA3BD] hover:text-[#F4F5FF]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-[#9BA3BD]">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 accent-[#8B7CFF] rounded"
                    />
                    <span>Remember me on this browser</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-3 rounded-xl font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer mt-4 ${
                    mode === 'admin'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-amber-500/25 hover:from-amber-400 hover:to-amber-500'
                      : 'glass-btn-primary text-white shadow-[#8B7CFF]/25'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>{mode === 'admin' ? 'Authenticate Administrator' : 'Sign In & Launch Studio'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignUp} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#F4F5FF] mb-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 w-4 h-4 text-[#9BA3BD]" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Johnson"
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-[#F4F5FF] placeholder:text-[#9BA3BD]/50 focus:outline-none focus:border-[#8B7CFF]"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#F4F5FF] mb-1">Work Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 w-4 h-4 text-[#9BA3BD]" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="alex@enterprise.com"
                        className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-[#F4F5FF] placeholder:text-[#9BA3BD]/50 focus:outline-none focus:border-[#8B7CFF]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#F4F5FF] mb-1">Workspace / Org</label>
                    <div className="relative">
                      <Building className="absolute left-3.5 top-3 w-4 h-4 text-[#9BA3BD]" />
                      <input
                        type="text"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="Acme Global Inc"
                        className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-[#F4F5FF] placeholder:text-[#9BA3BD]/50 focus:outline-none focus:border-[#8B7CFF]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#F4F5FF] mb-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-[#9BA3BD]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full pl-10 pr-10 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-[#F4F5FF] placeholder:text-[#9BA3BD]/50 focus:outline-none focus:border-[#8B7CFF]"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-[#9BA3BD] hover:text-[#F4F5FF]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Consent Checkboxes */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <label className="flex items-start gap-2 cursor-pointer text-[11px] text-[#F4F5FF]">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#8B7CFF] rounded"
                      required
                    />
                    <span>
                      I agree to the <span className="text-[#8B7CFF] font-semibold underline">Terms of Service</span> (v2026.1) <span className="text-red-400">*</span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer text-[11px] text-[#F4F5FF]">
                    <input
                      type="checkbox"
                      checked={privacyAccepted}
                      onChange={(e) => setPrivacyAccepted(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#8B7CFF] rounded"
                      required
                    />
                    <span>
                      I acknowledge the <span className="text-[#8B7CFF] font-semibold underline">Privacy Policy</span> (v2026.1) <span className="text-red-400">*</span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer text-[11px] text-[#F4F5FF]">
                    <input
                      type="checkbox"
                      checked={aiConsent}
                      onChange={(e) => setAiConsent(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#8B7CFF] rounded"
                      required
                    />
                    <span>
                      I consent to document AI parsing &amp; autonomous agent execution <span className="text-red-400">*</span>
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !termsAccepted || !privacyAccepted || !aiConsent}
                  className="w-full py-3 rounded-xl glass-btn-primary text-white font-bold text-xs shadow-lg shadow-[#8B7CFF]/25 flex items-center justify-center gap-2 transition-all cursor-pointer mt-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Recording Consent &amp; Creating Workspace...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Register &amp; Create Tenant Workspace</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Quick Sandbox / Offline Studio Launch */}
          <div className="pt-4 mt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-[#9BA3BD]">Want to test offline first?</span>
            <button
              type="button"
              onClick={handleGuestEntry}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-[#F4F5FF] font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-white/15"
            >
              <span>Instant Guest Mode (No Sign Up)</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#42D6E8]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
