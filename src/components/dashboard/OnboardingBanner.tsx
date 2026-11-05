import React, { useState } from 'react';
import { Sparkles, FileText, UploadCloud, ArrowRight, X, CheckCircle2, Zap } from 'lucide-react';

interface OnboardingBannerProps {
  onOpenCommandPalette: () => void;
  onExploreTemplates: () => void;
}

export const OnboardingBanner: React.FC<OnboardingBannerProps> = ({
  onOpenCommandPalette,
  onExploreTemplates,
}) => {
  const STORAGE_DISMISS_KEY = 'omnidoc_onboarding_dismissed_v1';
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem(STORAGE_DISMISS_KEY) === 'true';
  });

  if (isDismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_DISMISS_KEY, 'true');
    setIsDismissed(true);
  };

  return (
    <div className="relative overflow-hidden rounded-[24px] glass-panel border border-white/12 text-[#F4F5FF] p-5 sm:p-6 shadow-2xl select-none animate-in fade-in">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[#8B7CFF]/15 rounded-full blur-3xl pointer-events-none glow-purple" />
      <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-[#42D6E8]/10 rounded-full blur-3xl pointer-events-none glow-cyan" />

      {/* Dismiss Button */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.15] text-[#9BA3BD] hover:text-[#F4F5FF] transition-colors cursor-pointer border border-white/5"
        title="Dismiss Guide"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="relative z-10 space-y-4">
        {/* Title & Badge */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="px-2.5 py-0.5 rounded-full bg-[#8B7CFF]/20 border border-[#8B7CFF]/30 text-[#8B7CFF] font-bold text-[10px] tracking-wide uppercase flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Fast-Track Guide</span>
          </span>
          <h2 className="text-base sm:text-lg font-black tracking-tight text-[#F4F5FF]">
            Welcome to OmniDoc Studio — Autonomous Document Engineering
          </h2>
        </div>

        {/* 3 Step Interactive Workflow Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Step 1 */}
          <div className="p-3.5 rounded-2xl glass-card border-white/10 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-lg bg-[#8B7CFF]/25 border border-[#8B7CFF]/40 text-[#F4F5FF] font-extrabold text-[11px] flex items-center justify-center shrink-0">
                1
              </span>
              <span className="font-bold text-xs text-[#F4F5FF]">Drop or Pick Studio</span>
            </div>
            <p className="text-[11px] text-[#9BA3BD] leading-snug">
              Drag any file into the workspace, or launch a dedicated editor suite below.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 rounded-2xl glass-card border-white/10 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-lg bg-[#42D6E8]/25 border border-[#42D6E8]/40 text-[#42D6E8] font-extrabold text-[11px] flex items-center justify-center shrink-0">
                2
              </span>
              <span className="font-bold text-xs text-[#F4F5FF]">Edit, Transform &amp; Sign</span>
            </div>
            <p className="text-[11px] text-[#9BA3BD] leading-snug">
              Edit PDF text, execute spreadsheet formulas, manipulate vectors, or run OCR client-side.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 rounded-2xl glass-card border-white/10 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-lg bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-extrabold text-[11px] flex items-center justify-center shrink-0">
                3
              </span>
              <span className="font-bold text-xs text-[#F4F5FF]">Export &amp; Verify Receipts</span>
            </div>
            <p className="text-[11px] text-[#9BA3BD] leading-snug">
              Download high-res PDF, Word, PowerPoint, Excel, or verifiable SHA-256 signed receipts.
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-white/10">
          <div className="flex items-center gap-2 text-[11px] text-[#9BA3BD]">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>100% Client-Side RAM Sandbox • Zero cloud upload • Strict Privacy</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCommandPalette}
              className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-[#F4F5FF] text-xs font-semibold border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Command Menu</span>
              <kbd className="px-1.5 py-0.2 rounded bg-white/10 font-mono text-[9px] text-[#9BA3BD]">
                Ctrl+K
              </kbd>
            </button>
            <button
              onClick={onExploreTemplates}
              className="px-3 py-1.5 rounded-xl glass-btn-primary text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[#8B7CFF]/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Explore Templates</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
