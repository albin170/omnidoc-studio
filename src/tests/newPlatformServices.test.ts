import { describe, it, expect, beforeEach } from 'vitest';
import { simulationService } from '../services/simulationService';
import { collaborationService } from '../services/collaborationService';
import { developerService } from '../services/developerService';

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

describe('New Platform Services - Simulation, Collaboration, Developer API', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Document What-If Simulator Service', () => {
    it('calculates font scale delta correctly for document layout volume', () => {
      const res = simulationService.simulateModifications({
        documentTitle: 'Executive Agreement.pdf',
        originalPageCount: 2,
        fontSizeDeltaPt: 4, // increase font size by 4pt
        removeColumnsCount: 0,
      });

      expect(res.predictedPageCount).toBeGreaterThan(2);
      expect(res.predictedOverflow).toBe(true);
      expect(res.textExpansionRatio).toBeGreaterThan(1.2);
      expect(res.warnings.length).toBeGreaterThan(0);
    });

    it('models translation expansion accurately for German/French', () => {
      const resDe = simulationService.simulateModifications({
        documentTitle: 'Contract.pdf',
        originalPageCount: 10,
        fontSizeDeltaPt: 0,
        removeColumnsCount: 0,
        translationTargetLang: 'de',
      });

      expect(resDe.textExpansionRatio).toBe(1.28);
      expect(resDe.predictedPageCount).toBe(13);
    });

    it('simulates table compression with removed columns', () => {
      const res = simulationService.simulateModifications({
        documentTitle: 'Financial Table.docx',
        originalPageCount: 5,
        fontSizeDeltaPt: 0,
        removeColumnsCount: 2,
      });

      expect(res.tableCompressionRatio).toBe(0.76);
      expect(res.recommendations.some(r => r.includes('Removing 2 table column(s)'))).toBe(true);
    });
  });

  describe('Team Collaboration & Review Service', () => {
    it('manages organization members and review comments', () => {
      const members = collaborationService.getTeamMembers();
      expect(members.length).toBeGreaterThan(0);

      // Add member
      const newMember = collaborationService.addTeamMember('Jane Architect', 'jane@corp.internal', 'editor');
      expect(newMember.email).toBe('jane@corp.internal');
      expect(collaborationService.getTeamMembers().some(m => m.email === 'jane@corp.internal')).toBe(true);

      // Add comment
      const comment = collaborationService.addComment('doc-101', 'Please verify invoice total.', 1);
      expect(comment.content).toBe('Please verify invoice total.');
      expect(comment.pageNumber).toBe(1);
      expect(comment.resolved).toBe(false);

      // Resolve comment
      collaborationService.toggleCommentResolved('doc-101', comment.id);
      const comments = collaborationService.getDocumentComments('doc-101');
      expect(comments.find(c => c.id === comment.id)?.resolved).toBe(true);
    });
  });

  describe('Developer API Key Service', () => {
    it('creates, lists, and revokes API keys with scopes', () => {
      const initialKeys = developerService.getApiKeys();
      expect(Array.isArray(initialKeys)).toBe(true);

      // Generate key
      const created = developerService.createApiKey('CI/CD Pipeline Service', ['read:documents', 'write:conversions']);
      expect(created.rawSecret).toMatch(/^omni_live_/);
      expect(created.key.prefix).toMatch(/^omni_live_/);
      expect(created.key.scopes.length).toBe(2);

      // Delete key
      developerService.deleteApiKey(created.key.id);
      expect(developerService.getApiKeys().some(k => k.id === created.key.id)).toBe(false);
    });
  });
});
