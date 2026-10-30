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
    <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 sm:p-6 shadow-xl border border-white/10 select-none animate-in fade-in">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Dismiss Button */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 p-1 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
        title="Dismiss Guide"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="relative z-10 space-y-4">
        {/* Title & Badge */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="px-2.5 py-0.5 rounded-full bg-blue-500/30 border border-blue-400/30 text-blue-300 font-bold text-[10px] tracking-wide uppercase flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Fast-Track Guide</span>
          </span>
          <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
            Welcome to OmniDoc Studio — Every File, Every Format, One Workspace
          </h2>
        </div>

        {/* 3 Step Interactive Workflow Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Step 1 */}
          <div className="p-3.5 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-500 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0">
                1
              </span>
              <span className="font-bold text-xs text-white">Drop or Pick Studio</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-snug">
              Drag any file anywhere into the window, or launch a dedicated editor below.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-500 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0">
                2
              </span>
              <span className="font-bold text-xs text-white">Edit, Redesign &amp; Sign</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-snug">
              Add signatures, edit text, remove backgrounds, or calculate formulas offline.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0">
                3
              </span>
              <span className="font-bold text-xs text-white">Export &amp; Batch Convert</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-snug">
              Download high-res PDF, Word, PowerPoint, Excel, or ZIP packages instantly.
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-white/10">
          <div className="flex items-center gap-2 text-[11px] text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>100% Client-Side • Zero cloud upload • Maximum data privacy</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenCommandPalette}
              className="px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Command Palette</span>
              <kbd className="px-1.5 py-0.5 rounded bg-black/30 font-mono text-[10px]">Ctrl+K</kbd>
            </button>
            <button
              onClick={onExploreTemplates}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1 shadow-md shadow-blue-500/30 transition-all cursor-pointer"
            >
              <span>Explore Starter Templates</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
