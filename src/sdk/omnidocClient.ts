import {
  AutonomousJob,
  ProcessingMode
} from '../types';

export interface OmniDocClientConfig {
  baseUrl?: string;
  token?: string;
}

export interface BackendUserRegisterPayload {
  email: string;
  password: string;
  full_name: string;
  organization_name?: string;
  terms_accepted: boolean;
  terms_version?: string;
  privacy_accepted: boolean;
  privacy_version?: string;
  ai_consent: boolean;
  ai_consent_version?: string;
  marketing_consent?: boolean;
}

export interface BackendTokenResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  org_id: string;
  role: string;
  email: string;
  full_name?: string;
  plan_tier?: string;
}

export class OmniDocApiClient {
  private baseUrl: string;
  private token: string | null;

  constructor(config: OmniDocClientConfig = {}) {
    let configuredStorageUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('omnidoc_api_url') : null;
    
    // Auto-clear invalid placeholder example URLs from user storage so they connect directly to the active live cloud backend
    if (configuredStorageUrl && (configuredStorageUrl.includes('onrender.com') || configuredStorageUrl.includes('your-fastapi-backend'))) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('omnidoc_api_url');
      }
      configuredStorageUrl = null;
    }

    const liveOriginUrl = typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')
      ? `${window.location.origin}/api/v1`
      : 'http://localhost:8000/api/v1';

    const defaultUrl = configuredStorageUrl || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || liveOriginUrl;
    this.baseUrl = (config.baseUrl || defaultUrl).replace(/\/$/, '');
    this.token = config.token || (typeof localStorage !== 'undefined' ? localStorage.getItem('omnidoc_backend_jwt') : null);
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('omnidoc_api_url', this.baseUrl);
    }
  }

  public setToken(token: string | null) {
    this.token = token;
    if (typeof localStorage !== 'undefined') {
      if (token) {
        localStorage.setItem('omnidoc_backend_jwt', token);
      } else {
        localStorage.removeItem('omnidoc_backend_jwt');
      }
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private get headers(): HeadersInit {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      h['Authorization'] = `Bearer ${this.token}`;
    }
    return h;
  }

  public async getHealth(timeoutMs = 3000): Promise<{ status: string; platform: string; version: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let res = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal,
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch(`${this.baseUrl.replace(/\/api\/v1\/?$/, '')}/health`, {
          signal: controller.signal,
        });
      }
      clearTimeout(timer);
      if (!res || !res.ok) throw new Error(`Health check failed: ${res ? res.statusText : 'Unreachable'}`);
      return res.json();
    } catch (e: any) {
      clearTimeout(timer);
      throw e;
    }
  }

  // --- Real Backend Authentication & Consent ---

  public async register(data: BackendUserRegisterPayload): Promise<any> {
    const res = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        organization_name: data.organization_name || `${data.full_name}'s Workspace`,
        terms_version: data.terms_version || '2026.1',
        privacy_version: data.privacy_version || '2026.1',
        ai_consent_version: data.ai_consent_version || '2026.1',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Registration failed');
    }
    return res.json();
  }

  public async login(email: string, password: string): Promise<BackendTokenResponse> {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Authentication failed');
    }
    const tokenData: BackendTokenResponse = await res.json();
    this.setToken(tokenData.access_token);
    return tokenData;
  }

  public async adminLogin(email: string, password: string): Promise<BackendTokenResponse> {
    const res = await fetch(`${this.baseUrl}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Administrative authentication failed');
    }
    const tokenData: BackendTokenResponse = await res.json();
    this.setToken(tokenData.access_token);
    return tokenData;
  }

  public async logout(): Promise<void> {
    try {
      if (this.token) {
        await fetch(`${this.baseUrl}/auth/logout`, {
          method: 'POST',
          headers: this.headers,
        });
      }
    } catch {}
    this.setToken(null);
  }

  public async getProfile(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/auth/me`, { headers: this.headers });
    if (!res.ok) throw new Error(`Failed to fetch profile: ${res.statusText}`);
    return res.json();
  }

  public async getConsentHistory(): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/auth/consent/history`, { headers: this.headers });
    if (!res.ok) throw new Error(`Failed to fetch consent history: ${res.statusText}`);
    return res.json();
  }

  public async withdrawConsent(consentType: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/auth/consent/withdraw`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ consent_type: consentType }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Consent withdrawal failed');
    }
    return res.json();
  }

  public async requestPasswordReset(email: string): Promise<{ status: string; message: string; reset_token?: string; email_dispatched?: boolean }> {
    const res = await fetch(`${this.baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Password reset request failed');
    }
    return res.json();
  }

  public async resetPassword(token: string, newPassword: string): Promise<{ status: string; message: string }> {
    const res = await fetch(`${this.baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: newPassword }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Password reset failed');
    }
    return res.json();
  }

  // --- User Portal APIs ---

  public async getPublishedPlans(): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/plans`);
    if (!res.ok) throw new Error(`Failed to load plans: ${res.statusText}`);
    return res.json();
  }

  public async getMyEntitlements(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/users/me/entitlements`, { headers: this.headers });
    if (!res.ok) throw new Error(`Failed to load entitlements: ${res.statusText}`);
    return res.json();
  }

  public async getMyUsage(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/users/me/usage`, { headers: this.headers });
    if (!res.ok) throw new Error(`Failed to load usage: ${res.statusText}`);
    return res.json();
  }

  public async getMySubscription(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/users/me/subscription`, { headers: this.headers });
    if (!res.ok) throw new Error(`Failed to load subscription: ${res.statusText}`);
    return res.json();
  }

  public async getUserUiConfig(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/users/me/ui-config`, { headers: this.headers });
    if (!res.ok) throw new Error(`Failed to load UI config: ${res.statusText}`);
    return res.json();
  }

  public async updateProfile(fullName: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/users/me`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify({ full_name: fullName.trim() }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Profile update failed');
    }
    return res.json();
  }

  public async changePassword(currentPassword: string, newPassword: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/users/me/change-password`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Password change failed');
    }
    return res.json();
  }

  public async deleteAccount(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/users/me`, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Account deletion failed');
    }
    return res.json();
  }

  public async updateConsent(payload: { ai_consent?: boolean; marketing_consent?: boolean }): Promise<any> {
    const res = await fetch(`${this.baseUrl}/auth/consent/grant`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        terms_version: '2026.1',
        privacy_version: '2026.1',
        ai_consent_version: '2026.1',
        ...payload,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Failed to save consent choices');
    }
    return res.json();
  }

  public async getApiKeys(): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/developer/keys`, { headers: this.headers });
    if (!res.ok) throw new Error(`Failed to load API keys: ${res.statusText}`);
    return res.json();
  }

  public async createApiKey(name: string, scopes?: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/developer/keys`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ name, scopes }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'API key creation failed');
    }
    return res.json();
  }

  public async revokeApiKey(keyId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/developer/keys/${keyId}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`Failed to revoke API key: ${res.statusText}`);
  }

  // --- Billing & Subscription APIs ---

  public async getBillingStatus(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/billing/status`, { headers: this.headers });
    if (!res.ok) throw new Error(`Failed to load billing status: ${res.statusText}`);
    return res.json();
  }

  public async createCheckoutSession(planSlug: string, billingInterval = 'monthly'): Promise<any> {
    const res = await fetch(`${this.baseUrl}/billing/checkout`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        plan_slug: planSlug,
        billing_interval: billingInterval,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Checkout initiation failed');
    }
    return res.json();
  }

  public async cancelSubscription(reason = 'User requested'): Promise<any> {
    const res = await fetch(`${this.baseUrl}/billing/cancel`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Subscription cancellation failed');
    }
    return res.json();
  }

  // --- Admin Portal APIs ---

  public async getAdminTelemetry(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/admin/telemetry`, { headers: this.headers });
    if (!res.ok) throw new Error(`Failed to load telemetry: ${res.statusText}`);
    return res.json();
  }

  public async getAdminUsers(params: { search?: string; plan?: string; status_filter?: string; skip?: number; limit?: number } = {}): Promise<any[]> {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.plan) query.set('plan', params.plan);
    if (params.status_filter) query.set('status_filter', params.status_filter);
    if (params.skip) query.set('skip', params.skip.toString());
    if (params.limit) query.set('limit', params.limit.toString());
    const res = await fetch(`${this.baseUrl}/admin/users?${query.toString()}`, { headers: this.headers });
    if (!res.ok) throw new Error(`Failed to load users: ${res.statusText}`);
    return res.json();
  }

  public async createAdminUser(data: any): Promise<any> {
    const res = await fetch(`${this.baseUrl}/admin/users`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'User creation failed');
    }
    return res.json();
  }

  public async getAdminUserDetail(userId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/admin/users/${userId}`, { headers: this.headers });
    if (!res.ok) throw new Error(`Failed to load user details: ${res.statusText}`);
    return res.json();
  }

  public async updateAdminUser(userId: string, data: any): Promise<any> {
    const res = await fetch(`${this.baseUrl}/admin/users/${userId}`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`User update failed: ${res.statusText}`);
    return res.json();
  }

  public async suspendUser(userId: string, reason: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/admin/users/${userId}/suspend`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error(`User suspension failed: ${res.statusText}`);
    return res.json();
  }

  public async reactivateUser(userId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/admin/users/${userId}/reactivate`, {
      method: 'POST',
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`User reactivation failed: ${res.statusText}`);
    return res.json();
  }

  public async getAdminPlans(): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/admin/plans`, { headers: this.headers });
    if (!res.ok) throw new Error(`Failed to load plans: ${res.statusText}`);
    return res.json();
  }

  public async createAdminPlan(data: any): Promise<any> {
    const res = await fetch(`${this.baseUrl}/admin/plans`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Plan creation failed: ${res.statusText}`);
    return res.json();
  }

  public async updateAdminPlan(planId: string, data: any): Promise<any> {
    const res = await fetch(`${this.baseUrl}/admin/plans/${planId}`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Plan update failed: ${res.statusText}`);
    return res.json();
  }

  public async archiveAdminPlan(planId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/admin/plans/${planId}/archive`, {
      method: 'POST',
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`Plan archive failed: ${res.statusText}`);
    return res.json();
  }

  public async getAdminFeatures(): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/admin/features`, { headers: this.headers });
    if (!res.ok) throw new Error(`Failed to load features: ${res.statusText}`);
    return res.json();
  }

  public async setUserEntitlements(userId: string, data: any): Promise<any> {
    const res = await fetch(`${this.baseUrl}/admin/users/${userId}/entitlements`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to set user entitlements: ${res.statusText}`);
    return res.json();
  }

  public async getAdminUiConfig(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/admin/ui-config`, { headers: this.headers });
    if (!res.ok) throw new Error(`Failed to load UI config: ${res.statusText}`);
    return res.json();
  }

  public async updateAdminUiConfig(data: any): Promise<any> {
    const res = await fetch(`${this.baseUrl}/admin/ui-config`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update UI config: ${res.statusText}`);
    return res.json();
  }

  public async createAdminViewSession(userId: string, durationMinutes = 30): Promise<any> {
    const res = await fetch(`${this.baseUrl}/admin/view-sessions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ target_user_id: userId, duration_minutes: durationMinutes }),
    });
    if (!res.ok) throw new Error(`Failed to create view session: ${res.statusText}`);
    return res.json();
  }

  public async exitAdminViewSession(sessionId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/admin/view-sessions/${sessionId}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`Failed to exit view session: ${res.statusText}`);
    return res.json();
  }

  public async getAdminAuditLogs(params: { limit?: number; skip?: number; action?: string } = {}): Promise<any[]> {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.skip) query.set('skip', params.skip.toString());
    if (params.action) query.set('action', params.action);
    const res = await fetch(`${this.baseUrl}/admin/audit-logs?${query.toString()}`, { headers: this.headers });
    if (!res.ok) throw new Error(`Failed to load audit logs: ${res.statusText}`);
    return res.json();
  }

  // --- Document & Agent Methods ---

  public async listTools(): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/tools`, { headers: this.headers });
    if (!res.ok) throw new Error(`Failed to list tools: ${res.statusText}`);
    return res.json();
  }

  public async uploadDocument(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    const h: Record<string, string> = {};
    if (this.token) {
      h['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${this.baseUrl}/documents/upload`, {
      method: 'POST',
      headers: h,
      body: formData,
    });
    if (!res.ok) throw new Error(`Document upload failed: ${res.statusText}`);
    return res.json();
  }

  public async submitJob(
    title: string,
    objective: string,
    documentIds: string[],
    mode: ProcessingMode = 'hybrid'
  ): Promise<AutonomousJob> {
    const res = await fetch(`${this.baseUrl}/jobs`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        title,
        objective,
        document_ids: documentIds,
        mode,
      }),
    });
    if (!res.ok) throw new Error(`Job submission failed: ${res.statusText}`);
    return res.json();
  }

  public async getJob(jobId: string): Promise<AutonomousJob> {
    const res = await fetch(`${this.baseUrl}/jobs/${jobId}`, { headers: this.headers });
    if (!res.ok) throw new Error(`Get job failed: ${res.statusText}`);
    return res.json();
  }

  public async approveStep(
    jobId: string,
    approved: boolean,
    rejectionReason?: string
  ): Promise<AutonomousJob> {
    const res = await fetch(`${this.baseUrl}/jobs/${jobId}/approve`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        approved,
        rejection_reason: rejectionReason,
      }),
    });
    if (!res.ok) throw new Error(`Step approval failed: ${res.statusText}`);
    return res.json();
  }

  public async cancelJob(jobId: string): Promise<AutonomousJob> {
    const res = await fetch(`${this.baseUrl}/jobs/${jobId}/cancel`, {
      method: 'POST',
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`Cancel job failed: ${res.statusText}`);
    return res.json();
  }
}

export const omniDocClient = new OmniDocApiClient();
