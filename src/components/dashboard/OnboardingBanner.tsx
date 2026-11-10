import React, { useState } from 'react';
import { FileText, ArrowRight, X, CheckCircle2, Zap } from 'lucide-react';

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
    <div className="relative overflow-hidden rounded-[24px] lg-primary border border-[rgba(180,225,255,0.22)] text-[#F5FAFF] p-5 sm:p-6 shadow-2xl select-none animate-fade-in">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[#A8DEFA]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-[#7CC4ED]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Dismiss Button */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.15] text-[#A7B8CA] hover:text-[#F5FAFF] transition-colors cursor-pointer border border-white/5"
        title="Dismiss Guide"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="relative z-10 space-y-4">
        {/* Title & Badge */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="px-2.5 py-0.5 rounded-full bg-[#A8DEFA]/15 border border-[#A8DEFA]/30 text-[#A8DEFA] font-bold text-[10px] tracking-wide uppercase flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Fast-Track Guide</span>
          </span>
          <h2 className="text-base sm:text-lg font-black tracking-tight text-[#F5FAFF] font-display">
            Welcome to OmniDoc Studio — Floating Liquid Glass Workspace
          </h2>
        </div>

        {/* 3 Step Interactive Workflow Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Step 1 */}
          <div className="p-3.5 rounded-2xl lg-secondary space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-lg bg-[#A8DEFA]/20 border border-[#A8DEFA]/35 text-[#F5FAFF] font-extrabold text-[11px] flex items-center justify-center shrink-0">
                1
              </span>
              <span className="font-bold text-xs text-[#F5FAFF]">Drop or Pick Studio</span>
            </div>
            <p className="text-[11px] text-[#A7B8CA] leading-snug">
              Drag any file into the workspace, or launch a dedicated editor suite below.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 rounded-2xl lg-secondary space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-lg bg-[#7CC4ED]/20 border border-[#7CC4ED]/35 text-[#D9F3FF] font-extrabold text-[11px] flex items-center justify-center shrink-0">
                2
              </span>
              <span className="font-bold text-xs text-[#F5FAFF]">Edit, Transform &amp; Sign</span>
            </div>
            <p className="text-[11px] text-[#A7B8CA] leading-snug">
              Edit PDF text, execute spreadsheet formulas, manipulate vectors, or run OCR client-side.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 rounded-2xl lg-secondary space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-lg bg-emerald-500/20 border border-emerald-500/35 text-emerald-300 font-extrabold text-[11px] flex items-center justify-center shrink-0">
                3
              </span>
              <span className="font-bold text-xs text-[#F5FAFF]">Export &amp; Verify Receipts</span>
            </div>
            <p className="text-[11px] text-[#A7B8CA] leading-snug">
              Download high-res PDF, Word, PowerPoint, Excel, or verifiable SHA-256 signed receipts.
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-[rgba(180,225,255,0.1)]">
          <div className="flex items-center gap-2 text-[11px] text-[#A7B8CA]">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>High-Speed In-Browser Execution • Privacy Guaranteed</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenCommandPalette}
              className="font-bold text-[#A8DEFA] hover:text-[#D9F3FF] transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>Command Palette (Ctrl+K)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onExploreTemplates}
              className="lg-btn-secondary text-xs py-1 px-3"
            >
              Start from Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
