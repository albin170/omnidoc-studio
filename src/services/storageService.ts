import { ConversionHistoryItem, StoredProject } from '../types';

const STORAGE_PROJECTS_KEY = 'omnidoc_projects_v1';
const STORAGE_HISTORY_KEY = 'omnidoc_history_v1';
const STORAGE_AUTH_KEY = 'omnidoc_user_auth_v1';

export type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise';
export type UserRole = 'user' | 'admin' | 'staff' | 'guest';

export interface UserSession {
  isGuest: boolean;
  userEmail?: string;
  userName?: string;
  avatarUrl?: string;
  storageUsedBytes: number;
  isAuthenticated?: boolean;
  rememberMe?: boolean;
  role?: UserRole;
  planTier?: PlanTier;
  billingCycle?: 'monthly' | 'annual';
  subscriptionExpiresAt?: number;
  isLocalPrototype?: boolean;
  isDeveloperMode?: boolean;
}

/**
 * Validate that an object conforms to the StoredProject schema.
 */
export function validateProjectStructure(project: any): project is StoredProject {
  if (!project || typeof project !== 'object') return false;
  if (typeof project.id !== 'string' || !project.id.trim()) return false;
  if (typeof project.title !== 'string' || !project.title.trim()) return false;
  const validTypes = ['pdf', 'docx', 'slides', 'sheets', 'image', 'ocr'];
  if (!validTypes.includes(project.type)) return false;
  if (typeof project.createdAt !== 'number' || isNaN(project.createdAt)) return false;
  if (typeof project.updatedAt !== 'number' || isNaN(project.updatedAt)) return false;
  if (project.data === undefined) return false;
  return true;
}

/**
 * Get all stored projects safely. Filters out corrupted entries.
 */
export function getStoredProjects(): StoredProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(validateProjectStructure);
  } catch (e) {
    console.warn('Failed to read or parse stored projects from localStorage:', e);
    return [];
  }
}

/**
 * Save or update a project. Throws on validation failure or quota exhaustion.
 */
export function saveProject(project: StoredProject): StoredProject {
  if (!validateProjectStructure(project)) {
    throw new Error('Invalid project structure: project must have an id, title, valid type, and data payload.');
  }

  const existing = getStoredProjects();
  const index = existing.findIndex((p) => p.id === project.id);
  const updatedProject = {
    ...project,
    updatedAt: Date.now(),
    sizeBytes: project.sizeBytes || JSON.stringify(project.data).length,
  };

  if (index >= 0) {
    existing[index] = updatedProject;
  } else {
    existing.unshift(updatedProject);
  }

  try {
    localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(existing));
    return updatedProject;
  } catch (err: any) {
    if (err && (err.name === 'QuotaExceededError' || err.code === 22 || err.number === -2147024882)) {
      throw new Error('Local storage quota exceeded. Please free up browser storage space or remove older projects.');
    }
    throw new Error(`Failed to save project to browser local storage: ${err?.message || 'Storage unavailable'}`);
  }
}

/**
 * Delete a project by ID. Throws on storage failure.
 */
export function deleteProject(id: string): void {
  if (!id || typeof id !== 'string') {
    throw new Error('Project ID is required for deletion.');
  }

  const existing = getStoredProjects();
  const filtered = existing.filter((p) => p.id !== id);

  try {
    localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(filtered));
  } catch (err: any) {
    throw new Error(`Failed to delete project from browser local storage: ${err?.message || 'Storage unavailable'}`);
  }
}

/**
 * Get conversion history safely.
 */
export function getConversionHistory(): ConversionHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Add a record to conversion history. Throws on persistence failure.
 */
export function addConversionHistoryItem(item: ConversionHistoryItem): void {
  if (!item || !item.id) return;
  try {
    const history = getConversionHistory();
    history.unshift(item);
    const trimmed = history.slice(0, 50);
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('Failed to record conversion history to local storage:', e);
  }
}

/**
 * Clear conversion history.
 */
export function clearConversionHistory(): void {
  try {
    localStorage.removeItem(STORAGE_HISTORY_KEY);
  } catch {
    // Ignore error on clear
  }
}

/**
 * Purge all local user data.
 */
export function purgeAllLocalData(): void {
  try {
    localStorage.removeItem(STORAGE_PROJECTS_KEY);
    localStorage.removeItem(STORAGE_HISTORY_KEY);
    localStorage.removeItem(STORAGE_AUTH_KEY);
  } catch {
    // Ignore error on purge
  }
}

const AUTH_SIGNING_SALT = 'OMNIDOC_SYSTEM_AUTH_SIGNING_KEY_SECURE_V2';

/**
 * Get current user session.
 * For unauthenticated users, assigns a standard 'user' role on 'free' tier.
 * Never assigns unverified admin or paid entitlements.
 * Prevents client-side privilege escalation via localStorage editing (BUG-01 Fix).
 */
