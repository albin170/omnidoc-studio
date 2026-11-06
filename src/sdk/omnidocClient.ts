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
    const defaultUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:8000/api/v1';
    this.baseUrl = (config.baseUrl || defaultUrl).replace(/\/$/, '');
    this.token = config.token || (typeof localStorage !== 'undefined' ? localStorage.getItem('omnidoc_backend_jwt') : null);
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

  public async getHealth(): Promise<{ status: string; platform: string; version: string }> {
    const res = await fetch(`${this.baseUrl.replace('/api/v1', '')}/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
    return res.json();
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
