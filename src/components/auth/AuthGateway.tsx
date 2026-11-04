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
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-[#dfe6fe] via-[#e9edf9] to-[#f4e8fa] select-none">
      {/* Outer Card with Glassmorphic Glow */}
      <div className="w-full max-w-4xl glass-card rounded-[32px] overflow-hidden shadow-2xl border border-white/80 grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
        {/* Left Side: Brand Visual & Value Props (5 cols) */}
        <div className="md:col-span-5 bg-gradient-to-br from-[#091538] via-[#0d1d4d] to-[#07112c] p-7 sm:p-9 text-white flex flex-col justify-between relative overflow-hidden">
          {/* Subtle ambient light discs */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-6">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <OmniDocLogo size={42} />
              <div>
                <div className="font-extrabold text-lg tracking-tight flex items-center gap-1.5">
                  <span>OmniDoc</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/30 text-blue-300 font-mono font-bold">
                    STUDIO
                  </span>
                </div>
                <p className="text-xs text-slate-400">All documents. One workspace.</p>
              </div>
            </div>

            {/* Headline */}
            <div className="space-y-2 pt-4">
              <h2 className="text-xl sm:text-2xl font-black leading-tight tracking-tight text-white">
                Convert, Edit &amp; Create Any Document.
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                The all-in-one document suite that runs 100% private in your browser with zero cloud leaks.
              </p>
            </div>

            {/* Feature Bullets */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-2.5 text-xs text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Full PDF editor with text, watermarks &amp; signatures</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>Word (DOCX) &amp; PowerPoint (PPTX) generator</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <span>Smart AI Background Remover &amp; Tesseract OCR</span>
              </div>
            </div>
          </div>

          {/* Privacy Footnote */}
          <div className="pt-6 border-t border-white/10 flex items-center gap-2 text-[11px] text-slate-400 relative z-10">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Encrypted local execution on your device</span>
          </div>
        </div>

        {/* Right Side: Auth Form (7 cols) */}
        <div className="md:col-span-7 p-7 sm:p-10 flex flex-col justify-between bg-white/85 backdrop-blur-xl">
          <div>
            {/* Mode Switcher */}
            <div className="flex items-center justify-between pb-6">
              <div className="flex p-1 rounded-2xl bg-slate-100 border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className={`px-4 py-1.5 rounded-xl transition-all cursor-pointer ${
                    mode === 'signin'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className={`px-4 py-1.5 rounded-xl transition-all cursor-pointer ${
                    mode === 'signup'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Create Account
                </button>
              </div>

              <span className="text-[11px] font-semibold text-slate-400 hidden sm:inline">
                {mode === 'signin' ? 'Existing User' : 'New User'}
              </span>
            </div>

            {/* Form Title */}
            <div className="mb-4">
              <div className="mb-3 p-3 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-[11px] leading-relaxed">
                <div className="font-bold flex items-center gap-1.5 text-amber-800 mb-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span>Client-Side Evaluation Mode</span>
                </div>
                OmniDoc Studio executes locally in browser memory without an external backend auth service. Email &amp; preferences are stored privately on this device only.
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {mode === 'signin' ? 'Welcome to OmniDoc Studio' : 'Create your local workspace'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {mode === 'signin'
                  ? 'Sign in to access your saved projects and document history.'
                  : 'Start converting and editing documents without restrictions.'}
              </p>
            </div>

            {/* Sign In Form */}
            {mode === 'signin' ? (
              <form onSubmit={handleSignIn} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. architect@omnidoc.studio"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-800 text-xs font-medium transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-slate-700">Password</label>
                    <span className="text-[11px] text-blue-600 hover:underline cursor-pointer">
                      Forgot?
                    </span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-800 text-xs font-medium transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 accent-blue-600 rounded"
                    />
                    <span>Remember me (enter directly next time)</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer mt-2"
                >
                  <span>Sign In &amp; Open Studio</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              /* Sign Up Form */
              <form onSubmit={handleSignUp} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Your Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alex Mercer"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-800 text-xs font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. alex@company.com"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-800 text-xs font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-800 text-xs font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Workspace Specialty</label>
                  <select
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-medium outline-none"
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
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer mt-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Create Free Pro Account</span>
                </button>
              </form>
            )}
          </div>

          {/* Quick Demo & Guest Access */}
          <div className="pt-5 mt-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-500">Want to test first?</span>
            <button
              type="button"
              onClick={handleGuestEntry}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Instant Guest Mode (No Sign Up)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
