/**
 * Plash Pilates — Authentication & Session Manager
 * Handles user login, signup, session persistence, role-based route access, and password recovery.
 * @module auth
 */

import { events, EVENT } from './events.js';
import * as store from './store.js';
import { 
  dbSignIn, 
  dbGetUserProfile, 
  dbSignOut, 
  isSupabaseConfigured, 
  dbSignUp,
  dbResetPasswordForEmail,
  dbUpdateUserPassword
} from './supabase.js';

const SESSION_STORAGE_KEY = 'plash_auth_session_v1';
export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes idle timeout
let lastActivitySaveTime = 0;

/**
 * Pre-configured demo accounts for seamless 1-click preview
 */
export const DEMO_ACCOUNTS = {
  member: {
    role: 'member',
    email: 'aisha.kapoor@example.com',
    password: 'member123',
    altPassword: 'plashMember2026!',
    label: 'Aisha Kapoor (Active Pass)',
    id: '11111111-1111-1111-1111-111111111111'
  },
  admin: {
    role: 'admin',
    email: 'studio.admin@plashpilates.com',
    password: 'plashAdmin2026!',
    altPassword: 'admin123',
    label: 'Studio Administrator',
    id: '22222222-2222-2222-2222-222222222222'
  },
  partner: {
    role: 'partner',
    email: 'ananya.deshmukh@physicq57.com',
    password: 'plashPartner2026!',
    altPassword: 'partner123',
    label: 'Physicq 57 Lead Coach',
    id: '33333333-3333-3333-3333-333333333333'
  },
  trainer: {
    role: 'trainer',
    email: 'priya.sharma@plashpilates.com',
    password: 'plashTrainer2026!',
    altPassword: 'trainer123',
    label: 'Priya Sharma (Master Trainer)',
    id: '44444444-4444-4444-4444-444444444444'
  }
};

/** Check whether running in local development or test runner */
export function isDevEnvironment() {
  if (typeof window === 'undefined') return true; // Node test runner
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
}

// Initial state loaded from storage or default unauthenticated
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.isAuthenticated) {
        // Enforce 30-minute idle session timeout
        if (parsed.lastActivityTime && (Date.now() - parsed.lastActivityTime > INACTIVITY_TIMEOUT_MS)) {
          console.log('[Auth] Persisted session expired due to 30 minutes of inactivity');
          localStorage.removeItem(SESSION_STORAGE_KEY);
        } else {
          if (parsed.currentMemberId === 'member-001') {
            parsed.currentMemberId = '11111111-1111-1111-1111-111111111111';
          }
          if (!parsed.lastActivityTime) {
            parsed.lastActivityTime = Date.now();
          }
          return parsed;
        }
      }
    }
  } catch (_) {
    // fallback
  }

  return {
    isAuthenticated: false,
    currentRole: 'member',
    currentMemberId: null,
    currentAdminId: null,
    currentPartnerUserId: null,
    currentTrainerId: null,
    currentUserEmail: null,
    currentUserFullName: null,
    lastActivityTime: null
  };
}

const authState = loadSession();

function saveSession() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(authState));
    }
  } catch (e) {
    console.warn('Session save failed:', e);
  }
}

/**
 * Record user activity to keep the 30-minute session alive.
 * Throttled to write to localStorage at most once every 30 seconds.
 */
export function recordUserActivity() {
  if (!authState.isAuthenticated) return;
  const now = Date.now();
  authState.lastActivityTime = now;
  if (now - lastActivitySaveTime > 30000) {
    lastActivitySaveTime = now;
    saveSession();
  }
}

/**
 * Check if the active session has exceeded 30 minutes of inactivity.
 * If expired, automatically terminates the session and triggers logout.
 * @returns {boolean} true if timed out, false otherwise
 */
export function checkSessionInactivity() {
  if (!authState.isAuthenticated) return false;
  if (authState.lastActivityTime && (Date.now() - authState.lastActivityTime > INACTIVITY_TIMEOUT_MS)) {
    console.log('[Auth] Session timed out after 30 minutes of inactivity.');
    logout('timeout');
    return true;
  }
  return false;
}

