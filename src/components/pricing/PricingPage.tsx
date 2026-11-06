import React, { useState, useEffect } from 'react';
import { 
  Check, 
  X, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  Layers, 
  HardDrive, 
  FileText, 
  Zap, 
  Building,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { PlanTier, UserSession } from '../../services/storageService';
import { omniDocClient } from '../../sdk/omnidocClient';
import { useToast } from '../../services/toastService';

interface PricingPageProps {
  userSession: UserSession;
  onSelectPlan?: (tier: PlanTier) => void;
  onBackToDashboard?: () => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({
  userSession,
  onSelectPlan,
  onBackToDashboard
}) => {
  const { addToast } = useToast();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    omniDocClient.getPublishedPlans()
      .then((data) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setPlans(data);
        }
      })
      .catch((err) => {
        console.warn('Failed to load plans from backend:', err);
        // Fallback default plans
        setPlans([
          {
            slug: 'free',
            name: 'Free Community',
            description: 'Essential document viewing and basic conversions for individuals.',
            monthly_price_cents: 0,
            annual_price_cents: 0,
            storage_quota_bytes: 100 * 1024 * 1024,
            monthly_processing_quota: 50,
            ocr_quota: 15,
            ai_processing_quota: 10,
            workflow_quota: 3,
            has_api_access: false,
            support_level: 'Community',
            features: ['pdf_tools', 'docx_studio', 'sheet_studio', 'image_studio', 'conversion_hub']
          },
          {
            slug: 'starter',
            name: 'Starter Pro',
            description: 'Extended document workflows, OCR scanning, and visual presentations.',
            monthly_price_cents: 1900,
            annual_price_cents: 19000,
            storage_quota_bytes: 1024 * 1024 * 1024,
            monthly_processing_quota: 250,
            ocr_quota: 100,
            ai_processing_quota: 50,
            workflow_quota: 25,
            has_api_access: false,
            support_level: 'Standard Email',
            features: ['pdf_tools', 'pdf_sanitizer', 'docx_studio', 'sheet_studio', 'slide_studio', 'image_studio', 'ocr_engine', 'conversion_hub', 'workflows']
          },
          {
            slug: 'pro',
            name: 'Professional Suite',
            description: 'Autonomous Document Engineering with full AI intelligence and API access.',
            monthly_price_cents: 4900,
            annual_price_cents: 49000,
            storage_quota_bytes: 10 * 1024 * 1024 * 1024,
            monthly_processing_quota: 1500,
            ocr_quota: 500,
            ai_processing_quota: 300,
            workflow_quota: 100,
            has_api_access: true,
            support_level: 'Priority 24/7',
            features: ['pdf_tools', 'pdf_sanitizer', 'docx_studio', 'sheet_studio', 'slide_studio', 'image_studio', 'ocr_engine', 'conversion_hub', 'workflows', 'autonomous_agent', 'document_forensics', 'api_access']
          },
          {
            slug: 'enterprise',
            name: 'Enterprise Cloud',
            description: 'Unlimited capacity, custom integrations, maximum SLA, and dedicated engineering.',
            monthly_price_cents: 19900,
            annual_price_cents: 199000,
            storage_quota_bytes: 100 * 1024 * 1024 * 1024,
            monthly_processing_quota: 10000,
            ocr_quota: 5000,
            ai_processing_quota: 2500,
            workflow_quota: 1000,
            has_api_access: true,
            support_level: 'Dedicated TAM',
            features: ['pdf_tools', 'pdf_sanitizer', 'docx_studio', 'sheet_studio', 'slide_studio', 'image_studio', 'ocr_engine', 'conversion_hub', 'workflows', 'autonomous_agent', 'document_forensics', 'api_access']
          }
        ]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  const handleUpgradeClick = (plan: any) => {
    if (plan.slug === userSession.planTier) {
      addToast('info', 'Current Plan', `You are currently on the ${plan.name} tier.`);
      return;
    }
    // Honest Payment Processor Notice
    addToast(
      'info',
      'Stripe Integration Gated',
      `Live payment webhook verification is required for production upgrades to ${plan.name}. Please contact your workspace administrator or sales.`
    );
    if (onSelectPlan) {
      onSelectPlan(plan.slug as PlanTier);
    }
  };

  const formatStorage = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(0)} GB`;
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  return (
    <div className="w-full h-full overflow-y-auto p-6 md:p-10 bg-[#080B18] text-[#F4F5FF]">
      {/* Header */}
      <div className="max-w-5xl mx-auto text-center space-y-4 mb-10">
        {onBackToDashboard && (
          <button
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 text-xs text-[#9BA3BD] hover:text-[#F4F5FF] mb-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10"
          >
            ← Return to Dashboard
          </button>
        )}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 text-[#8B7CFF] text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5 text-[#42D6E8]" />
          <span>Transparent Enterprise Pricing</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-[#F4F5FF]">
          Scale Document Intelligence with Complete Confidence
        </h1>
        <p className="text-sm md:text-base text-[#9BA3BD] max-w-2xl mx-auto">
          Choose the right capacity for your organization. All tiers include cryptographic verification and zero-leak PDF sanitization.
        </p>

        {/* Billing Cycle Switcher */}
        <div className="pt-4 flex items-center justify-center gap-3">
          <div className="p-1 rounded-2xl bg-white/5 border border-white/10 inline-flex items-center text-xs font-bold">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-1.5 rounded-xl transition-all cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-gradient-to-r from-[#8B7CFF] to-[#7363f8] text-white shadow-sm'
                  : 'text-[#9BA3BD] hover:text-white'
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-4 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                billingCycle === 'annual'
                  ? 'bg-gradient-to-r from-[#8B7CFF] to-[#7363f8] text-white shadow-sm'
                  : 'text-[#9BA3BD] hover:text-white'
              }`}
            >
              <span>Annual Billing</span>
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                Save 20%
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        {plans.map((plan) => {
          const isCurrent = userSession.planTier === plan.slug;
          const isPopular = plan.slug === 'pro';
          const priceCents = billingCycle === 'annual' ? plan.annual_price_cents / 12 : plan.monthly_price_cents;
          const priceDisplay = priceCents === 0 ? '$0' : `$${(priceCents / 100).toFixed(0)}`;

          return (
            <div
              key={plan.slug}
              className={`relative rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 border ${
                isPopular
                  ? 'bg-gradient-to-b from-[#8B7CFF]/15 via-[#11152A] to-[#11152A] border-[#8B7CFF]/50 shadow-2xl shadow-[#8B7CFF]/20'
                  : 'bg-[#11152A]/70 border-white/10 hover:border-white/20'
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-[#8B7CFF] to-[#42D6E8] text-white text-[10px] font-black tracking-wide uppercase shadow">
                  Most Popular
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-black text-[#F4F5FF]">{plan.name}</h3>
                  {isCurrent && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                      CURRENT
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#9BA3BD] min-h-[36px]">{plan.description}</p>

                {/* Price */}
                <div className="my-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-[#F4F5FF] tracking-tight">{priceDisplay}</span>
                    <span className="text-xs text-[#9BA3BD]">/ month</span>
                  </div>
                  {billingCycle === 'annual' && priceCents > 0 && (
                    <p className="text-[11px] text-[#42D6E8] mt-1">Billed annually (${(plan.annual_price_cents / 100).toFixed(0)}/yr)</p>
                  )}
                </div>

                {/* Quotas Specs */}
                <div className="space-y-2.5 py-4 border-y border-white/10 text-xs text-[#F4F5FF]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#9BA3BD] flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-[#42D6E8]" /> Storage:
                    </span>
                    <span className="font-bold">{formatStorage(plan.storage_quota_bytes)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#9BA3BD] flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#8B7CFF]" /> Monthly Docs:
                    </span>
                    <span className="font-bold">{plan.monthly_processing_quota === -1 ? 'Unlimited' : plan.monthly_processing_quota}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#9BA3BD] flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" /> OCR Pages:
                    </span>
                    <span className="font-bold">{plan.ocr_quota === -1 ? 'Unlimited' : plan.ocr_quota}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#9BA3BD] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" /> AI Operations:
                    </span>
                    <span className="font-bold">{plan.ai_processing_quota === -1 ? 'Unlimited' : plan.ai_processing_quota}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#9BA3BD]">Support:</span>
                    <span className="font-bold">{plan.support_level}</span>
                  </div>
                </div>

                {/* Features Checkmarks */}
                <div className="pt-4 space-y-2 text-xs">
                  <span className="text-[11px] font-bold text-[#9BA3BD] uppercase tracking-wider block mb-2">
                    Included Capabilities:
                  </span>
                  {[
                    { key: 'pdf_tools', label: 'PDF Studio & Annotation' },
                    { key: 'pdf_sanitizer', label: 'Zero-Leak PDF Redaction' },
                    { key: 'docx_studio', label: 'OpenXML Word Editor' },
                    { key: 'sheet_studio', label: 'Excel Spreadsheets & Formulas' },
                    { key: 'ocr_engine', label: 'OCR Text Recognition' },
                    { key: 'workflows', label: 'Visual Workflow Pipelines' },
                    { key: 'autonomous_agent', label: 'Autonomous Document Agent' },
                    { key: 'api_access', label: 'Developer API Access' }
                  ].map((feat) => {
                    const hasFeat = plan.features?.includes(feat.key);
                    return (
                      <div key={feat.key} className="flex items-center gap-2">
                        {hasFeat ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-white/20 shrink-0" />
                        )}
                        <span className={hasFeat ? 'text-[#F4F5FF]' : 'text-white/30'}>
                          {feat.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-6 mt-4">
                <button
                  type="button"
                  onClick={() => handleUpgradeClick(plan)}
                  disabled={isCurrent}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-white/10 text-white/50 cursor-default'
                      : isPopular
                      ? 'glass-btn-primary text-white shadow-lg shadow-[#8B7CFF]/30'
                      : 'bg-white/10 hover:bg-white/15 text-white border border-white/15'
                  }`}
                >
                  {isCurrent ? (
                    'Current Plan'
                  ) : (
                    <>
                      <span>{priceCents === 0 ? 'Select Free Plan' : 'Upgrade Plan'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compliance Notice */}
      <div className="max-w-4xl mx-auto p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-xs text-[#9BA3BD] flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-[#42D6E8] shrink-0" />
        <span>
          Enterprise subscriptions are governed by server-side quota enforcement and verifiable tenant isolation. Payment transactions are audited via cryptographic event logs.
        </span>
      </div>
    </div>
  );
};
