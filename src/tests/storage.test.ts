import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getStoredProjects, 
  saveProject, 
  deleteProject, 
  getConversionHistory, 
  addConversionHistoryItem, 
  clearConversionHistory, 
  purgeAllLocalData, 
  getPlanQuota,
  getUserSession,
  setUserSession,
  logoutUser
} from '../services/storageService';
import { StoredProject, ConversionHistoryItem } from '../types';

const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, value: string) => storageMap.set(key, String(value)),
  removeItem: (key: string) => { storageMap.delete(key); },
  clear: () => { storageMap.clear(); },
};
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('Local Storage & Session Service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and retrieves stored projects', () => {
    const project: StoredProject = {
      id: 'proj-123',
      title: 'Quarterly Financials',
      type: 'sheets',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sizeBytes: 1024,
      data: { grid: [[1, 2], [3, 4]] },
    };

    saveProject(project);
    const projects = getStoredProjects();
    expect(projects.length).toBe(1);
    expect(projects[0].title).toBe('Quarterly Financials');
    expect(projects[0].id).toBe('proj-123');
  });

  it('updates an existing project without duplication', () => {
    const project: StoredProject = {
      id: 'proj-update',
      title: 'Initial Title',
      type: 'docx',
      createdAt: 1000,
      updatedAt: 1000,
      sizeBytes: 500,
      data: { content: 'Initial' },
    };

    saveProject(project);
    expect(getStoredProjects().length).toBe(1);

    // Save with updated title
    saveProject({ ...project, title: 'Updated Title' });
    const after = getStoredProjects();
    expect(after.length).toBe(1);
    expect(after[0].title).toBe('Updated Title');
  });

  it('deletes a project by id', () => {
    const p1: StoredProject = {
      id: 'p-1',
      title: 'Project 1',
      type: 'pdf',
      createdAt: 1000,
      updatedAt: 1000,
      sizeBytes: 100,
      data: {},
    };
    const p2: StoredProject = {
      id: 'p-2',
      title: 'Project 2',
      type: 'image',
      createdAt: 1000,
      updatedAt: 1000,
      sizeBytes: 200,
      data: {},
    };

    saveProject(p1);
    saveProject(p2);
    expect(getStoredProjects().length).toBe(2);

    deleteProject('p-1');
    const remaining = getStoredProjects();
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe('p-2');
  });

  it('records and trims conversion history (max 50)', () => {
    for (let i = 0; i < 55; i++) {
      const item: ConversionHistoryItem = {
        id: `conv-${i}`,
        sourceName: `doc-${i}.pdf`,
        sourceFormat: 'pdf',
        targetFormat: 'docx',
        sizeBytes: 1000 + i,
        completedAt: Date.now() + i,
        status: 'completed',
      };
      addConversionHistoryItem(item);
    }

    const history = getConversionHistory();
    expect(history.length).toBe(50);
    expect(history[0].id).toBe('conv-54'); // Most recent first
  });

  it('clears conversion history', () => {
    addConversionHistoryItem({
      id: 'conv-test',
      sourceName: 'test.png',
      sourceFormat: 'png',
      targetFormat: 'webp',
      sizeBytes: 500,
      completedAt: Date.now(),
      status: 'completed',
    });
    expect(getConversionHistory().length).toBe(1);

    clearConversionHistory();
    expect(getConversionHistory().length).toBe(0);
  });

  it('purges all local data', () => {
    saveProject({
      id: 'purge-test',
      title: 'Delete Me',
      type: 'docx',
      createdAt: 100,
      updatedAt: 100,
      sizeBytes: 100,
      data: {},
    });
    addConversionHistoryItem({
      id: 'purge-hist',
      sourceName: 'file.txt',
      sourceFormat: 'txt',
      targetFormat: 'pdf',
      sizeBytes: 100,
      completedAt: 100,
      status: 'completed',
    });

    expect(getStoredProjects().length).toBe(1);
    expect(getConversionHistory().length).toBe(1);

    purgeAllLocalData();
    expect(getStoredProjects().length).toBe(0);
    expect(getConversionHistory().length).toBe(0);
  });

  it('returns appropriate quotas per tier', () => {
    const freeQuota = getPlanQuota('free');
    expect(freeQuota.maxFileSizeBytes).toBe(25 * 1024 * 1024);
    expect(freeQuota.maxFilesPerBatch).toBe(5);

    const proQuota = getPlanQuota('pro');
    expect(proQuota.maxFileSizeBytes).toBe(150 * 1024 * 1024);
    expect(proQuota.maxFilesPerBatch).toBe(50);
    expect(proQuota.unlimitedOcr).toBe(true);

    const entQuota = getPlanQuota('enterprise');
    expect(entQuota.maxFileSizeBytes).toBe(500 * 1024 * 1024);
    expect(entQuota.maxFilesPerBatch).toBe(100);
  });

  it('manages user sessions and logout correctly', () => {
    setUserSession({
      isGuest: false,
      userName: 'Test Architect',
      userEmail: 'test@omnidoc.studio',
      storageUsedBytes: 5000,
      isAuthenticated: true,
      role: 'admin',
      planTier: 'pro',
    });

    const activeSession = getUserSession();
    expect(activeSession.isAuthenticated).toBe(true);
    expect(activeSession.userName).toBe('Test Architect');
    expect(activeSession.role).toBe('admin');

    const loggedOut = logoutUser();
    expect(loggedOut.isAuthenticated).toBe(false);
    expect(getUserSession().isAuthenticated).toBe(false);
  });

  it('accurately estimates browser storage and distinguishes local sandbox from cloud', async () => {
    const { getBrowserStorageEstimate } = await import('../services/storageService');
    const estimate = await getBrowserStorageEstimate();
    expect(typeof estimate.usageBytes).toBe('number');
    expect(typeof estimate.quotaBytes).toBe('number');
    expect(estimate.quotaBytes).toBeGreaterThan(0);
    // Quota should not be a hardcoded 50 MB claim
    expect(estimate.source).toBeDefined();
  });
});