/**
 * Helper to test inactivity expiration in QA runner.
 * @param {number} timestamp
 */
export function _setLastActivityTimeForTesting(timestamp) {
  authState.lastActivityTime = timestamp;
}

/** @returns {boolean} Whether a user session is active */
export function isAuthenticated() {
  if (!authState.isAuthenticated) {
    try {
      const fresh = loadSession();
      if (fresh && fresh.isAuthenticated) {
        Object.assign(authState, fresh);
      }
    } catch (_) {}
  }
  if (!authState.isAuthenticated) return false;
  if (authState.lastActivityTime && (Date.now() - authState.lastActivityTime > INACTIVITY_TIMEOUT_MS)) {
    logout('timeout');
    return false;
  }
  return Boolean(authState.isAuthenticated);
}

/** @returns {'member'|'admin'|'partner'|'trainer'} */
export function getCurrentRole() {
  return authState.currentRole || 'member';
}

/** @returns {string|null} */
export function getCurrentMemberId() {
  if (!isAuthenticated()) return null;
  if (authState.currentUserEmail && typeof store.getMembers === 'function') {
    const members = store.getMembers();
    if (Array.isArray(members) && members.length > 0) {
      const liveMember = members.find(m => (m.email || '').toLowerCase() === authState.currentUserEmail.toLowerCase());
      if (liveMember && liveMember.id && liveMember.id !== authState.currentMemberId) {
        authState.currentMemberId = liveMember.id;
        saveSession();
      }
    }
  }
  return authState.currentMemberId || null;
}

/**
 * Synchronize member ID with active Supabase profile
 * @param {string} newId
 */
export function syncMemberId(newId) {
  if (newId && authState.currentMemberId !== newId) {
    console.log(`[Auth Sync] Updating stale memberId ${authState.currentMemberId} -> ${newId}`);
    authState.currentMemberId = newId;
    saveSession();
  }
}

/** @returns {Object|null} Alias for member profile */
export function getCurrentMember() {
  return getCurrentUser();
}

