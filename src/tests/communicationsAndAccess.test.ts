import { describe, it, expect, vi, beforeEach } from 'vitest';
import { omniDocClient } from '../sdk/omnidocClient';
import { authorizeUserAction, computeSessionSignature, SecureAuthSession } from '../services/authService';

describe('Admin-User Communications & Role Consistency Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Direct Messaging API Client', () => {
    it('dispatches a direct message to a user via omniDocClient.sendDirectMessage', async () => {
      const mockMessage = {
        id: 'msg-101',
        sender_user_id: 'admin-1',
        recipient_user_id: 'user-1',
        subject: 'Security Audit Notice',
        body: 'Please review your active credentials.',
        priority: 'urgent' as const,
        status: 'sent' as const,
        created_at: new Date().toISOString(),
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockMessage,
      } as Response);

      const result = await omniDocClient.sendDirectMessage({
        recipient_user_id: 'user-1',
        subject: 'Security Audit Notice',
        body: 'Please review your active credentials.',
        priority: 'urgent',
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages/send'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            recipient_user_id: 'user-1',
            subject: 'Security Audit Notice',
            body: 'Please review your active credentials.',
            priority: 'urgent',
          }),
        })
      );
      expect(result.id).toBe('msg-101');
      expect(result.priority).toBe('urgent');
    });

    it('retrieves user inbox with unread count via omniDocClient.getMyInbox', async () => {
      const mockInbox = {
        items: [
          {
            id: 'msg-101',
            sender_user_id: 'admin-1',
            recipient_user_id: 'user-1',
            subject: 'Welcome',
            body: 'Welcome to OmniDoc Studio',
            priority: 'normal' as const,
            status: 'sent' as const,
            created_at: new Date().toISOString(),
            read_at: null,
          },
        ],
        total: 1,
        unread_count: 1,
        page: 1,
        limit: 20,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockInbox,
      } as Response);

      const res = await omniDocClient.getMyInbox();
      expect(res.total).toBe(1);
      expect(res.unread_count).toBe(1);
      expect(res.items[0].subject).toBe('Welcome');
    });

    it('marks a message as read and archives it', async () => {
      const mockRead = {
        id: 'msg-101',
        read_at: new Date().toISOString(),
        status: 'delivered' as const,
      };
      const mockArchived = {
        id: 'msg-101',
        archived_at: new Date().toISOString(),
        status: 'archived' as const,
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockRead } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => mockArchived } as Response);

      const readRes = await omniDocClient.markMessageRead('msg-101');
      expect(readRes.read_at).toBeTruthy();

      const archRes = await omniDocClient.archiveMessage('msg-101');
      expect(archRes.status).toBe('archived');
    });
  });

  describe('2. Announcements API Client', () => {
    it('creates an announcement targeted to specific tier or all users', async () => {
      const mockAnn = {
        id: 'ann-1',
        title: 'Scheduled Upgrade',
        body: 'Maintenance on Sunday 02:00 UTC',
        priority: 'critical' as const,
        audience_type: 'all' as const,
        is_published: true,
        is_archived: false,
        created_at: new Date().toISOString(),
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAnn,
      } as Response);

      const result = await omniDocClient.createAnnouncement({
        title: 'Scheduled Upgrade',
        body: 'Maintenance on Sunday 02:00 UTC',
        priority: 'critical',
        audience_type: 'all',
      });

      expect(result.id).toBe('ann-1');
      expect(result.priority).toBe('critical');
    });

    it('fetches active user announcements', async () => {
      const mockList = {
        items: [
          {
            id: 'ann-1',
            title: 'Critical Notice',
            body: 'Certificate rotation',
            priority: 'critical' as const,
            audience_type: 'all' as const,
            is_published: true,
            is_archived: false,
            created_at: new Date().toISOString(),
          },
        ],
        total: 1,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockList,
      } as Response);

      const res = await omniDocClient.getActiveAnnouncements();
      expect(res.items.length).toBe(1);
      expect(res.items[0].title).toBe('Critical Notice');
    });
  });

  describe('3. Superadmin and Role Access Consistency', () => {
    it('grants administrative access to users with role superadmin', async () => {
      const now = Date.now();
      const superadminSession: SecureAuthSession = {
        isGuest: false,
        storageUsedBytes: 0,
        userEmail: 'superadmin@omnidoc.io',
        userName: 'Super Administrator',
        role: 'superadmin',
        planTier: 'enterprise',
        isAuthenticated: true,
        authSource: 'backend',
        jwtToken: 'fake.superadmin.jwt',
        issuedAt: now,
        expiresAt: now + 3600000,
      };
      superadminSession.signature = await computeSessionSignature(superadminSession);

      const check = await authorizeUserAction(superadminSession, 'admin');
      expect(check.allowed).toBe(true);
      expect(check.reason).toBeUndefined();
    });

    it('grants administrative access to users with role admin', async () => {
      const now = Date.now();
      const adminSession: SecureAuthSession = {
        isGuest: false,
        storageUsedBytes: 0,
        userEmail: 'admin@omnidoc.io',
        userName: 'Admin User',
        role: 'admin',
        planTier: 'enterprise',
        isAuthenticated: true,
        authSource: 'backend',
        jwtToken: 'fake.admin.jwt',
        issuedAt: now,
        expiresAt: now + 3600000,
      };
      adminSession.signature = await computeSessionSignature(adminSession);

      const check = await authorizeUserAction(adminSession, 'admin');
      expect(check.allowed).toBe(true);
      expect(check.reason).toBeUndefined();
    });

    it('rejects administrative access to standard users', async () => {
      const now = Date.now();
      const standardUserSession: SecureAuthSession = {
        isGuest: false,
        storageUsedBytes: 0,
        userEmail: 'standard@omnidoc.io',
        userName: 'Standard User',
        role: 'user',
        planTier: 'free',
        isAuthenticated: true,
        authSource: 'backend',
        jwtToken: 'fake.user.jwt',
        issuedAt: now,
        expiresAt: now + 3600000,
      };
      standardUserSession.signature = await computeSessionSignature(standardUserSession);

      const check = await authorizeUserAction(standardUserSession, 'admin');
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('Administrator privileges required');
    });
  });
});
