import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  Zap, 
  CheckCircle2, 
  FileText, 
  RefreshCw, 
  Layers,
  Eye,
  EyeOff,
  Building,
  CheckSquare,
  Square,
  Server
} from 'lucide-react';
import { OmniDocLogo } from '../common/OmniDocLogo';
import { UserSession } from '../../services/storageService';
import { loginWithBackend, registerWithBackend, createSecureSession, requestPasswordReset } from '../../services/authService';
import { useToast } from '../../services/toastService';

interface AuthGatewayProps {
  onAuthenticate: (session: UserSession) => void;
}

export const AuthGateway: React.FC<AuthGatewayProps> = ({ onAuthenticate }) => {
  const { addToast } = useToast();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [specialty, setSpecialty] = useState('All-in-One Studio');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Consent Management (Phase 2B) - Default to unchecked per compliance guidelines
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      addToast('warning', 'Email Required', 'Please enter your email address to sign in.');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      addToast('warning', 'Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      addToast('warning', 'Password Required', 'Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Attempt real server-side authentication
      const session = await loginWithBackend(email.trim(), password);
      session.rememberMe = rememberMe;
      onAuthenticate(session);
      addToast('success', 'Backend Authenticated', `Signed in as ${session.userName} with server-verified JWT.`);
    } catch (err: any) {
      console.warn('Backend login error:', err);
      const isNetworkErr = err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError');
      if (isNetworkErr) {
        addToast('error', 'Authentication Server Unreachable', 'Could not connect to the authentication server. Please check your network connection.');
      } else {
        addToast('error', 'Authentication Failed', err?.message || 'Invalid credentials. Please verify your email and password.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim() || !email.includes('@')) {
      addToast('warning', 'Email Required', 'Please enter your email address in the email field first.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await requestPasswordReset(email.trim());
      if (res.success) {
        addToast('success', 'Reset Request Sent', res.message);
      } else {
        addToast('error', 'Reset Failed', res.message);
      }
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

    // Enforce Mandatory Consents (Phase 2B)
    if (!termsAccepted) {
      addToast('warning', 'Terms Required', 'You must explicitly accept the Terms and Conditions.');
      return;
    }
    if (!privacyAccepted) {
      addToast('warning', 'Privacy Acknowledgement Required', 'You must acknowledge the Privacy Policy.');
      return;
    }
    if (!aiConsent) {
      addToast('warning', 'AI Consent Required', 'You must consent to document AI processing to use OmniDoc Studio.');
      return;
    }

    setIsLoading(true);
    try {
      const session = await registerWithBackend({
        email: email.trim(),
        password,
        full_name: name.trim(),
        organization_name: orgName.trim() || `${name.trim()}'s Workspace`,
        terms_accepted: termsAccepted,
        terms_version: '2026.1',
        privacy_accepted: privacyAccepted,
        privacy_version: '2026.1',
        ai_consent: aiConsent,
        ai_consent_version: '2026.1',
        marketing_consent: marketingConsent,
      });

      session.rememberMe = rememberMe;
      onAuthenticate(session);
      addToast('success', 'Account Registered', `Welcome to OmniDoc Studio, ${name.trim()}! Server policy consent recorded.`);
    } catch (err: any) {
      console.warn('Backend registration error:', err);
      const isNetworkErr = err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError');
      if (isNetworkErr) {
        addToast('error', 'Authentication Server Unreachable', 'Could not reach the server to register account. Network connection required.');
      } else {
        addToast('error', 'Registration Error', err?.message || 'Could not register user. Please check your details.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestEntry = () => {
    const session: UserSession = {
      isGuest: true,
      userName: 'Guest Explorer',
      userEmail: '',
      storageUsedBytes: 0,
      isAuthenticated: false,
      rememberMe: false,
      role: 'guest',
      planTier: 'free',
      isLocalPrototype: true,
    };

    onAuthenticate(session);
    addToast('info', 'Guest Session Started', 'Browsing in local guest sandbox mode.');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#080B18] select-none relative overflow-hidden">
      {/* Aurora Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#8B7CFF]/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#42D6E8]/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Outer Card with Glassmorphic Glow */}
      <div className="w-full max-w-4xl glass-panel rounded-[32px] overflow-hidden shadow-2xl border border-white/15 grid grid-cols-1 md:grid-cols-12 min-h-[580px] relative z-10">
        {/* Left Side: Brand Visual & Value Props (5 cols) */}
        <div className="md:col-span-5 bg-gradient-to-br from-[#0c1024] via-[#111633] to-[#080B18] p-7 sm:p-9 text-[#F4F5FF] flex flex-col justify-between relative overflow-hidden border-r border-white/10">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#8B7CFF]/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#42D6E8]/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-6">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <OmniDocLogo size={42} />
              <div>
                <div className="font-extrabold text-lg tracking-tight flex items-center gap-1.5 text-white">
                  <span>OmniDoc</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#8B7CFF]/20 text-[#8B7CFF] border border-[#8B7CFF]/30 font-mono font-bold">
                    STUDIO
                  </span>
                </div>
                <p className="text-xs text-[#9BA3BD]">Autonomous Document Engineering</p>
              </div>
            </div>

            {/* Headline */}
            <div className="space-y-2 pt-4">
              <h2 className="text-xl sm:text-2xl font-black leading-tight tracking-tight text-[#F4F5FF]">
                Convert, Edit &amp; Verify Any Document.
              </h2>
              <p className="text-xs text-[#9BA3BD] leading-relaxed">
                The enterprise workspace with real backend security, cryptographic verification, and strict tenant isolation.
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

          {/* Server Connection Badge */}
          <div className="pt-6 border-t border-white/10 flex items-center justify-between text-[11px] text-[#9BA3BD] relative z-10">
            <div className="flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-[#42D6E8]" />
              <span>FastAPI 2.0 Auth Ready</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30">
              ACTIVE
            </span>
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
                  className={`px-4 py-1.5 rounded-xl transition-all cursor-pointer ${
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
                  className={`px-4 py-1.5 rounded-xl transition-all cursor-pointer ${
                    mode === 'signup'
                      ? 'bg-gradient-to-r from-[#8B7CFF] to-[#7363f8] text-white shadow-sm'
                      : 'text-[#9BA3BD] hover:text-white'
                  }`}
                >
                  Create Account
                </button>
              </div>

              <span className="text-[11px] font-semibold text-[#9BA3BD] hidden sm:inline">
                {mode === 'signin' ? 'Server Authentication' : 'Consent-Verified Registration'}
              </span>
            </div>

            {/* Form Title */}
            <div className="mb-4">
              <h3 className="text-xl font-extrabold text-[#F4F5FF] tracking-tight">
                {mode === 'signin' ? 'Sign In to OmniDoc Studio' : 'Register Enterprise Account'}
              </h3>
              <p className="text-xs text-[#9BA3BD] mt-0.5">
                {mode === 'signin'
                  ? 'Enter credentials to authenticate with the backend server.'
                  : 'Create an isolated organization workspace with explicit policy consent.'}
              </p>
            </div>

            {/* Sign In Form */}
            {mode === 'signin' ? (
              <form onSubmit={handleSignIn} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-[#9BA3BD] block mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#9BA3BD] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. architect@omnidoc.studio"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-white/15 bg-white/[0.04] focus:border-[#8B7CFF] focus:ring-2 focus:ring-[#8B7CFF]/20 outline-none text-[#F4F5FF] placeholder:text-[#9BA3BD]/50 text-xs font-medium transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-[#9BA3BD]">Password</label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-[11px] text-[#8B7CFF] hover:underline cursor-pointer bg-transparent border-none p-0 outline-none"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#9BA3BD] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-white/15 bg-white/[0.04] focus:border-[#8B7CFF] focus:ring-2 focus:ring-[#8B7CFF]/20 outline-none text-[#F4F5FF] placeholder:text-[#9BA3BD]/50 text-xs font-medium transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9BA3BD] hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
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
                  className="w-full py-3 rounded-xl glass-btn-primary text-white font-bold text-xs shadow-lg shadow-[#8B7CFF]/25 flex items-center justify-center gap-2 transition-all cursor-pointer mt-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In &amp; Launch Studio</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Sign Up Form with Consent (Phase 2B) */
              <form onSubmit={handleSignUp} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-[#9BA3BD] block mb-1">Your Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#9BA3BD] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alex Mercer"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-white/15 bg-white/[0.04] focus:border-[#8B7CFF] focus:ring-2 focus:ring-[#8B7CFF]/20 outline-none text-[#F4F5FF] placeholder:text-[#9BA3BD]/50 text-xs font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-[#9BA3BD] block mb-1">Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#9BA3BD] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. alex@company.com"
                        required
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-white/15 bg-white/[0.04] focus:border-[#8B7CFF] focus:ring-2 focus:ring-[#8B7CFF]/20 outline-none text-[#F4F5FF] placeholder:text-[#9BA3BD]/50 text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-[#9BA3BD] block mb-1">Organization / Tenant</label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-[#9BA3BD] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="e.g. Acme Corp"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-white/15 bg-white/[0.04] focus:border-[#8B7CFF] focus:ring-2 focus:ring-[#8B7CFF]/20 outline-none text-[#F4F5FF] placeholder:text-[#9BA3BD]/50 text-xs font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-[#9BA3BD] block mb-1">Password (Min 8 Characters)</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#9BA3BD] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a strong password"
                      required
                      minLength={8}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-white/15 bg-white/[0.04] focus:border-[#8B7CFF] focus:ring-2 focus:ring-[#8B7CFF]/20 outline-none text-[#F4F5FF] placeholder:text-[#9BA3BD]/50 text-xs font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9BA3BD] hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Consent Management Section (Phase 2B) */}
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2 mt-2">
                  <span className="text-[11px] font-bold text-[#8B7CFF] uppercase tracking-wider block mb-1">
                    Compliance &amp; Policy Consents
                  </span>

                  <label className="flex items-start gap-2 cursor-pointer text-[11px] text-[#F4F5FF]">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#8B7CFF] rounded"
                      required
                    />
                    <span>
                      I agree to the <span className="text-[#8B7CFF] font-semibold underline">Terms &amp; Conditions</span> (v2026.1) <span className="text-red-400">*</span>
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
                      I acknowledge the <span className="text-[#8B7CFF] font-semibold underline">Privacy Policy &amp; DPA</span> (v2026.1) <span className="text-red-400">*</span>
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

                  <label className="flex items-start gap-2 cursor-pointer text-[11px] text-[#9BA3BD]">
                    <input
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#8B7CFF] rounded"
                    />
                    <span>
                      Send me product updates and release announcements (Optional)
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
                      <span>Recording Consent &amp; Creating Account...</span>
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

          {/* Quick Demo & Guest Access */}
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