/** @returns {Object|null} Current user based on role */
export function getCurrentUser() {
  if (!isAuthenticated()) return null;

  const allMembers = typeof store.getAllMembers === 'function' ? store.getAllMembers() : (typeof store.getMembers === 'function' ? store.getMembers() : []);
  const findProfile = (id, email) => {
    if (id) {
      const byId = allMembers.find(m => m.id && String(m.id).toLowerCase() === String(id).toLowerCase());
      if (byId) return byId;
      const byStore = store.getMemberById(id);
      if (byStore) return byStore;
    }
    if (email) {
      const byEmail = allMembers.find(m => m.email && m.email.toLowerCase() === email.toLowerCase());
      if (byEmail) return byEmail;
    }
    return null;
  };

  switch (authState.currentRole) {
    case 'member': {
      const liveUser = findProfile(authState.currentMemberId, authState.currentUserEmail);
      if (liveUser && (liveUser.fullName || liveUser.name)) {
        return {
          id: liveUser.id || authState.currentMemberId || 'member-001',
          fullName: liveUser.fullName || liveUser.name,
          name: liveUser.fullName || liveUser.name,
          email: liveUser.email || authState.currentUserEmail || 'member@example.com',
          tier: liveUser.tier || 'Standard'
        };
      }
      const fallbackName = authState.currentUserFullName || (authState.currentUserEmail ? authState.currentUserEmail.split('@')[0] : 'Studio Member');
      return {
        id: authState.currentMemberId || 'member-001',
        fullName: fallbackName,
        name: fallbackName,
        email: authState.currentUserEmail || 'member@example.com',
        tier: 'Standard'
      };
    }
    case 'admin': {
      const liveAdmin = findProfile(authState.currentAdminId, authState.currentUserEmail);
      if (liveAdmin && (liveAdmin.fullName || liveAdmin.name)) {
        const resolvedName = liveAdmin.fullName || liveAdmin.name;
        return {
          id: liveAdmin.id || authState.currentAdminId || 'admin-001',
          name: resolvedName,
          fullName: resolvedName,
          email: liveAdmin.email || authState.currentUserEmail || 'studio.admin@plashpilates.com',
          role: 'admin'
        };
      }
      const adminSeed = store.getAdminUsers().find(a => a.id === authState.currentAdminId);
      const fallbackName = authState.currentUserFullName || (adminSeed ? adminSeed.name : (authState.currentUserEmail && !authState.currentUserEmail.toLowerCase().includes('studio.admin') ? authState.currentUserEmail.split('@')[0] : 'Studio Administrator'));
      return {
        id: authState.currentAdminId || 'admin-001',
        name: fallbackName,
        fullName: fallbackName,
        email: authState.currentUserEmail || 'studio.admin@plashpilates.com',
        role: 'admin'
      };
    }
    case 'partner': {
      const livePartner = findProfile(authState.currentPartnerUserId, authState.currentUserEmail);
      if (livePartner && (livePartner.fullName || livePartner.name)) {
        const resolvedName = livePartner.fullName || livePartner.name;
        return {
          id: livePartner.id || authState.currentPartnerUserId || 'partner-user-001',
          name: resolvedName,
          fullName: resolvedName,
          email: livePartner.email || authState.currentUserEmail || 'ananya.deshmukh@physicq57.com',
          role: 'partner'
        };
      }
      const partnerSeed = store.getPartnerUsers().find(p => p.id === authState.currentPartnerUserId);
      const fallbackName = authState.currentUserFullName || (partnerSeed ? partnerSeed.name : 'Physicq 57 Coach');
      return {
        id: authState.currentPartnerUserId || 'partner-user-001',
        name: fallbackName,
        fullName: fallbackName,
        email: authState.currentUserEmail || 'ananya.deshmukh@physicq57.com',
        role: 'partner'
      };
    }
    case 'trainer': {
      const liveTrainer = findProfile(authState.currentTrainerId || authState.userId, authState.currentUserEmail);
      if (liveTrainer && (liveTrainer.fullName || liveTrainer.name)) {
        const resolvedName = liveTrainer.fullName || liveTrainer.name;
        return {
          id: liveTrainer.id || authState.currentTrainerId || authState.userId || 'trainer-001',
          name: resolvedName,
          fullName: resolvedName,
          email: liveTrainer.email || authState.currentUserEmail,
          role: 'trainer'
        };
      }
      const trainer = store.getTrainerById(authState.currentTrainerId) || (store.getTrainers() || []).find(t => (t.email || '').toLowerCase() === (authState.currentUserEmail || '').toLowerCase());
      const fallbackName = authState.currentUserFullName || (trainer ? trainer.name : (authState.currentUserEmail ? authState.currentUserEmail.split('@')[0] : 'Studio Trainer'));
      return {
        id: trainer ? trainer.id : (authState.currentTrainerId || authState.userId || 'trainer-001'),
        name: fallbackName,
        fullName: fallbackName,
        email: authState.currentUserEmail || (trainer ? trainer.email : 'trainer@plashpilates.com'),
        role: 'trainer',
        tier: trainer ? trainer.tier : undefined,
        disciplineId: trainer ? trainer.disciplineId : undefined
      };
    }
    default:
      return null;
  }
}

/**
 * Log in with credentials and verified role detection.
 * Enterprise production standard: checks Supabase Auth first, then verifies exact credentials.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>} User session
 */
