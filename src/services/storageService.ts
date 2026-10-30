import { ConversionHistoryItem, StoredProject } from '../types';

const STORAGE_PROJECTS_KEY = 'omnidoc_projects_v1';
const STORAGE_HISTORY_KEY = 'omnidoc_history_v1';
const STORAGE_AUTH_KEY = 'omnidoc_user_auth_v1';

export interface UserSession {
  isGuest: boolean;
  userEmail?: string;
  userName?: string;
  avatarUrl?: string;
  storageUsedBytes: number;
  isAuthenticated?: boolean;
  rememberMe?: boolean;
}

/**
 * Get all stored projects
 */
export function getStoredProjects(): StoredProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Failed to read stored projects:', e);
    return [];
  }
}

/**
 * Save or update a project
 */
export function saveProject(project: StoredProject): void {
  try {
    const existing = getStoredProjects();
    const index = existing.findIndex((p) => p.id === project.id);
    if (index >= 0) {
      existing[index] = { ...project, updatedAt: Date.now() };
    } else {
      existing.unshift(project);
    }
    localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(existing));
  } catch (e) {
    console.error('Failed to save project:', e);
  }
}

/**
 * Delete a project by ID
 */
export function deleteProject(id: string): void {
  try {
    const existing = getStoredProjects().filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(existing));
  } catch (e) {
    console.error('Failed to delete project:', e);
  }
}

/**
 * Get conversion history
 */
export function getConversionHistory(): ConversionHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Add a record to conversion history
 */
export function addConversionHistoryItem(item: ConversionHistoryItem): void {
  try {
    const history = getConversionHistory();
    history.unshift(item);
    // Keep max 50 recent items
    const trimmed = history.slice(0, 50);
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('Failed to record conversion history:', e);
  }
}

/**
 * Clear conversion history
 */
export function clearConversionHistory(): void {
  localStorage.removeItem(STORAGE_HISTORY_KEY);
}

/**
 * Purge all local user data (privacy-first cleanup)
 */
export function purgeAllLocalData(): void {
  localStorage.removeItem(STORAGE_PROJECTS_KEY);
  localStorage.removeItem(STORAGE_HISTORY_KEY);
  localStorage.removeItem(STORAGE_AUTH_KEY);
}

/**
 * Get current user session.
 * For existing authenticated users (saved in localStorage), returns isAuthenticated: true.
 * For new users (no stored session), returns default with isAuthenticated: false so they see login/signup gateway.
 */
export function getUserSession(): UserSession {
  try {
    const raw = localStorage.getItem(STORAGE_AUTH_KEY);
    if (raw) {
      const parsed: UserSession = JSON.parse(raw);
      return parsed;
    }
  } catch (e) {
    // fallback
  }

  // Brand new visitor default: unauthenticated
  return {
    isGuest: false,
    userName: '',
    storageUsedBytes: 0,
    isAuthenticated: false,
  };
}

/**
 * Set user session
 */
export function setUserSession(session: UserSession): void {
  localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(session));
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
  };
  localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(loggedOutSession));
  return loggedOutSession;
}
