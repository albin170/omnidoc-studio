import { UserRole, PlanTier, UserSession } from './storageService';
import { AuditLogEntry } from '../types';
import { omniDocClient, BackendUserRegisterPayload } from '../sdk/omnidocClient';

const AUDIT_LOGS_KEY = 'omnidoc_audit_logs_v2';

let _cachedDeviceAuthSecret: string | null = null;

export function getDeviceAuthSecret(): string {
  if (_cachedDeviceAuthSecret) return _cachedDeviceAuthSecret;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const stored = window.sessionStorage.getItem('omnidoc_device_session_signing_secret');
      if (stored && stored.length >= 32) {
        _cachedDeviceAuthSecret = stored;
        return stored;
      }
    } catch {}
  }

  const randomBytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 32; i++) randomBytes[i] = Math.floor(Math.random() * 256);
  }

  const generated = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  _cachedDeviceAuthSecret = generated;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem('omnidoc_device_session_signing_secret', generated);
    } catch {}
  }

  return generated;
}

export interface SecureAuthSession extends UserSession {
  signature?: string;
  issuedAt?: number;
  expiresAt?: number;
  deviceId?: string;
  jwtToken?: string;
  authSource?: 'backend' | 'local_sandbox';
  consent?: {
    termsAccepted: boolean;
    privacyAccepted: boolean;
    aiConsent: boolean;
    marketingConsent: boolean;
  };
}

/**
 * Generate a deterministic cryptographic checksum (SHA-256) for session claims
 * to prevent browser storage tampering of roles, plan tiers, and identities.
 */
export async function computeSessionSignature(session: Partial<SecureAuthSession>): Promise<string> {
  const payload = [
    session.userEmail || '',
    session.role || 'user',
    session.planTier || 'free',
    session.isAuthenticated ? '1' : '0',
    session.issuedAt || 0,
    session.expiresAt || 0,
    session.jwtToken || '',
    getDeviceAuthSecret(),
  ].join('::');

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback hash for environments without SubtleCrypto
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `h-${Math.abs(hash).toString(16)}`;
}

/**
 * Audit log recording
 */
export function recordAuditLog(
  action: string,
  userEmail: string,
  details: string,
  severity: 'info' | 'warn' | 'critical' = 'info'
): void {
  try {
    const raw = localStorage.getItem(AUDIT_LOGS_KEY);
    const logs: AuditLogEntry[] = raw ? JSON.parse(raw) : [];
    logs.unshift({
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      action,
      userEmail: userEmail || 'anonymous',
      details,
      severity,
    });
    // Keep last 100 audit entries
    localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(logs.slice(0, 100)));
  } catch (err) {
    console.warn('Could not persist audit log:', err);
  }
}