export async function login(email, password) {
  if (!email || !password) {
    throw new Error('Please provide both email and password.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = String(password).trim();

  // Clear any existing browser session state so new login is completely fresh
  authState.isAuthenticated = false;
  authState.currentRole = 'member';
  authState.currentMemberId = null;
  authState.currentAdminId = null;
  authState.currentPartnerUserId = null;
  authState.currentTrainerId = null;
  authState.userId = null;
  authState.currentUserEmail = null;
  authState.lastActivityTime = null;

  // 1. Live Supabase Authentication
  if (isSupabaseConfigured()) {
    try {
      const authRes = await dbSignIn(cleanEmail, cleanPass);
      if (authRes && authRes.user) {
        const profile = await dbGetUserProfile(authRes.user.id);
        if (!profile) {
          throw new Error('Account profile not found or has been removed. Please register or contact support.');
        }
        const role = profile.role || 'member';

        authState.isAuthenticated = true;
        authState.currentRole = role;
        authState.currentUserEmail = cleanEmail;
        authState.userId = authRes.user.id;
        authState.lastActivityTime = Date.now();
        authState.currentUserFullName = (profile && (profile.full_name || profile.fullName)) || null;

        if (role === 'admin') {
          authState.currentAdminId = authRes.user.id;
        } else if (role === 'trainer') {
          const trainer = (store.getTrainers() || []).find(t => (t.email || '').toLowerCase() === cleanEmail || (t.name || '').toLowerCase().includes(cleanEmail.split('@')[0]));
          authState.currentTrainerId = trainer ? trainer.id : authRes.user.id;
        } else if (role === 'partner') {
          authState.currentPartnerUserId = authRes.user.id;
        } else {
          authState.currentMemberId = authRes.user.id;
        }

        saveSession();
        try {
          await store.syncFromSupabase();
        } catch (syncErr) {
          console.warn('[store.syncFromSupabase post-login]', syncErr);
        }
        events.emit(EVENT.AUTH_ROLE_CHANGED, { role });
        if (role === 'member') events.emit(EVENT.AUTH_MEMBER_CHANGED, { memberId: authState.currentMemberId });
        try {
          store.logSystemActivity(
            authRes.user.id,
            role,
            `Signed in to account (${role})`,
            'auth',
            { email: cleanEmail, role, client: 'web' }
          );
        } catch (_) {}
        return getCurrentUser();
      }
    } catch (err) {
      console.warn('[Supabase Auth attempt fallback to verified credentials]', err.message);
    }
  }

  // 2. Strict Verification against Demo & Seed Credentials (Development & Local Sandbox only)
  if (!isDevEnvironment()) {
    throw new Error('Invalid email or password. Please verify your credentials or register a membership.');
  }

  // Check Admin
  const adminAccount = DEMO_ACCOUNTS.admin;
  if (cleanEmail === adminAccount.email.toLowerCase()) {
    if (cleanPass === adminAccount.password || cleanPass === adminAccount.altPassword) {
      authState.isAuthenticated = true;
      authState.currentRole = 'admin';
      authState.currentAdminId = adminAccount.id;
      authState.currentUserEmail = cleanEmail;
      authState.lastActivityTime = Date.now();
      saveSession();
      events.emit(EVENT.AUTH_ROLE_CHANGED, { role: 'admin' });
      return getCurrentUser();
    }
    throw new Error('Invalid password for Studio Administrator account.');
  }

  // Check Trainer
  const trainerAccount = DEMO_ACCOUNTS.trainer;
  if (cleanEmail === trainerAccount.email.toLowerCase()) {
    if (cleanPass === trainerAccount.password || cleanPass === trainerAccount.altPassword) {
      authState.isAuthenticated = true;
      authState.currentRole = 'trainer';
      authState.currentTrainerId = trainerAccount.id;
      authState.currentUserEmail = cleanEmail;
      authState.lastActivityTime = Date.now();
      saveSession();
      events.emit(EVENT.AUTH_ROLE_CHANGED, { role: 'trainer' });
      return getCurrentUser();
    }
    throw new Error('Invalid password for Master Trainer account.');
  }

  // Check Partner
  const partnerAccount = DEMO_ACCOUNTS.partner;
  if (cleanEmail === partnerAccount.email.toLowerCase()) {
    if (cleanPass === partnerAccount.password || cleanPass === partnerAccount.altPassword) {
      authState.isAuthenticated = true;
      authState.currentRole = 'partner';
      authState.currentPartnerUserId = partnerAccount.id;
      authState.currentUserEmail = cleanEmail;
      authState.lastActivityTime = Date.now();
      saveSession();
      events.emit(EVENT.AUTH_ROLE_CHANGED, { role: 'partner' });
      return getCurrentUser();
    }
    throw new Error('Invalid password for Physicq 57 Partner account.');
  }

  // Check Demo Member
  const memberAccount = DEMO_ACCOUNTS.member;
  if (cleanEmail === memberAccount.email.toLowerCase()) {
    if (cleanPass === memberAccount.password || cleanPass === memberAccount.altPassword) {
      authState.isAuthenticated = true;
      authState.currentRole = 'member';
      authState.currentMemberId = memberAccount.id;
      authState.currentUserEmail = cleanEmail;
      authState.lastActivityTime = Date.now();
      saveSession();
      events.emit(EVENT.AUTH_ROLE_CHANGED, { role: 'member' });
      events.emit(EVENT.AUTH_MEMBER_CHANGED, { memberId: authState.currentMemberId });
      return getCurrentUser();
    }
    throw new Error('Invalid password for Member account.');
  }

  // If not a demo account and Supabase failed/unavailable, check if member exists
  let memberCheck = { exists: false, isMember: false };
  try {
    memberCheck = await checkMemberExists(cleanEmail);
  } catch (_) {}

  if (!memberCheck.exists && !memberCheck.isMember) {
    throw new Error('Account not found. This email is not registered as a member. Please create an account to get started.');
  }

  throw new Error('Invalid password. Please check your credentials or reset your password.');
}

/**
 * Check if an email belongs to an existing member or user account.
 * @param {string} email
 * @returns {Promise<{ exists: boolean, isMember: boolean, role?: string }>}
 */
export async function checkMemberExists(email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return { exists: false, isMember: false };

  // 1. Check demo accounts
  for (const acc of Object.values(DEMO_ACCOUNTS)) {
    if (acc.email && acc.email.toLowerCase() === cleanEmail) {
      return { exists: true, isMember: true, role: acc.role };
    }
  }

  // 2. Authoritative check: live backend server endpoint
  try {
    const baseUrl = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3333';
    const res = await fetch(`${baseUrl}/api/auth/check-member?email=${encodeURIComponent(cleanEmail)}`);
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.warn('[checkMemberExists warning]', err.message);
  }

  // 3. Offline / Test runner fallback
  if (typeof window === 'undefined' && typeof store !== 'undefined' && store.getAllMembers) {
    const localMember = store.getAllMembers().find(m => (m.email || '').toLowerCase() === cleanEmail);
    if (localMember) {
      return { exists: true, isMember: true, role: 'member' };
    }
  }

  return { exists: false, isMember: false };
}

/**
 * Sign up a brand new studio member.
 * @param {Object} data - { fullName, email, phone, movementLevel, password }
 * @returns {Promise<Object>} New member
 */
export async function signup(data) {
  if (!data.fullName || !data.email) {
    throw new Error('Full name and email are mandatory.');
  }

  const cleanEmail = data.email.trim().toLowerCase();
  const cleanName = data.fullName.trim();
  const cleanPhone = (data.phone || '').trim();

  // Under strict OTP gate, signup initiates OTP dispatch
  return requestSignupOtp({
    fullName: cleanName,
    email: cleanEmail,
    phone: cleanPhone,
    password: data.password,
    movementLevel: data.movementLevel
  });
}

// In-memory pending signup state for dev/offline mode
const devPendingSignups = new Map();

/**
 * Request 6-digit OTP activation code for new member registration.
 * @param {Object} data
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function requestSignupOtp(data) {
  if (!data.fullName || !data.email || !data.password) {
    throw new Error('Full name, email, and password are required.');
  }

  const cleanEmail = data.email.trim().toLowerCase();
  const cleanName = data.fullName.trim();
  const cleanPhone = (data.phone || '').trim();

  // Offline / mock runner cross-check
  if (typeof window === 'undefined') {
    const existing = store.getAllMembers().find(m => (m.email || '').toLowerCase() === cleanEmail);
    if (existing) {
      throw new Error('An account with this email is already registered. Please sign in instead.');
    }
  }

  try {
    const baseUrl = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3333';
    const res = await fetch(`${baseUrl}/api/auth/request-signup-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        fullName: cleanName,
        phone: cleanPhone,
        password: data.password,
        movementLevel: data.movementLevel
      })
    });

    const body = await res.json();
    if (!res.ok || !body.success) {
      throw new Error(body.error || 'Failed to dispatch activation code.');
    }

    return body;
  } catch (err) {
    if (isDevEnvironment() || typeof window === 'undefined') {
      const mockCode = '742918';
      devPendingSignups.set(cleanEmail, {
        email: cleanEmail,
        fullName: cleanName,
        phone: cleanPhone,
        password: data.password,
        movementLevel: data.movementLevel,
        code: mockCode,
        expiresAt: Date.now() + 600000
      });
      return {
        success: true,
        message: `A 6-digit activation code has been dispatched to ${cleanEmail}.`
      };
    }
    throw err;
  }
}

/**
 * Verify 6-digit activation OTP and finalize member account creation.
 * @param {string} email
 * @param {string} code
 * @param {Object} [signupData]
 * @returns {Promise<Object>} Created and authenticated member
 */
export async function verifySignupOtp(email, code, signupData = {}) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanCode = String(code || '').trim();

  if (!cleanCode || cleanCode.length < 6 || cleanCode.length > 10) {
    throw new Error('Please enter the complete verification code.');
  }

  let verifiedUser = null;

  try {
    const baseUrl = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3333';
    const res = await fetch(`${baseUrl}/api/auth/verify-signup-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, code: cleanCode })
    });

    const body = await res.json();
    if (!res.ok || !body.success) {
      throw new Error(body.error || 'Invalid or expired activation code.');
    }

    verifiedUser = body.user;
  } catch (err) {
    const pending = devPendingSignups.get(cleanEmail);
    if (pending) {
      if (Date.now() > pending.expiresAt) {
        devPendingSignups.delete(cleanEmail);
        throw new Error('Activation code has expired. Please sign up again.');
      }
      if (pending.code !== cleanCode) {
        throw new Error('Invalid 6-digit activation code. Please check and try again.');
      }
      verifiedUser = {
        id: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => (Math.random() * 16 | 0).toString(16)),
        email: cleanEmail,
        fullName: pending.fullName,
        phone: pending.phone,
        movementLevel: pending.movementLevel,
        role: 'member',
        tier: 'Founding Standard'
      };
      devPendingSignups.delete(cleanEmail);
    } else {
      throw err;
    }
  }

  // Add member to local store
  const member = store.addMember({
    id: verifiedUser.id,
    fullName: verifiedUser.fullName || signupData.fullName || 'Studio Member',
    name: verifiedUser.fullName || signupData.fullName || 'Studio Member',
    email: cleanEmail,
    phone: verifiedUser.phone || signupData.phone || '+91 98765 00000',
    tier: 'Founding Standard',
    emergencyContact: '+91 98765 11111'
  });

  if (verifiedUser.movementLevel || signupData.movementLevel) {
    store.updateHealthProfile(member.id, {
      movementLevel: verifiedUser.movementLevel || signupData.movementLevel,
      fitnessGoals: ['Core Conditioning', 'Flexibility']
    });
  }

  // Update session state
  authState.isAuthenticated = true;
  authState.currentRole = 'member';
  authState.currentMemberId = member.id;
  authState.currentUserEmail = member.email;
  authState.lastActivityTime = Date.now();
  saveSession();

  events.emit(EVENT.AUTH_ROLE_CHANGED, { role: 'member' });
  events.emit(EVENT.AUTH_LOGIN, { role: 'member', user: member });

  return member;
}

/**
 * Log out and clear authenticated session.
 * @param {string|null} [reason] - e.g. 'timeout' when idle 30 minutes
 */
export function logout(reason = null) {
  const prevUserId = authState.userId || authState.currentMemberId || authState.currentAdminId;
  const prevRole = authState.currentRole || 'user';
  if (prevUserId) {
    try {
      store.logSystemActivity(
        prevUserId, 
        prevRole, 
        reason === 'timeout' ? 'Session timed out (30m inactivity)' : 'Signed out of session', 
        'auth', 
        {}
      );
    } catch (_) {}
  }
  authState.isAuthenticated = false;
  authState.currentUserEmail = null;
  authState.currentMemberId = null;
  authState.currentAdminId = null;
  authState.currentPartnerUserId = null;
  authState.currentTrainerId = null;
  authState.userId = null;
  authState.lastActivityTime = null;
  saveSession();
  dbSignOut();
  events.emit(EVENT.AUTH_ROLE_CHANGED, { role: null });
  if (typeof window !== 'undefined') {
    window.location.hash = '#/login';
    if (reason === 'timeout') {
      setTimeout(() => {
        events.emit(EVENT.TOAST_SHOW, {
          type: 'warning',
          message: 'Your session has expired due to 30 minutes of inactivity. Please sign in again.'
        });
      }, 200);
    }
  }
}

/**
 * Request password recovery email using Supabase GoTrue Auth.
 * @param {string} email
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function requestPasswordReset(email) {
  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid registered email address.');
  }
  const cleanEmail = email.trim().toLowerCase();
  await dbResetPasswordForEmail(cleanEmail);
  return { 
    success: true, 
    message: `A secure password recovery link has been dispatched to ${cleanEmail}.` 
  };
}

/**
 * Validate password rules:
 * - Minimum 6 characters
 * - At least 1 uppercase letter
 * - At least 1 number
 * - At least 1 special character
 * @param {string} password
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePassword(password) {
  if (!password || password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least 1 uppercase letter (A-Z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least 1 number (0-9).' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    return { valid: false, error: 'Password must contain at least 1 special character (e.g. !@#$%&*).' };
  }
  return { valid: true };
}

/**
 * Complete password reset with new password and optional recovery access token.
 * @param {string} newPassword
 * @param {string} [recoveryToken]
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function completePasswordReset(newPassword, recoveryToken = null) {
  const check = validatePassword(newPassword);
  if (!check.valid) {
    throw new Error(check.error);
  }
  await dbUpdateUserPassword(newPassword, recoveryToken);
  try {
    logout();
  } catch (_) {}
  return { success: true, message: 'Password updated successfully. You can now log in.' };
}

// In-memory verification code store for test runner and offline dev
const devPendingEmailChanges = new Map();

/**
 * Internal test helper to retrieve pending verification code in test runner environment only.
 * @internal
 */
export function _getTestVerificationCode(memberId) {
  const pending = devPendingEmailChanges.get(memberId);
  return pending ? pending.code : '742918';
}

/**
 * Request an email change for the authenticated member.
 * Dispatches a 6-digit security verification code to the new address.
 * @param {string} newEmail
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function requestEmailChange(newEmail) {
  if (!isAuthenticated()) {
    throw new Error('Authentication required to update email address.');
  }
  const cleanEmail = (newEmail || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    throw new Error('Please provide a valid new email address.');
  }
  if (cleanEmail === (authState.currentUserEmail || '').toLowerCase()) {
    throw new Error('New email address must be different from your current email.');
  }

  const memberId = getCurrentMemberId();

  // 1. Strict Local Database Cross-Check: Prevent linking email that belongs to another account
  const existingLocal = store.getAllMembers().find(m => (m.email || '').toLowerCase() === cleanEmail && String(m.id).toLowerCase() !== String(memberId).toLowerCase());
  if (existingLocal) {
    throw new Error('This email address is already in use by another account in our database. Please use a different email.');
  }

  try {
    const baseUrl = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3333';
    const res = await fetch(`${baseUrl}/api/auth/request-email-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, newEmail: cleanEmail })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to dispatch verification code.');
    }
    return {
      success: true,
      message: data.message || `A 6-digit verification code has been dispatched to ${cleanEmail}.`
    };
  } catch (err) {
    // In-memory / dev fallback if running test runner or offline
    if (isDevEnvironment() || typeof window === 'undefined') {
      const mockCode = '742918';
      devPendingEmailChanges.set(memberId, {
        newEmail: cleanEmail,
        code: mockCode,
        expiresAt: Date.now() + 600000
      });
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('plash_pending_email_change', JSON.stringify({
          memberId,
          newEmail: cleanEmail,
          code: mockCode,
          expiresAt: Date.now() + 600000
        }));
      }
      return {
        success: true,
        message: `A 6-digit verification code has been dispatched to ${cleanEmail}. Please check your inbox.`
      };
    }
    throw err;
  }
}

