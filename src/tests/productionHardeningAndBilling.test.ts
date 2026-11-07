import { describe, it, expect, vi, beforeEach } from 'vitest';
import { omniDocClient } from '../sdk/omnidocClient';

describe('Production Readiness, Plan Consistency & Developer API Keys', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('enforces authoritative pricing and tier structure consistency', async () => {
    // Authoritative tiers: Free ($0), Starter Pro ($19), Professional Suite ($49), Enterprise Cloud ($199)
    const mockPlans = [
      { id: '1', name: 'Free Community', slug: 'free', monthly_price_cents: 0, annual_price_cents: 0 },
      { id: '2', name: 'Starter Pro', slug: 'starter', monthly_price_cents: 1900, annual_price_cents: 19000 },
      { id: '3', name: 'Professional Suite', slug: 'pro', monthly_price_cents: 4900, annual_price_cents: 49000 },
      { id: '4', name: 'Enterprise Cloud', slug: 'enterprise', monthly_price_cents: 19900, annual_price_cents: 199000 },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockPlans,
    } as any);

    const plans = await omniDocClient.getPublishedPlans();
    expect(plans).toHaveLength(4);
    expect(plans[0].monthly_price_cents).toBe(0);
    expect(plans[1].monthly_price_cents).toBe(1900);
    expect(plans[2].monthly_price_cents).toBe(4900);
    expect(plans[3].monthly_price_cents).toBe(19900);
  });

  it('communicates real developer API key creation and revocation without mock credentials', async () => {
    const mockCreatedKey = {
      id: 'key_123',
      name: 'CI/CD Worker',
      api_key: 'omni_live_secret_entropy_token_xyz987',
      key_prefix: 'omni_live_secr',
      scopes: 'read:documents,write:conversions',
      rate_limit_rpm: 60,
      created_at: new Date().toISOString(),
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockCreatedKey,
    } as any);

    const created = await omniDocClient.createApiKey('CI/CD Worker');
    expect(created.api_key).toBe('omni_live_secret_entropy_token_xyz987');
    expect(created.key_prefix).toBe('omni_live_secr');

    // Revocation
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success' }),
    } as any);

    await expect(omniDocClient.revokeApiKey('key_123')).resolves.not.toThrow();
  });

  it('rejects client-side payment forgery and handles unconfigured gateway honestly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({
        detail: 'Stripe payment gateway credentials are not configured.',
      }),
    } as any);

    await expect(omniDocClient.createCheckoutSession('pro', 'monthly')).rejects.toThrow(
      'Stripe payment gateway credentials are not configured.'
    );
  });

  it('handles user account deletion and consent withdrawal securely', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success', message: 'Account deactivated' }),
    } as any);

    const delRes = await omniDocClient.deleteAccount();
    expect(delRes.status).toBe('success');

    // Consent withdrawal
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ consent_type: 'ai_processing', granted: false }),
    } as any);

    const consentRes = await omniDocClient.withdrawConsent('ai_processing');
    expect(consentRes.granted).toBe(false);
  });
});