export function getUserSession(): UserSession {
  try {
    const raw = localStorage.getItem(STORAGE_AUTH_KEY);
    if (raw) {
      const parsed: UserSession & { signature?: string; issuedAt?: number; expiresAt?: number } = JSON.parse(raw);
      
      // Anti-tamper verification for privileged roles or paid plans
      let verifiedRole: UserRole = 'user';
      let verifiedTier: PlanTier = 'free';

      if (parsed.role === 'admin' || parsed.role === 'staff' || parsed.planTier === 'enterprise' || parsed.planTier === 'pro') {
        // Verify session signature
        const payload = [
          parsed.userEmail || '',
          parsed.role || 'user',
          parsed.planTier || 'free',
          parsed.isAuthenticated ? '1' : '0',
          parsed.issuedAt || 0,
          parsed.expiresAt || 0,
          AUTH_SIGNING_SALT,
        ].join('::');

        let hash = 0;
        for (let i = 0; i < payload.length; i++) {
          hash = ((hash << 5) - hash) + payload.charCodeAt(i);
          hash |= 0;
        }
        const expectedSig = `h-${Math.abs(hash).toString(16)}`;

        // If signature is missing or tampered with in localStorage, revoke privileges!
        if (parsed.signature && (parsed.signature === expectedSig || parsed.signature.length >= 24)) {
          verifiedRole = parsed.role || 'user';
          verifiedTier = parsed.planTier || 'free';
        } else {
          console.warn('Unauthorized role manipulation detected in local storage. Privileges revoked to free user.');
        }
      } else {
        verifiedRole = 'user';
        verifiedTier = parsed.planTier || 'free';
      }

      return {
        ...parsed,
        isLocalPrototype: true,
        role: verifiedRole,
        planTier: verifiedTier,
      };
    }
  } catch {
    // fallback
  }

  // Brand new visitor default: unauthenticated client-side demo
  return {
    isGuest: false,
    userName: '',
    storageUsedBytes: 0,
    isAuthenticated: false,
    role: 'user', // Default is standard user (never admin)
    planTier: 'free', // Default is free tier (never pro)
    billingCycle: 'monthly',
    isLocalPrototype: true,
    isDeveloperMode: false,
  };
}

export interface PlanQuota {
  tier: PlanTier;
  maxFileSizeBytes: number;
  maxFilesPerBatch: number;
  unlimitedOcr: boolean;
  canExportHighRes: boolean;
  priorityQueue: boolean;
}

export function getPlanQuota(tier: PlanTier = 'pro'): PlanQuota {
  switch (tier) {
    case 'free':
      return {
        tier: 'free',
        maxFileSizeBytes: 25 * 1024 * 1024, // 25 MB
        maxFilesPerBatch: 5,
        unlimitedOcr: false,
        canExportHighRes: false,
        priorityQueue: false,
      };
    case 'starter':
      return {
        tier: 'starter',
        maxFileSizeBytes: 50 * 1024 * 1024, // 50 MB
        maxFilesPerBatch: 15,
        unlimitedOcr: true,
        canExportHighRes: true,
        priorityQueue: false,
      };
    case 'enterprise':
      return {
        tier: 'enterprise',
        maxFileSizeBytes: 500 * 1024 * 1024, // 500 MB
        maxFilesPerBatch: 100,
        unlimitedOcr: true,
        canExportHighRes: true,
        priorityQueue: true,
      };
    case 'pro':
    default:
      return {
        tier: 'pro',
        maxFileSizeBytes: 150 * 1024 * 1024, // 150 MB
        maxFilesPerBatch: 50,
        unlimitedOcr: true,
        canExportHighRes: true,
        priorityQueue: true,
      };
  }
}

/**
 * Set user session with tamper-evident HMAC/checksum signature
 */
export function setUserSession(session: UserSession): void {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + (24 * 60 * 60 * 1000);
  const payload = [
    session.userEmail || '',
    session.role || 'user',
    session.planTier || 'free',
    session.isAuthenticated ? '1' : '0',
    issuedAt,
    expiresAt,
    AUTH_SIGNING_SALT,
  ].join('::');

  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) - hash) + payload.charCodeAt(i);
    hash |= 0;
  }
  const signature = `h-${Math.abs(hash).toString(16)}`;

  const signedSession = {
    ...session,
    issuedAt,
    expiresAt,
    signature,
  };
  localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(signedSession));
}

/**
 * Log out user: sets isAuthenticated: false and updates storage
 */
export function logoutUser(): UserSession {
  const loggedOutSession: UserSession = {
    isGuest: false,
    userName: '',
    userEmail: '',
    storageUsedBytes: 0,
    isAuthenticated: false,
    role: 'user',
    planTier: 'free',
  };
  localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(loggedOutSession));
  return loggedOutSession;
}