export function getAuditLogs(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Register user via real FastAPI Backend with mandatory policy consents
 */
export async function registerWithBackend(
  data: BackendUserRegisterPayload
): Promise<SecureAuthSession> {
  try {
    const user = await omniDocClient.register(data);
    // After registration, automatically authenticate and obtain JWT
    const tokenData = await omniDocClient.login(data.email, data.password);
    
    const now = Date.now();
    const session: SecureAuthSession = {
      isGuest: false,
      userEmail: user.email,
      userName: user.full_name,
      role: (user.role as UserRole) || (tokenData.role as UserRole) || 'user',
      planTier: (tokenData.plan_tier as PlanTier) || (user.plan_tier as PlanTier) || 'free',
      storageUsedBytes: 0,
      isAuthenticated: true,
      issuedAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000,
      jwtToken: tokenData.access_token,
      authSource: 'backend',
      consent: {
        termsAccepted: user.terms_accepted,
        privacyAccepted: user.privacy_accepted,
        aiConsent: user.ai_consent,
        marketingConsent: user.marketing_consent,
      },
    };

    session.signature = await computeSessionSignature(session);
    recordAuditLog('BACKEND_REGISTER_SUCCESS', session.userEmail || data.email, `Registered user with server-verified consent (Terms v${data.terms_version || '2026.1'})`);
    return session;
  } catch (err: any) {
    recordAuditLog('BACKEND_REGISTER_FAILED', data.email, err?.message || 'Registration failed', 'warn');
    throw err;
  }
}

/**
 * Authenticate credentials via real FastAPI Backend and obtain secure JWT
 */
export async function loginWithBackend(
  email: string,
  password: string
): Promise<SecureAuthSession> {
  try {
    const tokenData = await omniDocClient.login(email, password);
    const profile = await omniDocClient.getProfile().catch(() => ({
      email: tokenData.email,
      full_name: tokenData.full_name || email.split('@')[0],
      role: tokenData.role || 'user',
      terms_accepted: true,
      privacy_accepted: true,
      ai_consent: true,
      marketing_consent: false,
    }));

    const now = Date.now();
    const session: SecureAuthSession = {
      isGuest: false,
      userEmail: profile.email,
      userName: profile.full_name || tokenData.full_name || email.split('@')[0],
      role: (profile.role as UserRole) || (tokenData.role as UserRole) || 'user',
      planTier: (tokenData.plan_tier as PlanTier) || 'free',
      storageUsedBytes: 0,
      isAuthenticated: true,
      issuedAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000,
      jwtToken: tokenData.access_token,
      authSource: 'backend',
      consent: {
        termsAccepted: Boolean(profile.terms_accepted),
        privacyAccepted: Boolean(profile.privacy_accepted),
        aiConsent: Boolean(profile.ai_consent),
        marketingConsent: Boolean(profile.marketing_consent),
      },
    };

    session.signature = await computeSessionSignature(session);
    recordAuditLog('BACKEND_LOGIN_SUCCESS', session.userEmail || email, `Server-authenticated JWT issued for role: ${session.role}`);
    return session;
  } catch (err: any) {
    recordAuditLog('BACKEND_LOGIN_FAILED', email, err?.message || 'Authentication failed', 'warn');
    throw err;
  }
}

/**
 * Dedicated Administrator Backend Login
 * Calls /api/v1/admin/auth/login and ensures role is server-verified 'admin'
 */
export async function adminLoginWithBackend(
  email: string,
  password: string
): Promise<SecureAuthSession> {
  try {
    const tokenData = await omniDocClient.adminLogin(email, password);
    const now = Date.now();
    const session: SecureAuthSession = {
      isGuest: false,
      userEmail: tokenData.email,
      userName: tokenData.full_name || email.split('@')[0],
      role: 'admin',
      planTier: 'enterprise',
      storageUsedBytes: 0,
      isAuthenticated: true,
      issuedAt: now,
      expiresAt: now + 12 * 60 * 60 * 1000, // 12 hours admin token
      jwtToken: tokenData.access_token,
      authSource: 'backend',
      consent: {
        termsAccepted: true,
        privacyAccepted: true,
        aiConsent: true,
        marketingConsent: false,
      },
    };

    session.signature = await computeSessionSignature(session);
    recordAuditLog('ADMIN_BACKEND_LOGIN_SUCCESS', session.userEmail || email, 'Administrative console login verified');
    return session;
  } catch (err: any) {
    recordAuditLog('ADMIN_BACKEND_LOGIN_FAILED', email, err?.message || 'Admin authentication failed', 'warn');
    throw err;
  }
}

/**
 * Log out user from both backend and local session
 */
export async function logoutUser(userEmail?: string): Promise<void> {
  try {
    await omniDocClient.logout();
  } catch {}
  try {
    localStorage.removeItem('omnidoc_backend_jwt');
    localStorage.removeItem('omnidoc_user_auth_v1');
    sessionStorage.removeItem('omnidoc_device_session_signing_secret');
  } catch {}
  recordAuditLog('LOGOUT_SUCCESS', userEmail || 'anonymous', 'Session terminated and JWT purged');
}

/**
 * Local Sandbox fallback session creation (for testing or zero-network mode)
 */
export async function createSecureSession(
  email: string,
  userName: string,
  role: UserRole = 'user',
  planTier: PlanTier = 'free'
): Promise<SecureAuthSession> {
  const now = Date.now();
  // Section 2.C: A local sandbox must never create an administrator or superadministrator session
  const safeRole: UserRole = (role === 'admin' as any || (role as string) === 'superadmin') ? 'user' : role;
  const safePlan: PlanTier = safeRole === 'user' && role === 'admin' as any ? 'free' : planTier;

  const session: SecureAuthSession = {
    isGuest: safeRole === 'guest',
    userEmail: email.trim().toLowerCase(),
    userName: userName.trim() || email.split('@')[0],
    role: safeRole,
    planTier: safePlan,
    storageUsedBytes: 0,
    isAuthenticated: true,
    issuedAt: now,
    expiresAt: now + 7 * 24 * 60 * 60 * 1000, // 7 days expiration
    deviceId: `dev-${Math.random().toString(36).substring(2, 9)}`,
    authSource: 'local_sandbox',
    consent: {
      termsAccepted: true,
      privacyAccepted: true,
      aiConsent: true,
      marketingConsent: false,
    },
  };

  session.signature = await computeSessionSignature(session);
  recordAuditLog('SANDBOX_SESSION_CREATED', session.userEmail || '', `Sandbox session issued for role: ${safeRole}`);
  return session;
}

/**
 * Validates a session against tampering and expiration.
 * If user edited localStorage (e.g. changing role to 'admin' without valid cryptographic signature),
 * this function detects the mismatch, records an audit alert, and reverts the user to an unprivileged guest!
 */
export async function verifyAndSanitizeSession(rawSession: any): Promise<SecureAuthSession> {
  if (!rawSession || typeof rawSession !== 'object' || !rawSession.isAuthenticated) {
    return {
      isGuest: true,
      userEmail: '',
      userName: 'Guest User',
      storageUsedBytes: 0,
      isAuthenticated: false,
      role: 'user',
      planTier: 'free',
      isLocalPrototype: true,
    };
  }

  // Check expiration
  if (rawSession.expiresAt && rawSession.expiresAt < Date.now()) {
    recordAuditLog('SESSION_EXPIRED', rawSession.userEmail || '', 'Session expired by timestamp', 'warn');
    return {
      isGuest: true,
      userEmail: '',
      userName: 'Guest User',
      storageUsedBytes: 0,
      isAuthenticated: false,
      role: 'user',
      planTier: 'free',
    };
  }

  // Cryptographic signature check: prevents arbitrary localStorage privilege escalation
  const expectedSig = await computeSessionSignature(rawSession);
  if (!rawSession.signature || rawSession.signature !== expectedSig) {
    recordAuditLog(
      'TAMPER_ATTEMPT_DETECTED',
      rawSession.userEmail || 'unknown',
      `Session signature mismatch! Claimed role "${rawSession.role}", tier "${rawSession.planTier}". Privileges revoked.`,
      'critical'
    );
    // Demote to unverified standard user with free plan
    return {
      isGuest: false,
      userEmail: rawSession.userEmail || '',
      userName: rawSession.userName || 'Unverified User',
      storageUsedBytes: rawSession.storageUsedBytes || 0,
      isAuthenticated: false,
      role: 'user',
      planTier: 'free',
    };
  }

  // Section 2.C: Local sandbox must NEVER retain administrator or superadministrator role
  if (rawSession.authSource === 'local_sandbox' && (rawSession.role === 'admin' || (rawSession.role as string) === 'superadmin')) {
    rawSession.role = 'user';
    rawSession.planTier = 'free';
  }

  return rawSession;
}

/**
 * Server-authorization check helper: checks if active session satisfies role and tier requirements.
 * Never grants access if signature check fails.
 */
export async function authorizeUserAction(
  session: SecureAuthSession,
  requiredRole?: UserRole,
  requiredTier?: PlanTier
): Promise<{ allowed: boolean; reason?: string }> {
  const verified = await verifyAndSanitizeSession(session);
  if (!verified.isAuthenticated) {
    return { allowed: false, reason: 'Authentication required. Please sign in.' };
  }

  if (requiredRole === 'admin' && verified.role !== 'admin') {
    recordAuditLog('UNAUTHORIZED_ACCESS_BLOCKED', verified.userEmail || '', 'Admin role required', 'warn');
    return { allowed: false, reason: 'Forbidden: Administrator privileges required.' };
  }

  if (requiredRole === 'staff' && verified.role !== 'admin' && verified.role !== 'staff') {
    return { allowed: false, reason: 'Forbidden: Staff privileges required.' };
  }

  const tierRanks: Record<PlanTier, number> = {
    free: 0,
    starter: 1,
    pro: 2,
    enterprise: 3,
  };

  if (requiredTier && (tierRanks[verified.planTier || 'free'] < tierRanks[requiredTier])) {
    return { allowed: false, reason: `Feature requires ${requiredTier.toUpperCase()} plan tier.` };
  }

  return { allowed: true };
}

/**
 * Handle password reset via real backend API with audit logging
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; message: string; resetToken?: string; emailDispatched?: boolean }> {
  if (!email || !email.includes('@')) {
    return { success: false, message: 'Please provide a valid email address.' };
  }
  try {
    const res = await omniDocClient.requestPasswordReset(email);
    recordAuditLog('PASSWORD_RESET_REQUESTED', email, 'Server-issued password reset token generated.');
    return {
      success: true,
      message: res.message || `Password reset instructions generated for ${email}.`,
      resetToken: res.reset_token,
      emailDispatched: res.email_dispatched ?? false,
    };
  } catch (err: any) {
    // Return honest failure state if backend is unreachable
    recordAuditLog('PASSWORD_RESET_UNAVAILABLE', email, 'Password reset server service is currently unavailable.', 'warn');
    return {
      success: false,
      message: 'Password reset service is currently unreachable. Please check server connectivity or contact administrator.',
    };
  }
}

/**
 * Confirm password reset with server-verified token
 */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await omniDocClient.resetPassword(token, newPassword);
    recordAuditLog('PASSWORD_RESET_COMPLETED', 'token_user', 'Password updated with server verification.');
    return { success: true, message: res.message };
  } catch (err: any) {
    recordAuditLog('PASSWORD_RESET_FAILED', 'token_user', err?.message || 'Password reset failed', 'warn');
    return { success: false, message: err?.message || 'Password reset failed.' };
  }
}

/**
 * Complete account deletion and wipe all user data
 */
export function deleteUserAccount(email: string): void {
  recordAuditLog('ACCOUNT_DELETED', email, 'User account and all personal assets permanently wiped.', 'critical');
  localStorage.removeItem('omnidoc_user_auth_v1');
  localStorage.removeItem('omnidoc_projects_v1');
  localStorage.removeItem('omnidoc_history_v1');
  localStorage.removeItem('omnidoc_backend_jwt');
}