/**
 * Verify 6-digit security code and finalize member email update.
 * @param {string} newEmail
 * @param {string} code
 * @returns {Promise<{ success: boolean, email: string, message: string }>}
 */
export async function verifyEmailChange(newEmail, code) {
  if (!isAuthenticated()) {
    throw new Error('Authentication required to verify email.');
  }
  const cleanEmail = (newEmail || '').trim().toLowerCase();
  const cleanCode = String(code || '').trim();
  if (!cleanCode || cleanCode.length < 6 || cleanCode.length > 10) {
    throw new Error('Please enter the complete verification code.');
  }

  const memberId = getCurrentMemberId();
  let verified = false;
  let resultMsg = '';

  try {
    const baseUrl = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3333';
    const res = await fetch(`${baseUrl}/api/auth/verify-email-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, newEmail: cleanEmail, code: cleanCode })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Invalid or expired verification code.');
    }
    verified = true;
    resultMsg = data.message;
  } catch (err) {
    // Check in-memory or session fallback
    const pending = devPendingEmailChanges.get(memberId) || 
      (typeof sessionStorage !== 'undefined' ? JSON.parse(sessionStorage.getItem('plash_pending_email_change') || 'null') : null);

    if (pending && pending.newEmail === cleanEmail) {
      if (Date.now() > pending.expiresAt) {
        devPendingEmailChanges.delete(memberId);
        throw new Error('Verification code has expired. Please request a new code.');
      }
      if (pending.code !== cleanCode) {
        throw new Error('Invalid 6-digit verification code. Please check and try again.');
      }
      verified = true;
      devPendingEmailChanges.delete(memberId);
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('plash_pending_email_change');
    }
    if (!verified) throw err;
  }

  // Update active session state
  authState.currentUserEmail = cleanEmail;
  saveSession();

  // Update member in local store
  await store.updateMemberProfile(memberId, { email: cleanEmail });

  try {
    store.logActivity(
      memberId,
      'member',
      `Updated account email to ${cleanEmail} via OTP security verification`,
      'auth',
      { newEmail: cleanEmail }
    );
  } catch (_) {}

  events.emit(EVENT.PROFILE_UPDATED, { memberId, email: cleanEmail });
  return {
    success: true,
    email: cleanEmail,
    message: resultMsg || `Email address successfully verified and updated to ${cleanEmail}.`
  };
}

/** @returns {string} Default route for current session */
export function getDefaultRoute() {
  if (!isAuthenticated()) {
    return '#/login';
  }
  switch (authState.currentRole) {
    case 'member': return '#/portal/dashboard';
    case 'admin':  return '#/admin/overview';
    case 'trainer': return '#/trainer/dashboard';
    case 'partner': return '#/partner/requests';
    default: return '#/portal/dashboard';
  }
}

/**
 * Check if a route is allowed for current user/session.
 * @param {string} hash
 * @returns {boolean}
 */
export function isRouteAllowed(hash) {
  const cleanPath = (hash || '').split('?')[0].split('&')[0];

  // Public routes always accessible
  if (
    cleanPath.startsWith('#/login') ||
    cleanPath.startsWith('#/signup') ||
    cleanPath.startsWith('#/forgot-password') ||
    cleanPath.startsWith('#/reset-password') ||
    cleanPath.startsWith('#reset-password') ||
    cleanPath.includes('access_token=') ||
    cleanPath.includes('type=recovery') ||
    cleanPath.includes('error_description=') ||
    cleanPath.includes('error_code=') ||
    cleanPath.startsWith('#/legal/') ||
    cleanPath.startsWith('#/404') ||
    cleanPath.startsWith('#/403') ||
    cleanPath.startsWith('#/500')
  ) {
    return true;
  }

  // If user is not authenticated, protected routes are rejected
  if (!isAuthenticated()) {
    return false;
  }

  const role = getCurrentRole();
  if (hash.startsWith('#/portal/') && role === 'member') return true;
  if (hash.startsWith('#/admin/') && role === 'admin') return true;
  if (hash.startsWith('#/partner/') && role === 'partner') return true;
  if (hash.startsWith('#/trainer/') && (role === 'trainer' || role === 'admin')) return true;

  return false;
}
