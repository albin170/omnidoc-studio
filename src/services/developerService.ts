export interface DeveloperApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
  rateLimitRpm: number;
}

const DEV_KEYS_KEY = 'omnidoc_developer_keys_v2';

export class DeveloperService {
  public getApiKeys(): DeveloperApiKey[] {
    try {
      const stored = localStorage.getItem(DEV_KEYS_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}

    return [
      {
        id: 'key_1',
        name: 'Enterprise CI/CD Extraction Worker',
        prefix: 'omni_live_8f91...',
        scopes: ['read:documents', 'write:conversions', 'execute:agent'],
        createdAt: '2026-11-01',
        lastUsedAt: '2 mins ago',
        rateLimitRpm: 120,
      },
      {
        id: 'key_2',
        name: 'Automated Invoice Ingestion Webhook',
        prefix: 'omni_live_c44b...',
        scopes: ['read:documents', 'execute:agent'],
        createdAt: '2026-10-28',
        lastUsedAt: 'Yesterday',
        rateLimitRpm: 60,
      },
    ];
  }

  public createApiKey(name: string, scopes: string[] = ['read:documents', 'write:conversions']): { key: DeveloperApiKey; rawSecret: string } {
    const keys = this.getApiKeys();
    const rawSecret = `omni_live_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
    const newKey: DeveloperApiKey = {
      id: `key_${Date.now()}`,
      name: name.trim(),
      prefix: `${rawSecret.substring(0, 14)}...`,
      scopes,
      createdAt: new Date().toISOString().split('T')[0],
      rateLimitRpm: 60,
    };
    keys.unshift(newKey);
    localStorage.setItem(DEV_KEYS_KEY, JSON.stringify(keys));
    return { key: newKey, rawSecret };
  }

  public deleteApiKey(id: string): void {
    const keys = this.getApiKeys().filter(k => k.id !== id);
    localStorage.setItem(DEV_KEYS_KEY, JSON.stringify(keys));
  }
}

export const developerService = new DeveloperService();
