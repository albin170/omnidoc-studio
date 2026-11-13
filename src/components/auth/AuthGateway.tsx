import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
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
  ShieldCheck
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

  // Check health on mount and when API URL changes
  useEffect(() => {
    let isMounted = true;
    const probe = async () => {
      // Auto-purge any stale or dead Render placeholders
      const cur = omniDocClient.getBaseUrl();
      if (cur.includes('onrender.com') || cur.includes('your-fastapi-backend')) {
        const liveCloudUrl = typeof window !== 'undefined' && !window.location.origin.includes('localhost')
          ? `${window.location.origin}/api/v1`
          : 'http://localhost:8000/api/v1';
        omniDocClient.setBaseUrl(liveCloudUrl);
        if (isMounted) {
          setCustomApiUrl(liveCloudUrl);
        }
      }

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
    addToast('info', 'API Endpoint Updated', `Testing connection to backend service...`);
    setShowUrlConfig(false);
    setServerStatus('checking');
    omniDocClient.getHealth(3000)
      .then(() => {
        setServerStatus('online');
        setServerUnreachable(false);
        addToast('success', 'Backend Connected', 'Connection successfully verified.');
      })
      .catch(() => {
        setServerStatus('offline');
        addToast('error', 'Connection Failed', `Could not reach backend service.`);
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
        addToast('error', 'Service Temporarily Unavailable', 'Unable to reach the backend service. You can continue working in Offline Studio Sandbox.');
      } else {
        addToast('error', 'Authentication Failed', err?.message || 'Invalid email or password. Please verify your credentials.');
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
        'user',
        'free'
      );
      sandbox.rememberMe = rememberMe;
      onAuthenticate(sandbox);
      addToast('info', 'Offline Sandbox Ready', 'Document studio running with client-side processing.');
    } catch {
      addToast('error', 'Sandbox Initialization Failed', 'Could not start offline session.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || !name.trim()) {
      addToast('warning', 'Fields Required', 'Please fill in all required registration fields.');
      return;
    }

    if (!termsAccepted || !privacyAccepted || !aiConsent) {
      addToast('warning', 'Consent Required', 'Please accept the Terms of Service and Privacy Policy.');
      return;
    }

    setIsLoading(true);
    setServerUnreachable(false);

    try {
      const session = await registerWithBackend({
        email: email.trim(),
        password,
        full_name: name.trim(),
        organization_name: orgName.trim() || undefined,
        terms_accepted: termsAccepted,
        privacy_accepted: privacyAccepted,
        ai_consent: aiConsent,
      });
      session.rememberMe = rememberMe;
      onAuthenticate(session);
      addToast('success', 'Account Registered', `Welcome to OmniDoc Studio, ${session.userName}!`);
    } catch (err: any) {
      const isNetworkErr = err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError');
      if (isNetworkErr) {
        setServerUnreachable(true);
        setServerStatus('offline');
        addToast('error', 'Registration Server Offline', 'The backend service is currently unreachable. You can continue in Offline Studio Sandbox.');
      } else {
        addToast('error', 'Registration Failed', err?.message || 'Could not complete registration.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestEntry = async () => {
    setIsLoading(true);
    try {
      const guestSession = await createSecureSession(
        'guest@omnidoc.io',
        'Guest Architect',
        'user',
        'free'
      );
      guestSession.isGuest = true;
      guestSession.rememberMe = false;
      onAuthenticate(guestSession);
      addToast('info', 'Guest Mode', 'Guest session active. All local document studios are available.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#03050C]/95 backdrop-blur-2xl overflow-y-auto select-none">
      {/* Dynamic Spatial Ambient Lighting — Red & Blue */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#FF3366]/18 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-[#38BDF8]/18 blur-[160px] pointer-events-none" />

      {/* Main Liquid Glass Modal Card */}
      <div className="relative w-full max-w-4xl rounded-[28px] border border-white/20 lg-liquid-6 shadow-[0_30px_90px_rgba(0,0,0,0.9)] overflow-hidden grid grid-cols-1 md:grid-cols-12 my-auto">
        
        {/* Left Side: Brand & Live Architecture Badge (5 cols) */}
        <div className="md:col-span-5 p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/10 bg-gradient-to-br from-[#FF3366]/15 via-[#060B18]/92 to-[#38BDF8]/15 relative overflow-hidden">
          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-3">
              <OmniDocLogo className="w-9 h-9" />
              <div>
                <span className="text-xl font-black tracking-tight text-[#F5FAFF] font-display">OmniDoc</span>
                <span className="text-xs px-2 py-0.5 ml-1.5 rounded-full bg-gradient-to-r from-[#FF3366]/20 to-[#38BDF8]/20 text-[#38BDF8] font-mono border border-[#38BDF8]/30 font-bold">
                  {mode === 'admin' ? 'ADMIN' : 'STUDIO'}
                </span>
                <p className="text-[10px] text-[#A7B8CA] font-medium tracking-wide">
                  {mode === 'admin' ? 'Administrative Governance Console' : 'Liquid Glass Workspace'}
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-[#F5FAFF] leading-tight font-display">
                {mode === 'admin' ? (
                  <>Secure Governance &amp; SaaS Management Portal</>
                ) : (
                  <>Convert, Edit &amp; Verify Any Document.</>
                )}
              </h2>
              <p className="text-xs text-[#A7B8CA] mt-2 leading-relaxed">
                {mode === 'admin' ? (
                  'Centrally manage users, plans, pricing limits, and audit trails with verifiable backend enforcement.'
                ) : (
                  'High-precision document production environment with floating liquid glass material architecture.'
                )}
              </p>
            </div>

            {/* Feature Bullets */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-2.5 text-xs text-[#F5FAFF]">
                <CheckCircle2 className="w-4 h-4 text-[#FF3366] shrink-0 mt-0.5" />
                <span>Backend JWT authentication &amp; tenant isolation</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-[#F5FAFF]">
                <CheckCircle2 className="w-4 h-4 text-[#38BDF8] shrink-0 mt-0.5" />
                <span>Full-suite PDF, OpenXML Word, PPTX &amp; Excel engines</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-[#F5FAFF]">
                <CheckCircle2 className="w-4 h-4 text-[#FF3366] shrink-0 mt-0.5" />
                <span>Zero-leak client-side privacy &amp; verified redaction</span>
              </div>
            </div>
          </div>

          {/* Clean Status Footer with Non-Intrusive Advanced Settings Option */}
          <div className="pt-6 border-t border-white/10 flex flex-col gap-2 relative z-10 text-[11px] text-[#A7B8CA]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span className="font-medium">Backend Engine</span>
              </div>
              <div className="flex items-center gap-1.5">
                {serverStatus === 'checking' && (
                  <span className="px-2 py-0.5 rounded-full bg-[#38BDF8]/20 text-[#38BDF8] font-mono text-[10px] font-bold border border-[#38BDF8]/30 animate-pulse">
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
                    OFFLINE
                  </span>
                )}
              </div>
            </div>

            {/* Subtle Advanced API Endpoint Toggle */}
            <div className="flex items-center justify-between text-[10px] pt-1">
              <span className="text-[#73869A]">Advanced Settings</span>
              <button
                type="button"
                onClick={() => setShowUrlConfig(!showUrlConfig)}
                className="text-[#38BDF8] hover:text-[#FF3366] transition-colors cursor-pointer flex items-center gap-1 font-semibold"
              >
                <Sliders className="w-3 h-3" />
                <span>{showUrlConfig ? 'Hide Endpoint' : 'Configure Endpoint'}</span>
              </button>
            </div>

            {/* Advanced Endpoint Drawer (Folded by default) */}
            {showUrlConfig && (
              <form onSubmit={handleSaveApiUrl} className="mt-2 space-y-2 p-2.5 rounded-xl bg-black/40 border border-white/15 animate-fade-in">
                <label className="text-[10px] text-[#A7B8CA] font-medium block">
                  Backend API Endpoint:
                </label>
                <input
                  type="url"
                  value={customApiUrl}
                  onChange={(e) => setCustomApiUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg lg-input"
                />
                <div className="flex justify-end gap-1.5 pt-1">
                  <button
                    type="submit"
                    className="px-2.5 py-1 text-[10px] rounded lg-btn-primary font-bold"
                  >
                    Save &amp; Test
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right Side: Auth Form (7 cols) */}
        <div className="md:col-span-7 p-7 sm:p-10 flex flex-col justify-between bg-[#060C1B]/80 backdrop-blur-xl text-[#F5FAFF] overflow-y-auto max-h-[85vh]">
          <div>
            {/* Mode Switcher */}
            <div className="flex items-center justify-between pb-5">
              <div className="flex p-1 rounded-2xl bg-white/[0.05] border border-white/15 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                    mode === 'signin'
                      ? 'bg-gradient-to-r from-[#FF3366] to-[#38BDF8] text-white font-black shadow-[0_0_18px_rgba(255,51,102,0.45),0_0_18px_rgba(56,189,248,0.3)] border border-white/30'
                      : 'text-[#A7B8CA] hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                    mode === 'signup'
                      ? 'bg-gradient-to-r from-[#FF3366] to-[#38BDF8] text-white font-black shadow-[0_0_18px_rgba(255,51,102,0.45),0_0_18px_rgba(56,189,248,0.3)] border border-white/30'
                      : 'text-[#A7B8CA] hover:text-white'
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

              <span className="text-[11px] font-semibold text-[#A7B8CA] hidden sm:inline">
                {mode === 'admin' ? 'Admin Portal' : (mode === 'signin' ? 'User Portal' : 'Registration')}
              </span>
            </div>

            {/* Form Title */}
            <div className="mb-4">
              <h3 className="text-xl font-extrabold text-[#F5FAFF] tracking-tight flex items-center gap-2 font-display">
                {mode === 'admin' && <ShieldAlert className="w-5 h-5 text-amber-400" />}
                {mode === 'admin' && 'Administrator Portal Sign In'}
                {mode === 'signin' && 'Sign In to OmniDoc Studio'}
                {mode === 'signup' && 'Register Workspace Account'}
              </h3>
              <p className="text-xs text-[#A7B8CA] mt-0.5">
                {mode === 'admin' && 'Enter administrator credentials to manage users, plans, and system status.'}
                {mode === 'signin' && 'Enter credentials to authenticate with the OmniDoc cloud server.'}
                {mode === 'signup' && 'Create your tenant workspace with transactional consent recording.'}
              </p>
            </div>

            {/* Server Unreachable Friendly Diagnostic */}
            {serverUnreachable && (
              <div className="mb-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2 animate-fade-in">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">Cloud Service Temporarily Offline</span>
                    <span>The remote server is currently not responding. You can work without interruption using the local sandbox.</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-amber-500/20 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLaunchLocalSandbox}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition-all cursor-pointer flex items-center gap-1.5 shadow"
                  >
                    <span>Launch in Offline Studio Sandbox</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Form */}
            {(mode === 'signin' || mode === 'admin') ? (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#F5FAFF] mb-1.5">
                    {mode === 'admin' ? 'Administrator Email' : 'Email Address'}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-[#A7B8CA]" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={mode === 'admin' ? 'admin@company.com' : 'alex@company.com'}
                      autoComplete="username"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl lg-input text-xs"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#F5FAFF] mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-[#A7B8CA]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl lg-input text-xs"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-[#A7B8CA] hover:text-[#F5FAFF] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-[#A7B8CA]">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 accent-[#FF3366] rounded cursor-pointer"
                    />
                    <span>Remember me on this browser</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-3.5 rounded-xl font-extrabold text-xs tracking-wide shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer mt-4 active:scale-[0.99] ${
                    mode === 'admin'
                      ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-black shadow-amber-500/30 hover:from-amber-400 hover:to-amber-500 border border-amber-300/40'
                      : 'bg-gradient-to-r from-[#FF3366] via-[#E11D48] to-[#38BDF8] hover:from-[#FF4D7D] hover:via-[#FF3366] hover:to-[#50C8FF] text-white shadow-[0_10px_35px_rgba(255,51,102,0.4),0_10px_35px_rgba(56,189,248,0.3)] border border-white/30'
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
                  <label className="block text-xs font-semibold text-[#F5FAFF] mb-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 w-4 h-4 text-[#A7B8CA]" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Johnson"
                      className="w-full pl-10 pr-4 py-2 rounded-xl lg-input text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#F5FAFF] mb-1">Work Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 w-4 h-4 text-[#A7B8CA]" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="alex@enterprise.com"
                        className="w-full pl-10 pr-4 py-2 rounded-xl lg-input text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#F5FAFF] mb-1">Workspace / Org</label>
                    <div className="relative">
                      <Building className="absolute left-3.5 top-3 w-4 h-4 text-[#A7B8CA]" />
                      <input
                        type="text"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="Acme Global Inc"
                        className="w-full pl-10 pr-4 py-2 rounded-xl lg-input text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#F5FAFF] mb-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-[#A7B8CA]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full pl-10 pr-10 py-2 rounded-xl lg-input text-xs"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-[#A7B8CA] hover:text-[#F5FAFF] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Consent Checkboxes */}
                <div className="space-y-2 pt-2 border-t border-[rgba(255, 255, 255,0.12)]">
                  <label className="flex items-start gap-2 cursor-pointer text-[11px] text-[#F5FAFF]">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#38BDF8] rounded"
                      required
                    />
                    <span>
                      I agree to the <span className="text-[#38BDF8] font-semibold underline">Terms of Service</span> (v2026.1) <span className="text-red-400">*</span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer text-[11px] text-[#F5FAFF]">
                    <input
                      type="checkbox"
                      checked={privacyAccepted}
                      onChange={(e) => setPrivacyAccepted(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#38BDF8] rounded"
                      required
                    />
                    <span>
                      I acknowledge the <span className="text-[#38BDF8] font-semibold underline">Privacy Policy</span> (v2026.1) <span className="text-red-400">*</span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer text-[11px] text-[#F5FAFF]">
                    <input
                      type="checkbox"
                      checked={aiConsent}
                      onChange={(e) => setAiConsent(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#38BDF8] rounded"
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
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#FF3366] via-[#E11D48] to-[#38BDF8] hover:from-[#FF4D7D] hover:via-[#FF3366] hover:to-[#50C8FF] text-white font-extrabold text-xs tracking-wide shadow-[0_10px_35px_rgba(255,51,102,0.4),0_10px_35px_rgba(56,189,248,0.3)] border border-white/30 flex items-center justify-center gap-2 transition-all cursor-pointer mt-2 disabled:opacity-40 active:scale-[0.99]"
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
          <div className="pt-4 mt-3 border-t border-[rgba(255, 255, 255,0.12)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-[#A7B8CA]">Want to test offline first?</span>
            <button
              type="button"
              onClick={handleGuestEntry}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-white/[0.07] to-white/[0.04] hover:from-white/[0.14] hover:to-white/[0.08] text-[#F5FAFF] font-bold border border-white/20 hover:border-[#38BDF8]/50 shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Instant Guest Mode (No Sign Up)</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#38BDF8]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
