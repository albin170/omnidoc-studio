import { StoredProject, ProjectVersion, StorageMode } from '../types';
import { saveProject, getStoredProjects } from './storageService';
import { recordAuditLog } from './authService';

const STORAGE_MODE_KEY = 'omnidoc_storage_mode_v2';
const VERSIONS_PREFIX = 'omnidoc_versions_v2_';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

type SaveStatusListener = (status: SaveStatus, details?: string) => void;

class PersistenceManager {
  private listeners: Set<SaveStatusListener> = new Set();
  private currentStatus: SaveStatus = 'idle';

  public subscribeStatus(listener: SaveStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.currentStatus);
    return () => this.listeners.delete(listener);
  }

  private setStatus(status: SaveStatus, details?: string): void {
    this.currentStatus = status;
    this.listeners.forEach((fn) => fn(status, details));
  }

  /**
   * Get preferred storage mode (local-only vs cloud-synced)
   */
  public getStorageMode(): StorageMode {
    try {
      const mode = localStorage.getItem(STORAGE_MODE_KEY);
      return (mode === 'cloud') ? 'cloud' : 'local';
    } catch {
      return 'local';
    }
  }

  /**
   * Set storage mode (toggle privacy-first local mode vs cloud sync)
   */
  public setStorageMode(mode: StorageMode, userEmail?: string): void {
    try {
      localStorage.setItem(STORAGE_MODE_KEY, mode);
      recordAuditLog(
        'STORAGE_MODE_CHANGED',
        userEmail || 'anonymous',
        `Storage preference set to: ${mode.toUpperCase()}`
      );
    } catch (err) {
      console.warn('Failed to set storage mode:', err);
    }
  }

  /**
   * Save project with automatic version snapshotting and error status tracking
   */
  public async persistProjectWithVersion(
    project: StoredProject,
    options: {
      createSnapshot?: boolean;
      versionNote?: string;
      authorEmail?: string;
    } = {}
  ): Promise<StoredProject> {
    this.setStatus('saving');

    try {
      // 1. Save core project
      const saved = saveProject(project);

      // 2. If requested, snapshot a named version
      if (options.createSnapshot) {
        this.createVersionSnapshot(
          saved.id,
          saved.title,
          saved.data,
          options.versionNote || 'Autosave snapshot',
          options.authorEmail
        );
      }

      this.setStatus('saved', `Saved at ${new Date().toLocaleTimeString()}`);
      return saved;
    } catch (err: any) {
      this.setStatus('error', err?.message || 'Failed to save document');
      throw err;
    }
  }

  /**
   * Create an immutable version snapshot for a project
   */
  public createVersionSnapshot(
    projectId: string,
    title: string,
    data: any,
    note?: string,
    authorEmail?: string
  ): ProjectVersion {
    const key = `${VERSIONS_PREFIX}${projectId}`;
    const raw = localStorage.getItem(key);
    const versions: ProjectVersion[] = raw ? JSON.parse(raw) : [];

    const newVersion: ProjectVersion = {
      versionId: `v-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      projectId,
      timestamp: Date.now(),
      title,
      note,
      data: JSON.parse(JSON.stringify(data)),
      authorEmail: authorEmail || 'Current User',
    };

    versions.unshift(newVersion);
    // Retain up to 25 historic versions per project
    localStorage.setItem(key, JSON.stringify(versions.slice(0, 25)));

    recordAuditLog(
      'VERSION_CREATED',
      authorEmail || 'anonymous',
      `Version ${newVersion.versionId} snapshotted for project "${title}"`
    );

    return newVersion;
  }

  /**
   * Get all version snapshots for a given project ID
   */
  public getProjectVersions(projectId: string): ProjectVersion[] {
    try {
      const key = `${VERSIONS_PREFIX}${projectId}`;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Rollback / restore a project to an earlier version snapshot
   */
  public restoreVersion(
    projectId: string,
    versionId: string,
    authorEmail?: string
  ): StoredProject {
    const versions = this.getProjectVersions(projectId);
    const target = versions.find((v) => v.versionId === versionId);
    if (!target) {
      throw new Error(`Version "${versionId}" not found for project ${projectId}.`);
    }

    const projects = getStoredProjects();
    const existing = projects.find((p) => p.id === projectId);
    if (!existing) {
      throw new Error(`Project "${projectId}" not found in storage.`);
    }

    // Create a safety snapshot of current state before rollback
    this.createVersionSnapshot(
      projectId,
      existing.title,
      existing.data,
      `Pre-rollback backup before restoring ${versionId}`,
      authorEmail
    );

    // Apply restored data
    const restoredProject: StoredProject = {
      ...existing,
      title: target.title,
      data: target.data,
      updatedAt: Date.now(),
      sizeBytes: JSON.stringify(target.data).length,
    };

    const result = saveProject(restoredProject);
    recordAuditLog(
      'VERSION_RESTORED',
      authorEmail || 'anonymous',
      `Project "${existing.title}" rolled back to version ${versionId}`,
      'warn'
    );

    this.setStatus('saved', `Restored version ${versionId}`);
    return result;
  }
}

export const persistenceService = new PersistenceManager();
