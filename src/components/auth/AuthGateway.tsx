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
  EyeOff
} from 'lucide-react';
import { OmniDocLogo } from '../common/OmniDocLogo';
import { UserSession } from '../../services/storageService';
import { createSecureSession } from '../../services/authService';
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
  const [rememberMe, setRememberMe] = useState(true);
  const [specialty, setSpecialty] = useState('All-in-One Studio');
  const [showPassword, setShowPassword] = useState(false);

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

    const calculatedName = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    const session = await createSecureSession(email.trim(), calculatedName, 'user', 'free');
    session.rememberMe = rememberMe;

    onAuthenticate(session);
    addToast('success', 'Session Authenticated', `Signed in as ${session.userName} (Local Sandbox Auth).`);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('warning', 'Name Required', 'Please enter your name.');
      return;
    }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email.trim())) {
      addToast('warning', 'Valid Email Required', 'Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      addToast('warning', 'Password Required', 'Password must be at least 6 characters.');
      return;
    }

    const session = await createSecureSession(email.trim(), name.trim(), 'user', 'free');
    session.rememberMe = rememberMe;

    onAuthenticate(session);
    addToast('success', 'Profile Created', `Welcome to OmniDoc Studio, ${name.trim()}!`);
  };

  const handleGuestEntry = () => {
    const session: UserSession = {
      isGuest: true,
      userName: 'Guest Explorer',
      userEmail: '',
      storageUsedBytes: 0,
      isAuthenticated: true,
      rememberMe: false,
      role: 'user',
      planTier: 'free',
      isLocalPrototype: true,
    };

    onAuthenticate(session);
    addToast('info', 'Guest Session Started', '100% private in-memory workspace initialized.');
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
          {/* Subtle ambient light discs */}
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
                <p className="text-xs text-[#9BA3BD]">All documents. One workspace.</p>
              </div>
            </div>

            {/* Headline */}
            <div className="space-y-2 pt-4">
              <h2 className="text-xl sm:text-2xl font-black leading-tight tracking-tight text-[#F4F5FF]">
                Convert, Edit &amp; Create Any Document.
              </h2>
              <p className="text-xs text-[#9BA3BD] leading-relaxed">
                The all-in-one document suite that runs 100% private in your browser with zero cloud leaks.
              </p>
            </div>

            {/* Feature Bullets */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-2.5 text-xs text-[#F4F5FF]">
                <CheckCircle2 className="w-4 h-4 text-[#42D6E8] shrink-0 mt-0.5" />
                <span>Full PDF editor with text, watermarks &amp; signatures</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-[#F4F5FF]">
                <CheckCircle2 className="w-4 h-4 text-[#8B7CFF] shrink-0 mt-0.5" />
                <span>Word (DOCX) &amp; PowerPoint (PPTX) generator</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-[#F4F5FF]">
                <CheckCircle2 className="w-4 h-4 text-[#42D6E8] shrink-0 mt-0.5" />
                <span>Smart AI Background Remover &amp; Tesseract OCR</span>
              </div>
            </div>
          </div>

          {/* Privacy Footnote */}
          <div className="pt-6 border-t border-white/10 flex items-center gap-2 text-[11px] text-[#9BA3BD] relative z-10">
            <ShieldCheck className="w-4 h-4 text-[#42D6E8] shrink-0" />
            <span>Encrypted local execution on your device</span>
          </div>
        </div>

        {/* Right Side: Auth Form (7 cols) */}
        <div className="md:col-span-7 p-7 sm:p-10 flex flex-col justify-between bg-white/[0.02] backdrop-blur-xl text-[#F4F5FF]">
          <div>
            {/* Mode Switcher */}
            <div className="flex items-center justify-between pb-6">
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
                {mode === 'signin' ? 'Existing User' : 'New User'}
              </span>
            </div>

            {/* Form Title */}
            <div className="mb-4">
              <div className="mb-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-[11px] leading-relaxed">
                <div className="font-bold flex items-center gap-1.5 text-amber-300 mb-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Client-Side Evaluation Mode</span>
                </div>
                OmniDoc Studio executes locally in browser memory without an external backend auth service. Email &amp; preferences are stored privately on this device only.
              </div>
              <h3 className="text-xl font-extrabold text-[#F4F5FF] tracking-tight">
                {mode === 'signin' ? 'Welcome to OmniDoc Studio' : 'Create your local workspace'}
              </h3>
              <p className="text-xs text-[#9BA3BD] mt-0.5">
                {mode === 'signin'
                  ? 'Sign in to access your saved projects and document history.'
                  : 'Start converting and editing documents without restrictions.'}
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
                    <span className="text-[11px] text-[#8B7CFF] hover:underline cursor-pointer">
                      Forgot?
                    </span>
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
                    <span>Remember me (enter directly next time)</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl glass-btn-primary text-white font-bold text-xs shadow-lg shadow-[#8B7CFF]/25 flex items-center justify-center gap-2 transition-all cursor-pointer mt-2"
                >
                  <span>Sign In &amp; Open Studio</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              /* Sign Up Form */
              <form onSubmit={handleSignUp} className="space-y-3.5 text-xs">
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
                  <label className="font-bold text-[#9BA3BD] block mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#9BA3BD] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password"
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

                <div>
                  <label className="font-bold text-[#9BA3BD] block mb-1">Workspace Specialty</label>
                  <select
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-white/15 bg-[#11152A] text-[#F4F5FF] text-xs font-medium outline-none"
                  >
                    <option value="All-in-One Studio">All-in-One Document Studio (Recommended)</option>
                    <option value="PDF & Signing Specialist">PDF Editing &amp; Signatures Specialist</option>
                    <option value="Office & Presentations">Word (DOCX) &amp; Presentations (PPTX)</option>
                    <option value="Data & Spreadsheets">Spreadsheets (XLSX/CSV) &amp; Calculations</option>
                    <option value="Photo & Graphics">Image Studio &amp; AI Background Removal</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl glass-btn-primary text-white font-bold text-xs shadow-lg shadow-[#8B7CFF]/25 flex items-center justify-center gap-2 transition-all cursor-pointer mt-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Create Free Pro Account</span>
                </button>
              </form>
            )}
          </div>

          {/* Quick Demo & Guest Access */}
          <div className="pt-5 mt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-[#9BA3BD]">Want to test first?</span>
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
