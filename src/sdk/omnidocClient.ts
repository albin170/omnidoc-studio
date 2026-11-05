import {
  AutonomousJob,
  ProcessingMode
} from '../types';

export interface OmniDocClientConfig {
  baseUrl?: string;
  token?: string;
}

export class OmniDocApiClient {
  private baseUrl: string;
  private token: string | null;

  constructor(config: OmniDocClientConfig = {}) {
    this.baseUrl = (config.baseUrl || 'http://localhost:8000/api/v1').replace(/\/$/, '');
    this.token = config.token || null;
  }

  public setToken(token: string) {
    this.token = token;
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

