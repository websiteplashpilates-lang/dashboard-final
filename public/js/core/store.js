/**
 * Plash Pilates — In-Memory Data Store
 * All data access and mutation functions.
 * Designed so each function can be swapped to a Supabase call in Phase 2.
 * @module store
 */

import { CONFIG } from './config.js';
import { events, EVENT } from './events.js';
import * as seed from './seed-data.js';
import { toISODate, getISTDateParts, parseClassDateTimeToUTC } from '../utils/format.js';
import {
  isSupabaseConfigured,
  getSupabase,
  dbGetPackages,
  dbCreatePackage,
  dbUpdatePackage,
  dbDeletePackage,
  dbGetClassSessions,
  dbGetPayments,
  dbCreatePayment,
  dbPurchasePackage,
  dbCreateBooking,
  dbCancelBooking,
  dbCreateClassSession,
  dbUpdateClassSession,
  dbDeleteClassSession,
  dbCreateMemberPass,
  dbGetDisciplines,
  dbGetTrainers,
  dbGetMembers,
  dbGetBookings,
  dbGetMemberPasses,
  dbGetWaivers,
  dbGetWaiverAcceptances,
  dbAcceptWaiver,
  dbGetPartnerOrgs,
  dbGetHealthProfiles,
  dbSaveHealthProfile,
  dbCreateMemberProfile,
  dbUpdateMemberProfile,
  dbUpdateHealthProfile,
  dbGetActivityLogs,
  dbCreateActivityLog,
  dbMarkAttendance,
  dbGrantComplimentaryPass,
} from './supabase.js';

/* ---- Pure Supabase State Containers (Zero mock data hardcoded) ---- */
try {
  if (typeof localStorage !== 'undefined') {
    const mockCleared = localStorage.getItem('plash_mock_classes_purged_v3');
    if (!mockCleared) {
      localStorage.removeItem('plash_class_sessions_cache');
      localStorage.removeItem('plash_recurring_rules_v1');
      localStorage.setItem('plash_mock_classes_purged_v3', 'true');
    }
  }
} catch (_) {}

const DEFAULT_RECURRING_RULES = [];

function loadInitialRecurringRules() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('plash_recurring_rules_v1');
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch (_) {}
  return [];
}

const state = {
  studio:              structuredClone(seed.studio),
  disciplines:         structuredClone(seed.disciplines),
  trainers:            structuredClone(seed.trainers),
  packages:            [],
  classSessions:       [],
  members:             [],
  healthProfiles:      [],
  memberPasses:        [],
  memberPassCredits:   [],
  bookings:            [],
  pauseRequests:       [],
  waivers:             structuredClone(seed.waivers),
  waiverAcceptances:   [],
  partnerOrgs:         [],
  partnerUsers:        structuredClone(seed.partnerUsers),
  partnerNotifications: [],
  partnerReviews:      [],
  payments:            [],
  adminUsers:          structuredClone(seed.adminUsers),
  activityLog:         [],
  recurringRules:      loadInitialRecurringRules(),
};

// Normalize session date/time/duration fields for uniform access
state.classSessions.forEach(s => {
  if (s.startsAt && !s.date) {
    const d = new Date(s.startsAt);
    s.date = d.toISOString().slice(0, 10);
    s.time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  if (!s.durationMinutes) {
    s.durationMinutes = s.durationMin || 60;
  }
});

let nextId = 100;
const genId = (prefix) => `${prefix}-${++nextId}`;

/* ---- Custom Package Persistence Helpers ---- */
/* ---- Custom Package Persistence Helpers (Cleaned for Supabase 1:1) ---- */
const STORAGE_KEY_PACKAGES = 'plash_custom_packages';
const STORAGE_KEY_MEMBERS = 'plash_registered_members';
const STORAGE_KEY_CLASS_SESSIONS = 'plash_class_sessions_cache';
const STORAGE_KEY_MEMBER_PASSES = 'plash_member_passes_cache';
const STORAGE_KEY_MEMBER_PASS_CREDITS = 'plash_member_pass_credits_cache';
const STORAGE_KEY_BOOKINGS = 'plash_bookings_cache';

export function getCachedBookings() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY_BOOKINGS);
      return raw ? JSON.parse(raw) : [];
    }
  } catch (_) {}
  return [];
}

export function saveBookingsCache() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_BOOKINGS, JSON.stringify(state.bookings));
    }
  } catch (_) {}
}

export function getCachedClassSessions() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY_CLASS_SESSIONS);
      return raw ? JSON.parse(raw) : [];
    }
  } catch (_) {}
  return [];
}

export function saveClassSessionsCache() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CLASS_SESSIONS, JSON.stringify(state.classSessions));
    }
  } catch (_) {}
}

export function getCachedMemberPasses() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY_MEMBER_PASSES);
      return raw ? JSON.parse(raw) : [];
    }
  } catch (_) {}
  return [];
}

export function getCachedMemberPassCredits() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY_MEMBER_PASS_CREDITS);
      return raw ? JSON.parse(raw) : [];
    }
  } catch (_) {}
  return [];
}

export function saveMemberPassesCache() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_MEMBER_PASSES, JSON.stringify(state.memberPasses));
      localStorage.setItem(STORAGE_KEY_MEMBER_PASS_CREDITS, JSON.stringify(state.memberPassCredits));
    }
  } catch (_) {}
}

// Purge obsolete mock packages, members, sessions, and recurring rules so front-end strictly matches Supabase live state
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_PACKAGES);
    localStorage.removeItem(STORAGE_KEY_MEMBERS);
    const mockCleared = localStorage.getItem('plash_mock_classes_purged_v3');
    if (!mockCleared) {
      localStorage.removeItem(STORAGE_KEY_CLASS_SESSIONS);
      localStorage.removeItem('plash_recurring_rules_v1');
      localStorage.setItem('plash_mock_classes_purged_v3', 'true');
    }
  }
} catch (_) {}

export function getLocalRegisteredMembers() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY_MEMBERS);
      return raw ? JSON.parse(raw) : [];
    }
  } catch (_) {}
  return [];
}

export function saveLocalRegisteredMember(member) {
  try {
    if (typeof localStorage !== 'undefined') {
      const list = getLocalRegisteredMembers();
      const idx = list.findIndex(m => m.id === member.id || (m.email && member.email && m.email.toLowerCase() === member.email.toLowerCase()));
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...member };
      } else {
        list.push(member);
      }
      localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(list));
    }
  } catch (_) {}
}

// Hydrate initial state with any locally registered members
try {
  const initialLocalMembers = getLocalRegisteredMembers();
  if (initialLocalMembers.length > 0) {
    initialLocalMembers.forEach(lm => {
      if (!state.members.some(m => (m.email || '').toLowerCase() === (lm.email || '').toLowerCase())) {
        state.members.push(lm);
      }
    });
  }
} catch (_) {}

// Hydrate initial state with any locally cached class sessions and member passes
try {
  const cachedSessions = getCachedClassSessions();
  if (cachedSessions && cachedSessions.length > 0) {
    state.classSessions = cachedSessions;
  }
  const cachedPasses = getCachedMemberPasses();
  if (Array.isArray(cachedPasses) && cachedPasses.length > 0) {
    state.memberPasses = cachedPasses;
  }
  const cachedCredits = getCachedMemberPassCredits();
  if (Array.isArray(cachedCredits) && cachedCredits.length > 0) {
    state.memberPassCredits = cachedCredits;
  }
  const cachedBookings = getCachedBookings();
  if (Array.isArray(cachedBookings) && cachedBookings.length > 0) {
    state.bookings = cachedBookings;
  }
} catch (_) {}

// Cross-tab real-time session and booking synchronization
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY_CLASS_SESSIONS && e.newValue) {
      try {
        const updated = JSON.parse(e.newValue);
        if (Array.isArray(updated)) {
          state.classSessions = updated;
          events.emit(EVENT.DATA_MUTATED, { source: 'cross_tab_sync_sessions' });
        }
      } catch (_) {}
    }
    if (e.key === STORAGE_KEY_BOOKINGS && e.newValue) {
      try {
        const updated = JSON.parse(e.newValue);
        if (Array.isArray(updated)) {
          state.bookings = updated;
          events.emit(EVENT.DATA_MUTATED, { source: 'cross_tab_sync_bookings' });
        }
      } catch (_) {}
    }
  });
}

/* ================================================================
   SUPABASE LIVE DATA SYNC
   ================================================================ */

/**
 * Asynchronously fetch and hydrate state from live Supabase database tables.
 * @returns {Promise<boolean>}
 */
export async function syncFromSupabase() {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const [
      packages,
      sessions,
      payments,
      disciplines,
      trainers,
      members,
      bookings,
      passes,
      waivers,
      waiverAcceptances,
      healthProfiles,
      partnerOrgs,
      activityLogs
    ] = await Promise.all([
      dbGetPackages().catch(() => null),
      dbGetClassSessions().catch(() => null),
      dbGetPayments().catch(() => null),
      dbGetDisciplines().catch(() => null),
      dbGetTrainers().catch(() => null),
      dbGetMembers().catch(() => null),
      dbGetBookings().catch(() => null),
      dbGetMemberPasses().catch(() => null),
      dbGetWaivers().catch(() => null),
      dbGetWaiverAcceptances().catch(() => null),
      dbGetHealthProfiles().catch(() => null),
      dbGetPartnerOrgs().catch(() => null),
      dbGetActivityLogs().catch(() => null)
    ]);

    if (packages) state.packages = packages;
    if (Array.isArray(sessions)) {
      state.classSessions = sessions;
      saveClassSessionsCache();
    }
    if (payments) {
      const seen = new Set();
      state.payments = payments.filter(p => {
        const key = p.reference ? `ref:${p.reference}` : `id:${p.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    if (disciplines && disciplines.length > 0) state.disciplines = disciplines;
    if (Array.isArray(trainers)) state.trainers = trainers;
    if (members && members.length > 0) {
      state.members = members;
    }
    if (bookings) state.bookings = bookings;
    if (passes) {
      const seenPasses = new Set();
      state.memberPasses = passes.filter(p => {
        if (seenPasses.has(p.id)) return false;
        seenPasses.add(p.id);
        return true;
      });

      // Synchronize pass credits into store state for balance lookups
      const allCredits = [];
      state.memberPasses.forEach(p => {
        if (Array.isArray(p.credits)) {
          p.credits.forEach(c => {
            allCredits.push({
              memberPassId: p.id,
              disciplineId: c.disciplineId,
              sessionsIncluded: c.sessionsIncluded,
              sessionsUsed: c.sessionsUsed,
            });
          });
        }
      });
      state.memberPassCredits = allCredits;
    }
    if (waivers && waivers.length > 0) {
      const remoteIds = new Set(waivers.map(w => w.id));
      const missing = seed.waivers.filter(sw => !remoteIds.has(sw.id));
      state.waivers = [...waivers, ...missing];
    }
    if (waiverAcceptances) state.waiverAcceptances = waiverAcceptances;
    if (healthProfiles) state.healthProfiles = healthProfiles;
    if (partnerOrgs && partnerOrgs.length > 0) state.partnerOrgs = partnerOrgs;
    if (activityLogs) {
      const remoteIds = new Set(activityLogs.map(l => l.id));
      const localOnly = (state.activityLog || []).filter(l => !remoteIds.has(l.id));
      state.activityLog = [
        ...activityLogs.map(l => ({
          id: l.id,
          memberId: l.userId,
          userId: l.userId,
          actor: (l.user && l.user.role) || (l.details && l.details.actor) || 'member',
          action: l.action,
          category: (l.details && l.details.category) || 'general',
          details: l.details || {},
          createdAt: l.createdAt,
          user: l.user
        })),
        ...localOnly
      ];
    }

    events.emit(EVENT.DATA_MUTATED, { source: 'supabase_sync' });
    return true;
  } catch (err) {
    console.error('[Supabase sync error]', err);
    return false;
  }
}

/* ================================================================
   LOOKUPS
   ================================================================ */

/** @returns {Object} Studio info */
export function getStudio() { return state.studio; }

/** @returns {Array} All disciplines */
export function getDisciplines() { return state.disciplines; }

/** @param {string} id @returns {Object|undefined} */
export function getDisciplineById(id) {
  if (!id) return undefined;
  const aliasMap = {
    'disc-001': CONFIG.DISCIPLINES.PILATES,
    'disc-002': CONFIG.DISCIPLINES.BARRE,
    'disc-003': CONFIG.DISCIPLINES.SCULPT_YOGA,
    'pilates': CONFIG.DISCIPLINES.PILATES,
    'barre': CONFIG.DISCIPLINES.BARRE,
    'sculpt': CONFIG.DISCIPLINES.SCULPT_YOGA,
  };
  const resolvedId = aliasMap[id] || id;
  return state.disciplines.find(d => d.id === resolvedId || d.id === id);
}

/** @returns {Array} All trainers */
export function getTrainers() { return state.trainers; }

/** @param {string} id @returns {Object|undefined} */
export function getTrainerById(id) { return state.trainers.find(t => t.id === id); }

/** @returns {Array} All admin users */
export function getAdminUsers() { return state.adminUsers; }

/** @returns {Array} All partner users */
export function getPartnerUsers() { return state.partnerUsers; }

/** @returns {Array} All waivers */
export function getAllWaivers() {
  return state.waivers;
}

/** @param {string} id @returns {Object|undefined} */
export function getWaiverById(id) {
  return state.waivers.find(w => w.id === id || w.version === id);
}

/** @returns {Object|undefined} Current generic waiver */
export function getCurrentWaiver() {
  return state.waivers.find(w => w.id === 'waiver-plash-1.0' || w.type === 'plash') ||
    state.waivers.find(w => w.version === CONFIG.WAIVER_VERSION) ||
    state.waivers[0];
}

/**
 * Checks whether a package contains Barre classes.
 * @param {Object} pkg
 * @returns {boolean}
 */
export function packageHasBarre(pkg) {
  if (!pkg) return false;
  if (pkg.disciplineId === CONFIG.DISCIPLINES.BARRE || pkg.discipline_id === CONFIG.DISCIPLINES.BARRE) return true;
  if (pkg.id && String(pkg.id).toLowerCase().includes('barre')) return true;
  if (pkg.name && String(pkg.name).toLowerCase().includes('barre')) return true;
  if (pkg.disciplines && pkg.disciplines.some(d => d.disciplineId === CONFIG.DISCIPLINES.BARRE || (d.name && d.name.toLowerCase().includes('barre')))) return true;
  if (pkg.sessionAllocations && pkg.sessionAllocations.some(a => a.disciplineId === CONFIG.DISCIPLINES.BARRE || (a.disciplineId && String(a.disciplineId).toLowerCase().includes('barre')))) return true;
  if (pkg.session_allocations && pkg.session_allocations.some(a => a.disciplineId === CONFIG.DISCIPLINES.BARRE || (a.disciplineId && String(a.disciplineId).toLowerCase().includes('barre')))) return true;
  return false;
}

/**
 * Checks whether a package contains Plash classes (Pilates or Sculpt Yoga).
 * @param {Object} pkg
 * @returns {boolean}
 */
export function packageHasPlash(pkg) {
  if (!pkg) return true;
  if (pkg.disciplineId === CONFIG.DISCIPLINES.PILATES || pkg.disciplineId === CONFIG.DISCIPLINES.SCULPT_YOGA) return true;
  if (pkg.discipline_id === CONFIG.DISCIPLINES.PILATES || pkg.discipline_id === CONFIG.DISCIPLINES.SCULPT_YOGA) return true;
  if (pkg.id && (String(pkg.id).toLowerCase().includes('pilates') || String(pkg.id).toLowerCase().includes('yoga'))) return true;
  if (pkg.name && (String(pkg.name).toLowerCase().includes('pilates') || String(pkg.name).toLowerCase().includes('yoga') || String(pkg.name).toLowerCase().includes('plash') || String(pkg.name).toLowerCase().includes('all-access') || String(pkg.name).toLowerCase().includes('signature'))) return true;
  if (pkg.disciplines && pkg.disciplines.some(d => d.disciplineId !== CONFIG.DISCIPLINES.BARRE)) return true;
  if (pkg.sessionAllocations && pkg.sessionAllocations.some(a => a.disciplineId !== CONFIG.DISCIPLINES.BARRE)) return true;
  if (pkg.session_allocations && pkg.session_allocations.some(a => a.disciplineId !== CONFIG.DISCIPLINES.BARRE)) return true;
  return false;
}

/**
 * Resolve dynamic waiver configuration for package in cart.
 * - Barre only -> Physique 57 / AMP Fitness LLP Customer Waiver
 * - Plash only -> Plash Pilates Studio Member Liability Waiver & Privacy Policy
 * - Combined (both) -> Dual Studio Waiver requiring acceptance of both
 * @param {Object} pkg
 * @returns {Object}
 */
export function getWaiverConfigForPackage(pkg) {
  const hasBarre = packageHasBarre(pkg);
  const hasPlash = packageHasPlash(pkg);

  const plashWaiver = state.waivers.find(w => w.id === 'waiver-plash-1.0' || w.type === 'plash') || state.waivers[0] || {
    id: 'waiver-plash-1.0',
    version: '1.0',
    type: 'plash',
    title: 'Plash Pilates Studio Member Liability Waiver & Privacy Policy',
    content: seed.PLASH_PILATES_WAIVER_TEXT
  };

  const barreWaiver = state.waivers.find(w => w.id === 'waiver-p57-1.0' || w.type === 'barre') || state.waivers[1] || {
    id: 'waiver-p57-1.0',
    version: '1.0',
    type: 'barre',
    title: 'Physique 57 / AMP Fitness LLP Customer Waiver & Policies',
    content: seed.PHYSIQUE_57_WAIVER_TEXT
  };

  const combinedWaiver = state.waivers.find(w => w.id === 'waiver-combined-1.0' || w.type === 'combined') || {
    id: 'waiver-combined-1.0',
    version: '1.0',
    type: 'combined',
    title: 'Dual Studio Waiver — Plash Pilates & Physique 57 Barre',
    content: `${plashWaiver.bodyText || plashWaiver.content}\n\n=========================================\n\n${barreWaiver.bodyText || barreWaiver.content}`
  };

  if (hasBarre && hasPlash) {
    return {
      type: 'combined',
      waiverId: combinedWaiver.id,
      title: 'Dual Studio Waiver (Plash Pilates & Physique 57 Barre)',
      linkText: 'Dual Studio Waiver (Plash & Physique 57 Barre)',
      waiver: combinedWaiver,
      subWaivers: [
        {
          key: 'plash',
          tabTitle: 'Plash Pilates Studio',
          title: plashWaiver.title,
          version: plashWaiver.version,
          content: plashWaiver.bodyText || plashWaiver.content
        },
        {
          key: 'barre',
          tabTitle: 'Physique 57 Barre',
          title: barreWaiver.title,
          version: barreWaiver.version,
          content: barreWaiver.bodyText || barreWaiver.content
        }
      ]
    };
  }

  if (hasBarre) {
    return {
      type: 'barre',
      waiverId: barreWaiver.id,
      title: barreWaiver.title,
      linkText: `Physique 57 Customer Waiver & Policies (v${barreWaiver.version})`,
      waiver: barreWaiver,
      subWaivers: [
        {
          key: 'barre',
          tabTitle: 'Physique 57 Barre',
          title: barreWaiver.title,
          version: barreWaiver.version,
          content: barreWaiver.bodyText || barreWaiver.content
        }
      ]
    };
  }

  return {
    type: 'plash',
    waiverId: plashWaiver.id,
    title: plashWaiver.title,
    linkText: `Liability Waiver & Privacy Policy (v${plashWaiver.version})`,
    waiver: plashWaiver,
    subWaivers: [
      {
        key: 'plash',
        tabTitle: 'Plash Pilates Studio',
        title: plashWaiver.title,
        version: plashWaiver.version,
        content: plashWaiver.bodyText || plashWaiver.content
      }
    ]
  };
}

/* ================================================================
   PRICING
   ================================================================ */

export function isFirstCircleActive() {
  return false;
}

const DEPRECATED_PACKAGE_IDS = new Set([
  'pkg-001', 'pkg-002', 'pkg-003', 'pkg-004', 'pkg-005', 'pkg-006',
  'pkg-asd-001', 'pkg-1789702801884', 'pkg-1789703192217'
]);

/** @returns {Array} All packages with clear pricing */
export function getPackageCatalog() {
  return state.packages
    .filter(pkg => !DEPRECATED_PACKAGE_IDS.has(pkg.id) && pkg.id !== 'pkg-archived')
    .map(pkg => ({
      ...pkg,
      effectivePrice: pkg.priceInr,
      isFirstCircle: false,
    }));
}

/**
 * Fetch and sync live packages from Supabase into store.
 * @returns {Promise<Array>}
 */
export async function fetchPackages() {
  if (!isSupabaseConfigured()) return getPackageCatalog();
  try {
    const remote = await dbGetPackages();
    if (remote && Array.isArray(remote)) {
      state.packages = remote;
      return getPackageCatalog();
    }
  } catch (err) {
    console.warn('[store.fetchPackages error]', err.message);
  }
  return getPackageCatalog();
}

/** @returns {Array} All packages */
export function getPackages() {
  return state.packages;
}

/** @param {string} id @returns {Object|undefined} */
export function getPackageById(id) {
  return state.packages.find(p => p.id === id);
}

/* ================================================================
   LOOKUPS & MEMBER MATCHING
   ================================================================ */

/**
 * Check if two member IDs match, accounting for legacy 'member-001' vs Supabase UUID.
 * @param {string} idA
 * @param {string} idB
 * @returns {boolean}
 */
export function isMemberIdMatch(idA, idB) {
  if (idA === idB) return true;
  if (!idA || !idB) return false;
  if (String(idA).toLowerCase() === String(idB).toLowerCase()) return true;
  // Fallback: check if both IDs resolve to the same member email in state
  const mA = state.members.find(m => String(m.id).toLowerCase() === String(idA).toLowerCase());
  const mB = state.members.find(m => String(m.id).toLowerCase() === String(idB).toLowerCase());
  if (mA && mB && mA.email && mB.email) {
    return mA.email.toLowerCase() === mB.email.toLowerCase();
  }
  return false;
}

/** @returns {Array} All members */
export function getAllMembers() { return state.members; }

/**
 * Get registered users who have logged in or signed up but do NOT hold an active membership pass.
 * @param {Object} [options]
 * @param {boolean} [options.onlyNeverSubscribed=false] - If true, only return users with zero pass history
 * @returns {Array<Object>}
 */
export function getNonMemberProspects(options = {}) {
  const allMembers = state.members.filter(m => (m.role || '').toLowerCase() === 'member');
  
  return allMembers.filter(m => {
    // Exclude users with active passes
    const activePass = getActiveMemberPass(m.id);
    if (activePass) return false;

    // If onlyNeverSubscribed is set, exclude users with past expired passes
    if (options.onlyNeverSubscribed) {
      const pastPasses = getMemberPasses(m.id);
      if (pastPasses && pastPasses.length > 0) return false;
    }

    return true;
  }).map(m => {
    const health = getHealthProfile(m.id) || {};
    const waiver = getWaiverAcceptance(m.id);
    const passes = getMemberPasses(m.id) || [];
    const bookings = getBookingsForMember(m.id) || [];
    const displayName = resolveMemberDisplayName(m.id);
    const hasPastPass = passes.length > 0;

    return {
      id: m.id,
      name: displayName,
      fullName: displayName,
      email: m.email || '',
      phone: m.phone || 'N/A',
      emergencyContact: health.emergencyContact || m.emergencyContact || 'None provided',
      movementLevel: health.movementLevel || m.movementLevel || 'Not specified',
      fitnessGoals: health.fitnessGoals || [],
      healthInjuries: !!(health.injuries || (health.healthConditions && health.healthConditions.length > 0)),
      health,
      waiver,
      hasWaiver: !!waiver,
      hasPastPass,
      status: hasPastPass ? 'expired_member' : 'registered_prospect',
      statusLabel: hasPastPass ? 'Lapsed Member' : 'New Prospect',
      bookingsCount: bookings.length,
      createdAt: m.createdAt || m.joinedAt || null,
      raw: m
    };
  });
}

/** @param {string} id @returns {Object|undefined} */
export function getMemberById(id) {
  if (!id) return null;
  const targetId = String(id).toLowerCase();
  const direct = state.members.find(m => m.id && String(m.id).toLowerCase() === targetId);
  if (direct) return direct;

  // Fallback to partner reviews if available
  if (Array.isArray(state.partnerReviews)) {
    const rev = state.partnerReviews.find(r => r.memberId && String(r.memberId).toLowerCase() === targetId);
    if (rev) {
      return {
        id: rev.memberId,
        fullName: rev.memberName || 'Studio Member',
        name: rev.memberName || 'Studio Member',
        email: rev.memberEmail || '',
        phone: rev.memberPhone || '',
        tier: 'First Circle'
      };
    }
  }

  // Fallback to bookings with embedded member details
  if (Array.isArray(state.bookings)) {
    const bk = state.bookings.find(b => (b.memberId || b.member_id) && String(b.memberId || b.member_id).toLowerCase() === targetId && (b.memberName || b.member_name || b.member));
    if (bk) {
      const bkm = bk.member || {};
      const name = bk.memberName || bk.member_name || bkm.fullName || bkm.full_name || bkm.name || 'Studio Member';
      return {
        id: bk.memberId || bk.member_id,
        fullName: name,
        name: name,
        email: bk.memberEmail || bk.member_email || bkm.email || '',
        phone: bk.memberPhone || bk.member_phone || bkm.phone || '',
        tier: 'First Circle'
      };
    }
  }

  return null;
}

/**
 * Resolve member identity object from an ID, booking, payment, or pass object.
 * Returns member record with fullName, email, phone, tier.
 * @param {string|Object} memberRef
 * @returns {Object|null}
 */
export function resolveMember(memberRef) {
  if (!memberRef) return null;
  if (typeof memberRef === 'object') {
    const name = memberRef.fullName || memberRef.full_name || memberRef.name || memberRef.memberName || memberRef.member_name;
    if (name) {
      return {
        id: memberRef.id || memberRef.memberId || memberRef.member_id,
        fullName: name,
        name: name,
        email: memberRef.email || memberRef.memberEmail || memberRef.member_email || '',
        phone: memberRef.phone || memberRef.memberPhone || memberRef.member_phone || '',
        tier: memberRef.tier || 'First Circle'
      };
    }
    if (memberRef.memberId || memberRef.id) {
      return resolveMember(memberRef.memberId || memberRef.id);
    }
  }
  return getMemberById(memberRef);
}

/**
 * Resolve human-facing member display name.
 * 1. profiles.full_name
 * 2. If full_name unavailable: email
 * 3. If both unavailable: "Unknown member"
 * Never returns a bare UUID as primary identity.
 * @param {string|Object} memberRef
 * @param {string} [fallback='Unknown member']
 * @returns {string}
 */
export function resolveMemberDisplayName(memberRef, fallback = 'Unknown member') {
  const member = resolveMember(memberRef);
  if (member) {
    const name = member.fullName || member.full_name || member.name;
    if (name && typeof name === 'string' && name.trim()) return name.trim();
    if (member.email && typeof member.email === 'string' && member.email.trim()) return member.email.trim();
  }
  if (typeof memberRef === 'object' && memberRef !== null) {
    const name = memberRef.fullName || memberRef.full_name || memberRef.name;
    if (name && typeof name === 'string' && name.trim()) return name.trim();
    if (memberRef.email && typeof memberRef.email === 'string' && memberRef.email.trim()) return memberRef.email.trim();
  }
  return fallback;
}

/** @param {string} memberId @returns {Object|undefined} */
export function getHealthProfile(memberId) {
  return state.healthProfiles.find(h => isMemberIdMatch(h.memberId, memberId));
}

/** @param {string} memberId @returns {Object|undefined} */
export function getWaiverAcceptance(memberId) {
  return state.waiverAcceptances.find(w => isMemberIdMatch(w.memberId, memberId));
}

/** @param {string} memberId @param {Object} data */
export async function updateMemberProfile(memberId, data) {
  let member = getMemberById(memberId);
  if (!member) {
    member = { id: memberId, fullName: 'Studio Member', ...data };
    state.members.push(member);
  } else {
    Object.assign(member, data);
  }

  if (isSupabaseConfigured()) {
    try {
      const updated = await dbUpdateMemberProfile(memberId, data);
      if (updated) {
        if (updated.full_name) {
          member.fullName = updated.full_name;
          member.name = updated.full_name;
        }
        if (updated.phone !== undefined) member.phone = updated.phone;
        if (updated.updated_at) member.updatedAt = updated.updated_at;
      }
    } catch (err) {
      console.warn('[store.updateMemberProfile remote warn]', err);
    }
  }

  logActivity(memberId, 'member', 'Updated personal profile', 'profile');
  events.emit(EVENT.PROFILE_UPDATED, { memberId });
  events.emit(EVENT.DATA_MUTATED, { source: 'profile_updated', memberId });
  return member;
}

/** @param {string} memberId @param {Object} data */
export async function updateHealthProfile(memberId, data) {
  let profile = getHealthProfile(memberId);
  if (!profile) {
    profile = { memberId, fitnessGoals: [], healthConditions: [], injuriesNotes: '', updatedAt: new Date().toISOString() };
    state.healthProfiles.push(profile);
  }

  // Optimistically update local profile state
  Object.assign(profile, data, { updatedAt: new Date().toISOString() });

  if (isSupabaseConfigured()) {
    try {
      const updated = await dbUpdateHealthProfile(memberId, data);
      if (updated) {
        if (updated.notes) profile.notes = updated.notes;
        if (updated.injuries) profile.injuries = updated.injuries;
        if (updated.medical_conditions) profile.healthConditions = updated.medical_conditions;
        if (updated.emergency_contact_name) profile.emergencyContactName = updated.emergency_contact_name;
        if (updated.emergency_contact_phone) profile.emergencyContactPhone = updated.emergency_contact_phone;
        profile.updatedAt = updated.updated_at;
      }
    } catch (err) {
      console.warn('[store.updateHealthProfile remote warn]', err);
    }
  }

  logActivity(memberId, 'member', 'Updated health profile', 'profile');
  events.emit(EVENT.PROFILE_UPDATED, { memberId });
  events.emit(EVENT.DATA_MUTATED, { source: 'health_profile_updated', memberId });
  return profile;
}

/**
 * Add a new member (admin).
 * @param {Object} data
 * @returns {Object}
 */
export function addMember(data) {
  if (!data.fullName || !data.email) throw new Error('Full name and email are required');
  const cleanEmail = data.email.trim().toLowerCase();
  const existing = state.members.find(m => (m.email || '').toLowerCase() === cleanEmail || (data.id && m.id === data.id));
  if (existing) {
    if (data.fullName) {
      existing.fullName = data.fullName.trim();
      existing.name = data.fullName.trim();
    }
    if (data.phone) existing.phone = data.phone;
    saveLocalRegisteredMember(existing);
    return existing;
  }
  const member = {
    id: data.id || genId('member'),
    fullName: data.fullName.trim(),
    name: data.fullName.trim(),
    email: cleanEmail,
    phone: data.phone || '',
    emergencyContact: data.emergencyContact || '',
    tier: data.tier || 'Founding Standard',
    role: 'member',
    status: 'active',
    createdAt: new Date().toISOString(),
    joinedAt: new Date().toISOString(),
    ...data
  };
  state.members.push(member);
  saveLocalRegisteredMember(member);

  state.healthProfiles.push({
    memberId: member.id,
    fitnessGoals: [],
    healthConditions: [],
    injuriesNotes: '',
    updatedAt: new Date().toISOString()
  });
  logActivity(member.id, 'admin', 'Registered new member account', 'account');
  events.emit(EVENT.PROFILE_UPDATED, { memberId: member.id });
  return member;
}


/* ================================================================
   MEMBER PASSES & CREDITS
   ================================================================ */

/**
 * Enrich a pass with its package details.
 * @param {Object} p
 * @returns {Object}
 */
function enrichPass(p) {
  if (!p) return p;
  const pkg = state.packages.find(pkg => pkg.id === p.packageId);
  const member = (p.member && (p.member.fullName || p.member.full_name)) ? p.member : getMemberById(p.memberId);
  return {
    ...p,
    packageName: p.packageName || p.package?.name || pkg?.name || 'Studio Membership',
    package: p.package || pkg || null,
    member: member || null
  };
}

/**
 * Get all member passes across all members (admin).
 * @returns {Array}
 */
export function getAllMemberPasses() {
  return state.memberPasses.map(enrichPass);
}

/**
 * Get all health profiles enriched with member details (admin).
 * @returns {Array}
 */
export function getAllHealthProfiles() {
  return state.healthProfiles.map(h => {
    const member = resolveMember(h.memberId);
    return {
      ...h,
      member: member || null,
      memberName: resolveMemberDisplayName(h.memberId)
    };
  });
}

/**
 * Get all waiver acceptances enriched with member details (admin).
 * @returns {Array}
 */
export function getAllWaiverAcceptances() {
  return state.waiverAcceptances.map(w => ({
    ...w,
    member: w.member || getMemberById(w.memberId) || null
  }));
}

/**
 * Get all passes for a specific member.
 * @param {string} memberId
 * @returns {Array}
 */
export function getMemberPasses(memberId) {
  const targetMember = resolveMember(memberId);
  let targetEmail = (targetMember?.email || '').toLowerCase();
  if (!targetEmail) {
    try {
      const raw = typeof localStorage !== 'undefined' ? (localStorage.getItem('plash_auth_session_v1') || localStorage.getItem('plash_session')) : null;
      if (raw) targetEmail = (JSON.parse(raw)?.currentUserEmail || '').toLowerCase();
    } catch (_) {}
  }
  return state.memberPasses.filter(p => {
    return isMemberIdMatch(p.memberId, memberId) || (targetEmail && (p.member?.email || '').toLowerCase() === targetEmail);
  }).map(enrichPass);
}

/**
 * Get the active pass for a member (first active one).
 * @param {string} memberId
 * @returns {Object|undefined}
 */
export function getActiveMemberPass(memberId, disciplineId = null) {
  const passes = getMemberPasses(memberId);
  const now = new Date();
  const aliasMap = {
    'disc-001': CONFIG.DISCIPLINES.PILATES,
    'disc-002': CONFIG.DISCIPLINES.BARRE,
    'disc-003': CONFIG.DISCIPLINES.SCULPT_YOGA
  };
  const normDisciplineId = disciplineId ? (aliasMap[disciplineId] || disciplineId) : null;

  const validPasses = passes.filter(p => {
    if (p.status !== 'active') return false;
    if (p.expiresAt && new Date(p.expiresAt) < now) {
      p.status = 'expired';
      return false;
    }
    return true;
  });

  if (normDisciplineId) {
    const passWithCredits = validPasses.find(p => {
      const credits = getPassCredits(p.id);
      const c = credits.find(cr => cr.disciplineId === normDisciplineId || cr.disciplineId === disciplineId);
      return c && (c.sessionsIncluded - c.sessionsUsed) > 0;
    });
    if (passWithCredits) return enrichPass(passWithCredits);
  }

  const pass = validPasses[0];
  return pass ? enrichPass(pass) : undefined;
}

/**
 * Get credits for a given pass.
 * @param {string} memberPassId
 * @returns {Array}
 */
export function getPassCredits(memberPassId) {
  const credits = state.memberPassCredits.filter(c => c.memberPassId === memberPassId);
  if (credits.length > 0) return credits;
  const pass = state.memberPasses.find(p => p.id === memberPassId);
  if (pass && Array.isArray(pass.credits) && pass.credits.length > 0) {
    return pass.credits.map(c => ({
      memberPassId,
      disciplineId: c.disciplineId || c.discipline_id,
      sessionsIncluded: c.sessionsIncluded !== undefined ? c.sessionsIncluded : (c.total_credits || 0),
      sessionsUsed: c.sessionsUsed !== undefined ? c.sessionsUsed : ((c.total_credits || 0) - (c.remaining_credits || 0))
    }));
  }
  return [];
}

/**
 * Get remaining credits for a member in a specific discipline across active passes.
 * @param {string} memberId
 * @param {string} disciplineId
 * @returns {number}
 */
export function getRemainingCredits(memberId, disciplineId) {
  const activePasses = getMemberPasses(memberId).filter(p => {
    if (p.status !== 'active') return false;
    if (p.expiresAt && new Date(p.expiresAt) < new Date()) return false;
    return true;
  });
  let totalRemaining = 0;
  const aliasMap = {
    'disc-001': CONFIG.DISCIPLINES.PILATES,
    'disc-002': CONFIG.DISCIPLINES.BARRE,
    'disc-003': CONFIG.DISCIPLINES.SCULPT_YOGA
  };
  const normDisciplineId = aliasMap[disciplineId] || disciplineId;
  for (const pass of activePasses) {
    const credits = getPassCredits(pass.id);
    const credit = credits.find(c => c.disciplineId === disciplineId || c.disciplineId === normDisciplineId);
    if (credit) {
      totalRemaining += (credit.sessionsIncluded - credit.sessionsUsed);
    }
  }
  return totalRemaining;
}

/**
 * Get all credits for a member across active passes, organized by discipline.
 * @param {string} memberId
 * @returns {Array<{discipline: Object, included: number, used: number, remaining: number}>}
 */
export function getMemberCredits(memberId) {
  const activePasses = getMemberPasses(memberId).filter(p => {
    if (p.status !== 'active') return false;
    if (p.expiresAt && new Date(p.expiresAt) < new Date()) return false;
    return true;
  });
  if (activePasses.length === 0) return [];

  const discMap = new Map();
  for (const pass of activePasses) {
    const credits = getPassCredits(pass.id);
    for (const c of credits) {
      const disc = getDisciplineById(c.disciplineId);
      if (!disc) continue;
      if (!discMap.has(c.disciplineId)) {
        discMap.set(c.disciplineId, {
          discipline: disc,
          included: 0,
          used: 0,
          remaining: 0
        });
      }
      const entry = discMap.get(c.disciplineId);
      const inc = Number(c.sessionsIncluded || 0);
      const used = Number(c.sessionsUsed || 0);
      entry.included += inc;
      entry.used += used;
      entry.remaining += (inc - used);
    }
  }
  return Array.from(discMap.values());
}

/* ================================================================
   CLASS SESSIONS
   ================================================================ */

/** @returns {Array} All class sessions */
export function getAllClassSessions() { return state.classSessions; }

/** @param {string} id @returns {Object|undefined} */
export function getClassSessionById(id) {
  return state.classSessions.find(s => s.id === id || s.clientSessionId === id);
}

/**
 * Get upcoming sessions, optionally filtered.
 * @param {Object} [filters]
 * @param {string} [filters.disciplineId]
 * @param {string} [filters.date] - ISO date string (YYYY-MM-DD)
 * @returns {Array}
 */
export function getUpcomingClassSessions(filters = {}) {
  const now = new Date();
  return state.classSessions.filter(s => {
    if (new Date(s.startsAt) <= now) return false;
    if (filters.disciplineId && s.disciplineId !== filters.disciplineId) return false;
    if (filters.date) {
      const sDate = new Date(s.startsAt).toISOString().slice(0, 10);
      if (sDate !== filters.date) return false;
    }
    return true;
  }).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
}

/**
 * Add a new class session (admin).
 * @param {Object} data
 * @returns {Object} Created session
 */
export function addClassSession(data) {
  let date = data.date;
  let time = data.time;
  let startsAt = data.startsAt;
  if (startsAt && (!date || !time)) {
    const ist = getISTDateParts(startsAt);
    date = date || ist.date;
    time = time || ist.time;
  } else if (date && time && !startsAt) {
    startsAt = parseClassDateTimeToUTC(date, time);
  } else if (!startsAt) {
    date = date || toISODate(new Date());
    time = time || '09:00';
    startsAt = parseClassDateTimeToUTC(date, time);
  }
  const durationMinutes = parseInt(data.durationMinutes || data.durationMin, 10) || 60;
  const capacity = Math.min(6, parseInt(data.capacity, 10) || CONFIG.CAPACITY_PER_CLASS);

  // De-duplication guard: if session at same date/time/discipline exists, update it instead of creating duplicate
  const existing = state.classSessions.find(
    s => s.date === date && s.time === time && s.disciplineId === data.disciplineId
  );
  if (existing) {
    Object.assign(existing, data, { capacity, durationMinutes, startsAt, date, time });
    saveClassSessionsCache();
    events.emit(EVENT.DATA_MUTATED, { source: 'update_session', session: existing });
    existing._promise = dbUpdateClassSession(existing.id, existing).catch(() => {});
    return existing;
  }

  const localId = data.id || genId('session');
  const session = {
    id: localId,
    clientSessionId: localId,
    ...data,
    date,
    time,
    startsAt,
    durationMinutes,
    capacity,
    spotsRemaining: capacity,
    spotsLeft: capacity,
    bookedCount: 0,
    status: data.status || 'scheduled'
  };

  state.classSessions.push(session);
  saveClassSessionsCache();
  events.emit(EVENT.DATA_MUTATED, { source: 'add_session', session });

  session._promise = dbCreateClassSession(session).then(remote => {
    if (remote && remote.id) {
      session.id = remote.id;
      saveClassSessionsCache();
      events.emit(EVENT.DATA_MUTATED, { source: 'session_persisted', session });
    }
    return remote;
  }).catch(err => {
    console.warn('[Supabase addClassSession warning]', err);
    return null;
  });

  return session;
}

/**
 * Update a class session (admin).
 * @param {string} sessionId
 * @param {Object} data
 * @returns {{session: Object, warning: string|null, _promise: Promise}}
 */
export function updateClassSession(sessionId, data) {
  const session = getClassSessionById(sessionId);
  if (!session) throw new Error('Class session not found');
  const currentBookings = state.bookings.filter(
    b => b.classSessionId === sessionId && ['upcoming', 'pending_partner_approval'].includes(b.status)
  ).length;
  let warning = null;
  if (data.capacity && data.capacity < currentBookings) {
    warning = `Reducing capacity to ${data.capacity} would orphan ${currentBookings - data.capacity} existing booking(s).`;
  }

  if (data.capacity) {
    const diff = data.capacity - session.capacity;
    session.spotsRemaining = Math.max(0, session.spotsRemaining + diff);
    session.capacity = data.capacity;
  }
  Object.assign(session, data);
  if (data.date && data.time) {
    session.startsAt = parseClassDateTimeToUTC(data.date, data.time);
  }

  saveClassSessionsCache();
  events.emit(EVENT.DATA_MUTATED, { source: 'update_session', session });

  const promise = dbUpdateClassSession(sessionId, data).catch(err => {
    console.warn('[Supabase updateClassSession warning]', err);
  });

  return { session, warning, _promise: promise };
}

/**
 * Delete / cancel a class session (admin).
 * Refunds credits for all affected bookings.
 * @param {string} sessionId
 * @returns {Object} Removed session
 */
export async function deleteClassSession(sessionId) {
  const index = state.classSessions.findIndex(s => s.id === sessionId);
  if (index === -1) throw new Error('Class session not found');
  const session = state.classSessions[index];
  
  // Refund any upcoming or pending bookings
  const affected = state.bookings.filter(
    b => (b.classSessionId === sessionId || b.sessionId === sessionId) &&
         ['upcoming', 'pending_partner_approval'].includes(b.status)
  );
  
  affected.forEach(b => {
    b.status = 'cancelled';
    b.decidedAt = new Date().toISOString();
    b.decidedBy = 'admin';
    const pass = getActiveMemberPass(b.memberId);
    if (pass) {
      const credit = state.memberPassCredits.find(
        c => (c.memberPassId === pass.id || c.passId === pass.id || c.pass_id === pass.id) &&
             (c.disciplineId === session.disciplineId || c.discipline_id === session.disciplineId)
      );
      if (credit && credit.sessionsUsed > 0) credit.sessionsUsed -= 1;
    }
    logActivity(b.memberId, 'admin', 'Class session cancelled by admin; spot refunded', 'booking');
  });

  const [removed] = state.classSessions.splice(index, 1);
  saveClassSessionsCache();
  events.emit(EVENT.DATA_MUTATED, { source: 'delete_session', sessionId });

  await dbDeleteClassSession(sessionId).catch(err => {
    console.warn('[Supabase deleteClassSession warning]', err);
  });

  return removed;
}

/**
 * Authoritative Supabase & Server query to sync live class sessions.
 * Accurately reflects published database sessions.
 * @returns {Promise<Array>}
 */
export async function syncClassSessions() {
  try {
    const remote = await dbGetClassSessions();
    if (Array.isArray(remote)) {
      const remoteIds = new Set(remote.map(r => r.id));
      const pendingLocal = state.classSessions.filter(s => s && s.id && !remoteIds.has(s.id));
      state.classSessions = [...remote, ...pendingLocal];
      saveClassSessionsCache();
      events.emit(EVENT.DATA_MUTATED, { source: 'sync_class_sessions' });
    }
  } catch (err) {
    console.warn('[store.syncClassSessions error]', err);
  }
  return state.classSessions;
}

/* ================================================================
   RECURRING TIMETABLE RULES & BATCH SCHEDULER
   ================================================================ */

/** @returns {Array} All recurring schedule rules */
export function getRecurringRules() {
  return state.recurringRules;
}

/** @param {string} id @returns {Object|undefined} */
export function getRecurringRuleById(id) {
  return state.recurringRules.find(r => r.id === id);
}

export function saveRecurringRulesCache() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('plash_recurring_rules_v1', JSON.stringify(state.recurringRules));
    }
  } catch (_) {}
}

/**
 * Add a new recurring timetable rule (admin).
 * @param {Object} data
 * @returns {Object} Created rule
 */
export function addRecurringRule(data) {
  const rule = {
    id: genId('rule'),
    title: data.title || 'Weekly Studio Class',
    daysOfWeek: Array.isArray(data.daysOfWeek) ? data.daysOfWeek : [data.dayOfWeek || 'monday'],
    time: data.time || '09:00',
    disciplineId: data.disciplineId,
    trainerId: data.trainerId,
    capacity: Math.min(6, parseInt(data.capacity, 10) || 6),
    durationMinutes: parseInt(data.durationMinutes, 10) || 60,
    active: true,
    createdAt: new Date().toISOString()
  };
  state.recurringRules.push(rule);
  saveRecurringRulesCache();
  // Automatically generate matching calendar sessions so rule reflects in weekly timetable matrix immediately!
  generateSessionsFromRules(4);
  events.emit(EVENT.DATA_MUTATED, { source: 'add_recurring_rule', rule });
  return rule;
}

/**
 * Update an existing recurring rule.
 * @param {string} id
 * @param {Object} data
 * @returns {Object} Updated rule
 */
export function updateRecurringRule(id, data) {
  const rule = getRecurringRuleById(id);
  if (!rule) throw new Error('Recurring rule not found');
  Object.assign(rule, data);
  if (rule.capacity) rule.capacity = Math.min(6, parseInt(rule.capacity, 10));
  saveRecurringRulesCache();
  // Auto-generate matching calendar sessions so rule updates reflect in weekly timetable matrix immediately!
  generateSessionsFromRules(4);
  events.emit(EVENT.DATA_MUTATED, { source: 'update_recurring_rule', rule });
  return rule;
}

/**
 * Delete a recurring rule.
 * @param {string} id
 * @returns {Object} Deleted rule
 */
export function deleteRecurringRule(id) {
  const idx = state.recurringRules.findIndex(r => r.id === id);
  if (idx === -1) throw new Error('Recurring rule not found');
  const [removed] = state.recurringRules.splice(idx, 1);
  saveRecurringRulesCache();

  // Cleanly prune future unbooked sessions that were generated from this rule
  const now = new Date();
  const bookedSessionIds = new Set(state.bookings.map(b => b.classSessionId || b.sessionId));
  state.classSessions = state.classSessions.filter(s => {
    if (s.recurringRuleId === id) {
      const sDate = new Date(`${s.date}T${s.time}`);
      if (sDate > now && !bookedSessionIds.has(s.id)) {
        return false;
      }
    }
    return true;
  });
  saveClassSessionsCache();
  events.emit(EVENT.DATA_MUTATED, { source: 'delete_recurring_rule', id });
  return removed;
}

/**
 * Batch generate concrete calendar sessions from active recurring rules.
 * @param {number} [weeksAhead=4] - Number of weeks ahead to generate
 * @returns {Array} List of newly created class session objects
 */
export function generateSessionsFromRules(weeksAhead = 4) {
  const DAY_MAP = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  };

  const createdSessions = [];
  const today = new Date();
  const daysToGenerate = weeksAhead * 7;

  state.recurringRules.filter(r => r.active).forEach(rule => {
    (rule.daysOfWeek || []).forEach(dayName => {
      const targetDay = DAY_MAP[dayName.toLowerCase()];
      if (targetDay === undefined) return;

      for (let i = 0; i <= daysToGenerate; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        if (d.getDay() === targetDay) {
          const dateStr = toISODate(d);
          // Check if session already exists for this date, time and discipline
          const exists = state.classSessions.some(
            s => s.date === dateStr && s.time === rule.time && (s.disciplineId === rule.disciplineId || s.discipline_id === rule.disciplineId)
          );
          if (!exists) {
            const startsAt = `${dateStr}T${rule.time}:00+05:30`;
            const durationMin = rule.durationMinutes || 60;
            const endTime = new Date(new Date(startsAt).getTime() + durationMin * 60000).toISOString();
            const cap = Math.min(6, parseInt(rule.capacity, 10) || 6);
            const session = {
              id: genId('session'),
              title: rule.title || 'Studio Session',
              disciplineId: rule.disciplineId,
              discipline_id: rule.disciplineId,
              trainerId: rule.trainerId,
              trainer_id: rule.trainerId,
              date: dateStr,
              time: rule.time,
              startsAt,
              start_time: startsAt,
              endTime,
              end_time: endTime,
              durationMinutes: durationMin,
              capacity: cap,
              spotsRemaining: cap,
              spotsLeft: cap,
              status: 'scheduled',
              recurringRuleId: rule.id
            };
            state.classSessions.push(session);
            createdSessions.push(session);
          }
        }
      }
    });
  });

  if (createdSessions.length > 0) {
    saveClassSessionsCache();
    events.emit(EVENT.DATA_MUTATED, { source: 'batch_generate_sessions', count: createdSessions.length });
    const batchPromise = (async () => {
      try {
        const baseUrl = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3333';
        await fetch(`${baseUrl}/api/admin/class-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'batch_create', session: createdSessions })
        });
      } catch (e) {
        console.warn('[generateSessionsFromRules sync warning]', e);
      }
    })();
    createdSessions._promise = batchPromise;
  }

  return createdSessions;
}

/**
 * Clone an existing class session to another date or time.
 * @param {string} sessionId
 * @param {string} targetDate - YYYY-MM-DD
 * @param {string} targetTime - HH:MM
 * @returns {Object} Newly cloned session
 */
export function cloneClassSession(sessionId, targetDate, targetTime) {
  const session = getClassSessionById(sessionId);
  if (!session) throw new Error('Source session not found');
  const date = targetDate || session.date;
  const time = targetTime || session.time;
  const startsAt = new Date(`${date}T${time}`).toISOString();

  const cloned = {
    id: genId('session'),
    disciplineId: session.disciplineId,
    trainerId: session.trainerId,
    date,
    time,
    startsAt,
    durationMinutes: session.durationMinutes || 60,
    capacity: session.capacity || 6,
    spotsRemaining: session.capacity || 6,
  };
  state.classSessions.push(cloned);
  saveClassSessionsCache();
  events.emit(EVENT.DATA_MUTATED, { source: 'clone_session', session: cloned });
  dbCreateClassSession(cloned).catch(() => {});
  return cloned;
}

/* ================================================================
   BOOKINGS
   ================================================================ */

export function getSessionStartTime(session) {
  if (!session) return null;
  const rawStart = session.startsAt || session.start_time || session.startTime;
  if (rawStart) {
    const d = new Date(rawStart);
    if (!isNaN(d.getTime())) return d;
  }
  if (session.date && session.time) {
    const d = new Date(`${session.date}T${session.time}:00`);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export function isSessionPast(session) {
  const start = getSessionStartTime(session);
  if (!start) return false;
  return start.getTime() <= Date.now();
}

/**
 * Book a class for a member.
 * @param {string} memberId
 * @param {string} sessionId
 * @returns {{booking: Object}|{error: string}}
 */
export async function bookClass(memberId, sessionId) {
  const session = getClassSessionById(sessionId);
  if (!session) throw new Error('Session not found.');
  if (isSessionPast(session)) {
    throw new Error('This session has already taken place and cannot be booked.');
  }
  if (session.spotsRemaining <= 0) throw new Error('This class is full.');

  const remaining = getRemainingCredits(memberId, session.disciplineId);
  if (remaining <= 0) {
    const disc = getDisciplineById(session.disciplineId);
    throw new Error(`No remaining ${disc?.name || ''} credits. Purchase a package to continue booking.`);
  }

  // Check for duplicate booking
  const existing = state.bookings.find(
    b => isMemberIdMatch(b.memberId, memberId) && (b.classSessionId === sessionId || b.sessionId === sessionId) && !['cancelled'].includes(b.status)
  );
  if (existing) throw new Error('You already have a booking for this class.');

  // Direct class booking: all classes booked directly by members
  const status = 'upcoming';

  const pass = getActiveMemberPass(memberId, session.disciplineId);
  const passId = pass ? pass.id : null;

  let createdBooking = null;
  // Wait for database confirmation before mutating local state
  if (isSupabaseConfigured()) {
    createdBooking = await dbCreateBooking({
      memberId,
      sessionId,
      passId,
      disciplineId: session.disciplineId
    });
  }

  // Decrement spot and credit
  session.spotsRemaining -= 1;
  const aliasMap = {
    'disc-001': CONFIG.DISCIPLINES.PILATES,
    'disc-002': CONFIG.DISCIPLINES.BARRE,
    'disc-003': CONFIG.DISCIPLINES.SCULPT_YOGA
  };
  const normDisciplineId = aliasMap[session.disciplineId] || session.disciplineId;
  const credit = state.memberPassCredits.find(
    c => (c.memberPassId === passId || c.passId === passId || c.pass_id === passId) &&
         (c.disciplineId === session.disciplineId || c.disciplineId === normDisciplineId || c.discipline_id === session.disciplineId || c.discipline_id === normDisciplineId)
  );
  if (credit) {
    credit.sessionsUsed = (credit.sessionsUsed || 0) + 1;
    if (credit.remainingCredits !== undefined) {
      credit.remainingCredits = Math.max(0, credit.remainingCredits - 1);
    }
  }
  const passInState = state.memberPasses.find(p => p.id === passId);
  if (passInState && Array.isArray(passInState.credits)) {
    const pc = passInState.credits.find(
      c => c.disciplineId === session.disciplineId || c.disciplineId === normDisciplineId || c.discipline_id === session.disciplineId || c.discipline_id === normDisciplineId
    );
    if (pc) {
      if (pc.remaining_credits !== undefined) pc.remaining_credits = Math.max(0, pc.remaining_credits - 1);
      if (pc.remainingCredits !== undefined) pc.remainingCredits = Math.max(0, pc.remainingCredits - 1);
      pc.sessionsUsed = (pc.sessionsUsed || 0) + 1;
    }
  }

  const bookingId = createdBooking?.id || genId('booking');
  const booking = {
    id: bookingId,
    memberId,
    sessionId,
    classSessionId: sessionId,
    passId,
    status,
    bookedAt: createdBooking?.booked_at || createdBooking?.bookedAt || new Date().toISOString(),
    decidedAt: null,
    decidedBy: null,
    session: session ? { ...session } : null
  };
  const existingIdx = state.bookings.findIndex(
    b => b.id === booking.id || (isMemberIdMatch(b.memberId, memberId) && (b.classSessionId === sessionId || b.sessionId === sessionId) && b.status !== 'cancelled')
  );
  if (existingIdx >= 0) {
    state.bookings[existingIdx] = booking;
  } else {
    state.bookings.push(booking);
  }
  saveBookingsCache();
  saveMemberPassesCache();

  // Log activity
  const disc = getDisciplineById(session.disciplineId);
  logActivity(memberId, 'member', `Booked ${disc ? disc.name : 'Class'} session`, 'booking');

  events.emit(EVENT.BOOKING_CREATED, { booking, session });
  events.emit(EVENT.DATA_MUTATED, { source: 'book_class', booking, session });
  return Object.assign(booking, { booking, session });
}

/**
 * Get cancellation window in hours for a session:
 * 12 hours for morning sessions (starts before 12:00 PM IST),
 * 6 hours for evening sessions (starts at or after 12:00 PM IST).
 * @param {Object} session
 * @returns {number}
 */
export function getCancellationWindowHours(session) {
  if (!session) return CONFIG.CANCELLATION_WINDOW_EVENING_HOURS || 6;
  let startHour = 12;
  if (session.time) {
    startHour = parseInt(session.time.slice(0, 2), 10);
  } else if (session.startsAt) {
    const ist = getISTDateParts(session.startsAt);
    if (ist && ist.time) {
      startHour = parseInt(ist.time.slice(0, 2), 10);
    } else {
      startHour = new Date(session.startsAt).getHours();
    }
  }
  return startHour < 12
    ? (CONFIG.CANCELLATION_WINDOW_MORNING_HOURS || 12)
    : (CONFIG.CANCELLATION_WINDOW_EVENING_HOURS || 6);
}

/**
 * Cancel a booking.
 * @param {string} bookingId
 * @returns {{success: boolean}|{error: string}}
 */
export async function cancelBooking(bookingId) {
  const booking = state.bookings.find(b => b.id === bookingId);
  if (!booking) throw new Error('Booking not found.');
  if (!['upcoming', 'pending_partner_approval'].includes(booking.status)) {
    throw new Error('Only upcoming or pending bookings can be cancelled.');
  }

  const sId = booking.classSessionId || booking.sessionId;
  const session = getClassSessionById(sId) || booking.session;

  if (session) {
    let classStart = null;
    if (session.startsAt) {
      classStart = new Date(session.startsAt);
    } else if (session.date && session.time) {
      classStart = new Date(parseClassDateTimeToUTC(session.date, session.time));
    }

    if (classStart && !isNaN(classStart.getTime())) {
      const now = new Date();
      const hoursUntil = (classStart - now) / 3600000;
      if (hoursUntil <= 0) {
        throw new Error('This class has already started or concluded and cannot be cancelled.');
      }

      if (booking.status === 'upcoming') {
        const cutoffHours = getCancellationWindowHours(session);
        if (hoursUntil < cutoffHours) {
          const sessionType = cutoffHours === (CONFIG.CANCELLATION_WINDOW_MORNING_HOURS || 12) ? 'Morning' : 'Evening';
          throw new Error(`Cancellation window closed. ${sessionType} classes cannot be cancelled within ${cutoffHours} hours of class start time.`);
        }
      }
    }
  }

  const targetDisciplineId = session?.disciplineId || session?.discipline_id || booking.disciplineId || booking.discipline_id || 'disc-barre';
  const pass = getActiveMemberPass(booking.memberId);
  const targetPassId = booking.passId || (pass ? pass.id : null);

  if (isSupabaseConfigured()) {
    await dbCancelBooking(booking.id, { passId: targetPassId, disciplineId: targetDisciplineId });
  }

  booking.status = 'cancelled';
  booking.decidedAt = new Date().toISOString();
  booking.decidedBy = 'member';

  // Restore spot and credit
  if (session) {
    session.spotsRemaining = Math.min(session.capacity || 6, (session.spotsRemaining || 0) + 1);
  }
  if (targetPassId) {
    const aliasMap = {
      'disc-001': CONFIG.DISCIPLINES.PILATES,
      'disc-002': CONFIG.DISCIPLINES.BARRE,
      'disc-003': CONFIG.DISCIPLINES.SCULPT_YOGA
    };
    const normDisciplineId = aliasMap[targetDisciplineId] || targetDisciplineId;
    const credit = state.memberPassCredits.find(
      c => (c.memberPassId === targetPassId || c.passId === targetPassId || c.pass_id === targetPassId) &&
           (c.disciplineId === targetDisciplineId || c.disciplineId === normDisciplineId || c.discipline_id === targetDisciplineId || c.discipline_id === normDisciplineId)
    );
    if (credit) {
      credit.sessionsUsed = Math.max(0, (credit.sessionsUsed || 0) - 1);
      if (credit.remainingCredits !== undefined) {
        const total = credit.sessionsIncluded !== undefined ? credit.sessionsIncluded : (credit.total_credits || 999);
        credit.remainingCredits = Math.min(total, credit.remainingCredits + 1);
      }
    }
  }

  logActivity(booking.memberId, 'member', 'Cancelled a booking', 'booking');
  saveBookingsCache();
  saveMemberPassesCache();
  events.emit(EVENT.BOOKING_CANCELLED, { booking });

  return { success: true, booking };
}

/**
 * Mark attendance for a booking (trainer action).
 * @param {string} bookingId
 * @param {'completed'|'no_show'} status - 'completed' = present, 'no_show' = absent (credit refunded)
 * @returns {{ success: boolean, booking: Object }}
 */
export async function markAttendance(bookingId, status, options = {}) {
  if (!['completed', 'no_show'].includes(status)) {
    throw new Error('Invalid attendance status. Must be "completed" or "no_show".');
  }

  const booking = state.bookings.find(b => b.id === bookingId);
  if (!booking) throw new Error('Booking not found.');

  if (isSupabaseConfigured()) {
    await dbMarkAttendance(booking.id, status, options);
  }

  booking.status = status;
  booking.attendanceMarkedAt = new Date().toISOString();
  if (options.reason) booking.attendanceNotes = options.reason;
  booking.creditWaived = !!options.refundCredit;

  const sId = booking.classSessionId || booking.sessionId;
  const session = getClassSessionById(sId);

  // Spot is restored on no-show
  if (status === 'no_show' && session) {
    session.spotsRemaining = Math.min(session.capacity || 6, session.spotsRemaining + 1);

    // Credit is forfeited by default unless trainer explicitly waives penalty for genuine reason
    if (options.refundCredit) {
      const pass = getActiveMemberPass(booking.memberId);
      const targetPassId = booking.passId || (pass ? pass.id : null);
      if (targetPassId) {
        const credit = state.memberPassCredits.find(
          c => c.memberPassId === targetPassId && c.disciplineId === session.disciplineId
        );
        if (credit) credit.sessionsUsed = Math.max(0, credit.sessionsUsed - 1);
      }
      logActivity(booking.memberId, 'trainer', `Marked no-show: credit refunded for genuine reason (${options.reason || 'Trainer waiver'})`, 'attendance');
    } else {
      logActivity(booking.memberId, 'trainer', `Marked no-show: credit forfeited per studio policy`, 'attendance');
    }
  } else {
    logActivity(booking.memberId, 'trainer', `Marked as attended`, 'attendance');
  }

  saveBookingsCache();
  events.emit(EVENT.DATA_MUTATED, { source: 'attendance' });
  return { success: true, booking };
}

/**
 * Helper to ensure a booking object has sessionId, classSessionId, session, and member attached.
 * @param {Object} b
 * @returns {Object}
 */
function enrichBooking(b) {
  if (!b) return b;
  const sId = b.classSessionId || b.sessionId;
  let session = getClassSessionById(sId);
  if (!session && b.session) {
    session = { ...b.session };
    const rawStart = session.startsAt || session.start_time || session.startTime;
    if (rawStart && (!session.date || !session.time)) {
      const d = new Date(rawStart);
      session.date = session.date || d.toISOString().slice(0, 10);
      session.time = session.time || d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
      session.startsAt = rawStart;
      session.durationMinutes = session.durationMinutes || session.duration_min || 60;
      session.disciplineId = session.disciplineId || session.discipline_id;
      session.trainerId = session.trainerId || session.trainer_id;
    }
  }
  const member = getMemberById(b.memberId) || b.member;
  return {
    ...b,
    sessionId: sId,
    classSessionId: sId,
    session: session || null,
    member: member || null,
  };
}

/**
 * Authoritative Supabase query to sync bookings.
 * @param {string} [memberId]
 * @returns {Promise<Array>}
 */
export async function syncBookings(memberId = null) {
  try {
    const remote = await dbGetBookings(memberId);
    if (Array.isArray(remote)) {
      const remoteIds = new Set(remote.map(r => r.id));
      const pendingLocal = state.bookings.filter(b => b && b.id && !remoteIds.has(b.id));
      state.bookings = [...remote, ...pendingLocal];
      saveBookingsCache();
      events.emit(EVENT.DATA_MUTATED, { source: 'sync_bookings' });
    }
  } catch (err) {
    console.warn('[store.syncBookings notice]', err.message);
  }
  return state.bookings;
}

/**
 * Get bookings for a member by status category.
 * @param {string} memberId
 * @param {'upcoming'|'pending'|'past'} [category]
 * @returns {Array}
 */
export function getBookingsForMember(memberId, category) {
  return state.bookings
    .filter(b => {
      if (!isMemberIdMatch(b.memberId, memberId)) return false;
      
      const sId = b.classSessionId || b.sessionId;
      const session = getClassSessionById(sId) || b.session;
      
      switch (category) {
        case 'upcoming': 
          return ['upcoming', 'confirmed'].includes(b.status) && (!session || !isSessionPast(session));
        case 'pending': 
          return b.status === 'pending_partner_approval';
        case 'past': 
          return ['completed', 'attended', 'no_show', 'cancelled'].includes(b.status) || (['upcoming', 'confirmed'].includes(b.status) && session && isSessionPast(session));
        default: 
          return true;
      }
    })
    .map(enrichBooking)
    .sort((a, b) => {
      if (category === 'upcoming' && a.session && b.session) {
        const timeA = a.session.startsAt || `${a.session.date}T${a.session.time}`;
        const timeB = b.session.startsAt || `${b.session.date}T${b.session.time}`;
        return new Date(timeA) - new Date(timeB);
      }
      return new Date(b.bookedAt) - new Date(a.bookedAt);
    });
}

/**
 * Get upcoming bookings for a member.
 * @param {string} memberId
 * @returns {Array}
 */
export function getUpcomingBookingsForMember(memberId) {
  return getBookingsForMember(memberId, 'upcoming');
}

/**
 * Get pending approval bookings for a member.
 * @param {string} memberId
 * @returns {Array}
 */
export function getPendingBookingsForMember(memberId) {
  return getBookingsForMember(memberId, 'pending');
}

/**
 * Get past/cancelled bookings for a member.
 * @param {string} memberId
 * @returns {Array}
 */
export function getPastBookingsForMember(memberId) {
  return getBookingsForMember(memberId, 'past');
}

/**
 * Get all bookings (admin).
 * @param {Object} [filters]
 * @returns {Array}
 */
export function getAllBookings(filters = {}) {
  return state.bookings
    .filter(b => {
      const sId = b.classSessionId || b.sessionId;
      if (filters.disciplineId) {
        const session = getClassSessionById(sId);
        if (session?.disciplineId !== filters.disciplineId) return false;
      }
      if (filters.status && b.status !== filters.status) return false;
      return true;
    })
    .map(enrichBooking)
    .sort((a, b) => new Date(b.bookedAt) - new Date(a.bookedAt));
}

/**
 * Direct booking injection for administrative actions or test harness.
 * @param {Object} booking
 * @returns {Object}
 */
export function addBookingRecord(booking) {
  state.bookings.push(booking);
  return booking;
}

/**
 * Mark a booking as no-show (admin).
 * @param {string} bookingId
 */
export function markNoShow(bookingId) {
  const booking = state.bookings.find(b => b.id === bookingId);
  if (!booking) return;
  booking.status = 'no_show';
  booking.decidedAt = new Date().toISOString();
  booking.decidedBy = 'admin';
  logActivity(booking.memberId, 'admin', 'Marked as no-show', 'booking');
}

/**
 * Admin cancel a booking.
 * @param {string} bookingId
 */
export function adminCancelBooking(bookingId) {
  const booking = state.bookings.find(b => b.id === bookingId);
  if (!booking) return;
  const sId = booking.classSessionId || booking.sessionId;
  const session = getClassSessionById(sId);
  booking.status = 'cancelled';
  booking.decidedAt = new Date().toISOString();
  booking.decidedBy = 'admin';
  if (session) session.spotsRemaining += 1;
  const pass = getActiveMemberPass(booking.memberId);
  if (pass && session) {
    const credit = state.memberPassCredits.find(
      c => c.memberPassId === pass.id && c.disciplineId === session.disciplineId
    );
    if (credit) credit.sessionsUsed = Math.max(0, credit.sessionsUsed - 1);
  }

  // Persist cancellation to Supabase
  if (isSupabaseConfigured()) {
    dbCancelBooking(booking.id).catch(() => {});
  }

  logActivity(booking.memberId, 'admin', 'Booking cancelled by admin', 'booking');
  saveBookingsCache();
  events.emit(EVENT.BOOKING_CANCELLED, { booking });
}

/* ================================================================
   PARTNER (BARRE) — Scoped queries
   ================================================================ */

/**
 * Automatically expire pending Barre booking requests older than 48 hours.
 * Releases held spots and restores member credits per studio policy.
 */
export function processExpiredBarreBookings() {
  const now = new Date();
  const maxAgeMs = (CONFIG.BARRE_APPROVAL_EXPIRY_HOURS || 48) * 3600000;

  state.bookings.forEach(booking => {
    if (booking.status === 'pending_partner_approval') {
      const bookedAt = new Date(booking.bookedAt);
      if (now - bookedAt > maxAgeMs) {
        booking.status = 'cancelled';
        booking.decidedAt = now.toISOString();
        booking.decidedBy = 'system_auto_expiry';
        booking.cancellationReason = '48-hour partner approval window expired';

        const session = getClassSessionById(booking.classSessionId);
        if (session) {
          session.spotsRemaining = Math.min(session.capacity || 6, session.spotsRemaining + 1);
        }
        const pass = getActiveMemberPass(booking.memberId);
        const targetPassId = booking.passId || (pass ? pass.id : null);
        if (targetPassId && session) {
          const credit = state.memberPassCredits.find(
            c => c.memberPassId === targetPassId && c.disciplineId === session.disciplineId
          );
          if (credit) credit.sessionsUsed = Math.max(0, credit.sessionsUsed - 1);
        }
        logActivity(booking.memberId, 'system', 'Barre booking request auto-expired after 48 hours (credits restored)', 'booking');
      }
    }
  });
}

/**
 * Get Barre booking requests pending approval.
 * @returns {Array}
 */
export function getBarreBookingRequests() {
  processExpiredBarreBookings();
  return state.bookings
    .filter(b => b.status === 'pending_partner_approval')
    .filter(b => {
      const sId = b.classSessionId || b.sessionId;
      const session = getClassSessionById(sId);
      return session?.disciplineId === CONFIG.DISCIPLINES.BARRE;
    })
    .map(enrichBooking)
    .sort((a, b) => new Date(b.bookedAt) - new Date(a.bookedAt));
}

/**
 * Approve a Barre booking.
 * @param {string} bookingId
 * @param {string} partnerUserId
 * @returns {{success: boolean}|{error: string}}
 */
export function approveBarreBooking(bookingId, partnerUserId) {
  const booking = state.bookings.find(b => b.id === bookingId);
  if (!booking || booking.status !== 'pending_partner_approval') {
    throw new Error('Booking not found or not pending approval.');
  }
  const session = getClassSessionById(booking.classSessionId);
  booking.status = 'upcoming';
  booking.decidedAt = new Date().toISOString();
  booking.decidedBy = partnerUserId || 'partner-user-001';

  // Persist status change to Supabase
  if (isSupabaseConfigured()) {
    const baseUrl = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3333';
    fetch(`${baseUrl}/api/member/booking-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve_barre', bookingId })
    }).catch(() => {});
  }

  logActivity(booking.memberId, 'partner', 'Barre booking approved by Physicq 57', 'booking');
  events.emit(EVENT.BOOKING_APPROVED, { booking });
  return Object.assign(booking, { success: true, booking, session });
}

/**
 * Decline a Barre booking.
 * @param {string} bookingId
 * @param {string} partnerUserId
 * @returns {{success: boolean}|{error: string}}
 */
export function declineBarreBooking(bookingId, partnerUserId) {
  const booking = state.bookings.find(b => b.id === bookingId);
  if (!booking || booking.status !== 'pending_partner_approval') {
    throw new Error('Booking not found or not pending approval.');
  }
  const session = getClassSessionById(booking.classSessionId);
  booking.status = 'cancelled';
  booking.decidedAt = new Date().toISOString();
  booking.decidedBy = partnerUserId || 'partner-user-001';

  // Release spot and credit
  if (session) {
    session.spotsRemaining = Math.min(session.capacity || 6, session.spotsRemaining + 1);
  }
  const pass = getActiveMemberPass(booking.memberId);
  const targetPassId = booking.passId || (pass ? pass.id : null);
  if (targetPassId && session) {
    const credit = state.memberPassCredits.find(
      c => c.memberPassId === targetPassId && c.disciplineId === session.disciplineId
    );
    if (credit) credit.sessionsUsed = Math.max(0, credit.sessionsUsed - 1);
  }

  // Persist cancellation to Supabase
  if (isSupabaseConfigured()) {
    dbCancelBooking(booking.id).catch(() => {});
  }

  logActivity(booking.memberId, 'partner', 'Barre booking declined by Physicq 57', 'booking');
  events.emit(EVENT.BOOKING_DECLINED, { booking });
  return Object.assign(booking, { success: true, booking, session });
}

/* ==========================================================================
   Physicq 57 Partner Package Reviews (Review upon Barre Package Acquisition)
   ========================================================================== */

/**
 * Sync partner reviews from backend server.
 */
export async function syncPartnerReviews() {
  try {
    const baseUrl = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3333';
    const res = await fetch(`${baseUrl}/api/partner/reviews`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.reviews)) {
        const localReviews = state.partnerReviews || [];
        state.partnerReviews = data.reviews.map(serverRev => {
          const localRev = localReviews.find(l => l.id === serverRev.id || l.passId === serverRev.passId);
          if (localRev && (localRev.status === 'accepted' || localRev.status === 'declined') && serverRev.status === 'pending') {
            return { ...serverRev, ...localRev };
          }
          return serverRev;
        });
      }
    }
  } catch (_) {}
  return getPartnerReviews();
}

/**
 * Generate or get all partner reviews for members with Barre packages.
 * @returns {Array}
 */
export function getPartnerReviews() {
  if (!Array.isArray(state.partnerReviews)) state.partnerReviews = [];

  // Seed partner reviews from members with Barre packages/passes if not yet tracked
  const barrePackages = (state.packages || []).filter(pkg => {
    return (pkg.disciplines && pkg.disciplines.some(d => d.disciplineId === CONFIG.DISCIPLINES.BARRE || (d.name && d.name.toLowerCase().includes('barre')))) ||
           (pkg.name && pkg.name.toLowerCase().includes('barre'));
  });
  const barrePackageIds = new Set(barrePackages.map(p => p.id));

  (state.memberPasses || []).forEach(pass => {
    if (barrePackageIds.has(pass.packageId) || (pass.credits && pass.credits.some(c => c.disciplineId === CONFIG.DISCIPLINES.BARRE))) {
      // Per studio policy: every package purchase containing Barre requires approval for that specific pass
      const existing = state.partnerReviews.find(r => r.passId === pass.id || (isMemberIdMatch(r.memberId, pass.memberId) && r.packageId === pass.packageId && (!r.passId || r.passId === pass.id)));
      if (!existing) {
        const member = getMemberById(pass.memberId);
        const pkg = getPackageById(pass.packageId);
        const health = getHealthProfile(pass.memberId);
        const barreAlloc = (pkg?.session_allocations || []).find(a => a.disciplineId === CONFIG.DISCIPLINES.BARRE || (a.disciplineId && a.disciplineId.includes('barre')));
        const pendingBarreCredits = barreAlloc ? barreAlloc.sessionCount : 8;

        const rev = {
          id: `prev-${pass.id || pass.memberId}`,
          passId: pass.id,
          memberId: pass.memberId,
          memberName: member ? member.fullName : 'Member',
          memberEmail: member ? member.email : '',
          memberPhone: member ? member.phone : '',
          packageId: pass.packageId,
          packageName: pkg ? pkg.name : 'Barre Package',
          pendingBarreCredits,
          status: 'pending', // 'pending' | 'accepted' | 'declined'
          healthNotes: health ? (health.injuries || health.experience || 'No health restrictions noted') : 'Standard health declaration',
          createdAt: pass.createdAt || new Date().toISOString(),
          decidedAt: null,
          decidedBy: null,
          decisionReason: null,
          adminNotified: false
        };
        state.partnerReviews.push(rev);
      }
    }
  });

  return [...state.partnerReviews].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

/**
 * Check if a member has been previously approved for Barre by Physicq 57.
 * @param {string} memberId
 * @returns {boolean}
 */
export function isBarreApprovedForMember(memberId) {
  if (!memberId) return false;
  return (state.partnerReviews || []).some(
    r => isMemberIdMatch(r.memberId, memberId) && r.status === 'accepted'
  );
}

/**
 * Add or update a partner review record directly (used by seed, tests, and webhooks).
 * @param {Object} review
 * @returns {Object}
 */
export function addPartnerReviewRecord(review) {
  if (!review || !review.id) return null;
  getPartnerReviews();
  const idx = state.partnerReviews.findIndex(r => r.id === review.id);
  if (idx >= 0) {
    state.partnerReviews[idx] = { ...state.partnerReviews[idx], ...review };
  } else {
    state.partnerReviews.unshift(review);
  }
  return review;
}

/**
 * Accept member for Barre programming by Physicq 57.
 * @param {string} reviewId
 * @param {string} [coachName]
 */
export async function acceptPartnerReview(reviewId, coachName = 'Physicq 57 Coach') {
  const reviews = getPartnerReviews();
  const review = reviews.find(r => r.id === reviewId || r.passId === reviewId.replace('prev-', ''));
  if (!review) throw new Error('Partner review record not found.');

  review.status = 'accepted';
  review.decidedAt = new Date().toISOString();
  review.decidedBy = coachName;
  review.adminNotified = true;

  logActivity(review.memberId, 'partner', `Physicq 57 approved member for Barre programming`, 'partner');

  try {
    const baseUrl = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3333';
    await fetch(`${baseUrl}/api/partner/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'decide',
        reviewId,
        status: 'accepted',
        decidedBy: coachName
      })
    });
  } catch (_) {}

  // Unlock in-memory pass credits immediately
  const targetPass = state.memberPasses.find(p => p.id === review.passId || (p.memberId === review.memberId && p.packageId === review.packageId));
  if (targetPass && Array.isArray(targetPass.credits)) {
    const barreCredit = targetPass.credits.find(c => c.disciplineId === CONFIG.DISCIPLINES.BARRE || (c.discipline_id === CONFIG.DISCIPLINES.BARRE));
    if (barreCredit) {
      const grantCount = review.pendingBarreCredits || barreCredit.sessionsIncluded || 8;
      barreCredit.sessionsIncluded = grantCount;
      barreCredit.remainingCredits = grantCount;
      barreCredit.total_credits = grantCount;
      barreCredit.remaining_credits = grantCount;
    }
  }

  try { await syncFromSupabase(); } catch (_) {}
  events.emit(EVENT.DATA_MUTATED, { source: 'partner_review_accepted', review });
  return { success: true, review };
}

/**
 * Decline/Cancel member for Barre programming by Physicq 57 with reason.
 * @param {string} reviewId
 * @param {string} reason
 * @param {string} [coachName]
 */
export async function declinePartnerReview(reviewId, reason, coachName = 'Physicq 57 Coach') {
  if (!reason || !reason.trim()) {
    throw new Error('A specific reason must be provided when declining a member.');
  }

  const reviews = getPartnerReviews();
  const review = reviews.find(r => r.id === reviewId || r.passId === reviewId.replace('prev-', ''));
  if (!review) throw new Error('Partner review record not found.');

  review.status = 'declined';
  review.decisionReason = reason.trim();
  review.decidedAt = new Date().toISOString();
  review.decidedBy = coachName;
  review.adminNotified = true;

  logActivity(review.memberId, 'partner', `Physicq 57 declined member for Barre: ${reason.trim()}`, 'partner');

  try {
    const baseUrl = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3333';
    await fetch(`${baseUrl}/api/partner/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'decide',
        reviewId,
        status: 'declined',
        reason: reason.trim(),
        decidedBy: coachName
      })
    });
  } catch (_) {}

  // Set in-memory pass credits to 0
  const targetPass = state.memberPasses.find(p => p.id === review.passId || (p.memberId === review.memberId && p.packageId === review.packageId));
  if (targetPass && Array.isArray(targetPass.credits)) {
    const barreCredit = targetPass.credits.find(c => c.disciplineId === CONFIG.DISCIPLINES.BARRE || (c.discipline_id === CONFIG.DISCIPLINES.BARRE));
    if (barreCredit) {
      barreCredit.sessionsIncluded = 0;
      barreCredit.remainingCredits = 0;
      barreCredit.total_credits = 0;
      barreCredit.remaining_credits = 0;
    }
  }

  try { await syncFromSupabase(); } catch (_) {}
  events.emit(EVENT.DATA_MUTATED, { source: 'partner_review_declined', review });
  return { success: true, review };
}

/**
 * Process / record refund for a declined Barre package review.
 * @param {string} reviewId
 * @param {Object} details
 * @returns {Promise<Object>}
 */
export async function processPartnerRefund(reviewId, details = {}) {
  const reviews = getPartnerReviews();
  const review = reviews.find(r => r.id === reviewId || r.passId === reviewId.replace('prev-', ''));
  if (!review) throw new Error('Partner review record not found.');

  review.refundStatus = 'refunded';
  review.refundRef = details.refundRef || `REF-${Date.now()}`;
  review.refundMethod = details.refundMethod || 'Razorpay Gateway';
  review.refundedAt = new Date().toISOString();
  review.refundNotes = details.notes || '';
  review.refundProcessedBy = details.processedBy || 'Studio Administrator';
  if (details.amount) review.refundAmount = Number(details.amount);

  logActivity(review.memberId, 'admin', `Refund processed for declined Barre pass (${review.packageName}): ${review.refundRef}`, 'payment');

  try {
    const baseUrl = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3333';
    await fetch(`${baseUrl}/api/partner/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'refund',
        reviewId,
        refundRef: review.refundRef,
        refundMethod: review.refundMethod,
        notes: review.refundNotes,
        amount: review.refundAmount,
        processedBy: review.refundProcessedBy
      })
    });
  } catch (_) {}

  events.emit(EVENT.DATA_MUTATED, { source: 'partner_refund_processed', review });
  return { success: true, review };
}

/**
 * Get Barre roster — only members with Barre enrollment.
 * A member is "enrolled" if they have any Barre booking (any status except cancelled).
 * @returns {Array}
 */
export function getBarreRoster() {
  const barreSessionIds = new Set(
    state.classSessions
      .filter(s => s.disciplineId === CONFIG.DISCIPLINES.BARRE)
      .map(s => s.id)
  );
  const barreMemberIds = new Set(
    state.bookings
      .filter(b => barreSessionIds.has(b.classSessionId || b.sessionId) && b.status !== 'cancelled')
      .map(b => b.memberId)
  );
  return state.members.filter(m => barreMemberIds.has(m.id));
}

/**
 * Check if a member has Barre enrollment.
 * @param {string} memberId
 * @returns {boolean}
 */
export function hasBarreEnrollment(memberId) {
  const barreSessionIds = new Set(
    state.classSessions
      .filter(s => s.disciplineId === CONFIG.DISCIPLINES.BARRE)
      .map(s => s.id)
  );
  return state.bookings.some(
    b => isMemberIdMatch(b.memberId, memberId) && barreSessionIds.has(b.classSessionId || b.sessionId) && b.status !== 'cancelled'
  );
}

/**
 * Get Barre member detail (health profile) — only if Barre-enrolled.
 * @param {string} memberId
 * @returns {Object|null}
 */
export function getBarreMemberDetail(memberId) {
  if (!hasBarreEnrollment(memberId)) return null;
  const member = getMemberById(memberId);
  const health = getHealthProfile(memberId);
  return member ? { ...member, healthProfile: health } : null;
}

/**
 * Get Barre schedule (weekend sessions).
 * @returns {Array}
 */
export function getBarreSchedule() {
  return state.classSessions
    .filter(s => {
      const d = s.disciplineId || s.discipline_id;
      return d === CONFIG.DISCIPLINES.BARRE || d === 'disc-002' || (s.title && s.title.toLowerCase().includes('barre'));
    })
    .sort((a, b) => new Date(a.startsAt || a.start_time) - new Date(b.startsAt || b.start_time));
}

/**
 * Get partner notifications scoped to an org.
 * @param {string} [orgId]
 * @returns {Array}
 */
export function getPartnerNotifications(orgId = CONFIG.PARTNER?.orgId) {
  return state.partnerNotifications
    .filter(n => !orgId || n.partnerOrgId === orgId)
    .map(n => ({
      ...n,
      createdAt: n.sentAt || new Date().toISOString(),
      title: n.title || (n.channel === 'whatsapp' ? 'WhatsApp Confirmation Sent' : 'Email Notification Delivered'),
      message: n.message || `Booking update notification successfully delivered to partner studio via ${n.channel}.`
    }))
    .sort((a, b) => new Date(b.sentAt || b.createdAt) - new Date(a.sentAt || a.createdAt));
}

/* ================================================================
   PACKAGES / PURCHASES
   ================================================================ */

/**
 * Purchase a package (mock checkout).
 * @param {string} memberId
 * @param {string} packageId
 * @param {string} waiverId
 * @returns {{pass: Object}|{error: string}}
 */
export async function purchasePackage(memberId, packageId, waiverId, paymentMeta = {}) {
  const pkg = state.packages.find(p => p.id === packageId);
  if (!pkg) throw new Error('Package not found.');

  const waiver = state.waivers.find(w => w.id === waiverId || w.version === waiverId) || state.waivers[0];
  if (!waiver) throw new Error('Valid waiver acceptance required before purchase.');

  if (paymentMeta.reference) {
    const existingPayment = state.payments.find(p => p.reference === paymentMeta.reference);
    if (existingPayment) {
      const existingPass = state.memberPasses.find(p => p.packageId === packageId && isMemberIdMatch(p.memberId, memberId)) || state.memberPasses[0];
      const credits = existingPass ? state.memberPassCredits.filter(c => c.memberPassId === existingPass.id) : [];
      return Object.assign({}, existingPass, { pass: existingPass, credits, payment: existingPayment });
    }
  }

  const price = pkg.priceInr;
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + pkg.durationMonths);

  const passId = genId('pass');
  const paymentId = genId('pay');
  const base = Number(price);
  const cgst = Math.round(base * 0.09);
  const sgst = Math.round(base * 0.09);
  const totalGst = cgst + sgst;
  const totalAmount = base + totalGst;
  const invoiceIndex = state.payments.length + 1;
  const invoiceNo = `INV-PLASH-PAY${String(invoiceIndex).padStart(3, '0')}`;

  const pass = {
    id: passId, memberId, packageId, packageName: pkg.name,
    purchasedAt: now.toISOString(), expiresAt: expiresAt.toISOString(), status: 'active',
  };

  const payment = {
    id: paymentId, memberId, packageId, amountInr: totalAmount, baseAmountInr: base, cgstInr: cgst, sgstInr: sgst, totalAmountInr: totalAmount,
    invoiceNo, gstin: '29ABIFP5917A1Z7', paymentMethod: paymentMeta.paymentMethod || 'Razorpay Gateway (UPI / Card)',
    status: 'paid', createdAt: now.toISOString(), reference: paymentMeta.reference || `RZP-DEMO-${Date.now()}`,
  };

  const creditRows = pkg.sessionAllocations.map(alloc => ({
    memberPassId: passId, disciplineId: alloc.disciplineId, sessionsIncluded: alloc.sessionCount, sessionsUsed: 0,
  }));

  // Note: Database persistence for payments, passes, and credits is handled
  // strictly server-side by /api/verify-and-fulfill-payment under service_role.

  state.payments.unshift(payment);
  state.memberPasses.push(pass);
  state.memberPassCredits.push(...creditRows);
  state.waiverAcceptances.push({
    id: genId('waiver-acc'), memberId, waiverId: waiver.id, packageId, acceptedAt: now.toISOString(),
  });

  logActivity(memberId, 'member', `Purchased ${pkg.name} (${pkg.durationMonths} month) via ${payment.paymentMethod}`, 'payment');
  logActivity(memberId, 'member', `Accepted liability waiver v${waiver.version}`, 'legal');
  
  events.emit(EVENT.PACKAGE_PURCHASED, { pass, pkg, payment });
  events.emit(EVENT.DATA_MUTATED);
  return Object.assign(pass, { pass, credits: creditRows, payment });
}

/**
 * Admin action: Grant a complimentary trial or welcome pass to a registered prospect.
 * @param {Object} params
 * @param {string} params.memberId
 * @param {string} params.packageId
 * @param {string} [params.adminId]
 * @param {string} [params.note]
 * @returns {Object}
 */
export function grantComplimentaryPass({ memberId, packageId, adminId, note = 'Complimentary trial' }) {
  const pkg = getPackageById(packageId) || state.packages[0];
  if (!pkg) throw new Error('Package not found');
  const now = new Date();
  const validUntil = new Date(now);
  validUntil.setMonth(validUntil.getMonth() + (pkg.durationMonths || 1));

  const passId = genId('pass');
  const pass = {
    id: passId,
    memberId,
    packageId: pkg.id,
    packageName: pkg.name,
    validFrom: now.toISOString(),
    validUntil: validUntil.toISOString(),
    status: 'active',
    isTrial: true,
    grantedBy: adminId || 'admin',
    createdAt: now.toISOString(),
  };

  const creditRows = (pkg.sessionAllocations || []).map(alloc => ({
    memberPassId: passId,
    disciplineId: alloc.disciplineId,
    sessionsIncluded: alloc.sessionCount,
    sessionsUsed: 0,
  }));

  state.memberPasses.push(pass);
  state.memberPassCredits.push(...creditRows);

  if (isSupabaseConfigured()) {
    dbGrantComplimentaryPass(pass, creditRows).catch(() => {});
  }

  logActivity(memberId, 'admin', `Granted complimentary trial pass: ${pkg.name}`, 'pass', {
    packageId: pkg.id,
    packageName: pkg.name,
    adminId,
    note
  });

  events.emit(EVENT.DATA_MUTATED, { source: 'grant_complimentary_pass' });
  return pass;
}


/**
 * export function enrichPayment(p) {
  if (!p) return null;
  const pkg = state.packages.find(pkg => pkg.id === p.packageId);
  const member = getMemberById(p.memberId);
  const base = Math.round(p.amountInr / 1.18);
  const totalGst = p.amountInr - base;
  const cgst = Math.round(totalGst / 2);
  const sgst = totalGst - cgst;
  const ist = getISTDateParts(p.createdAt);

  return {
    ...p,
    invoiceNo: p.invoiceNo || `INV-PLASH-${p.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`,
    sacCode: '999723',
    baseAmountInr: base,
    cgstInr: cgst,
    sgstInr: sgst,
    totalAmountInr: p.amountInr,
    gstRatePercent: 18,
    paymentMethod: p.paymentMethod || 'Razorpay / UPI Instant',
    date: ist.date,
    time: ist.time,
    package: pkg || null,
    packageName: pkg ? pkg.name : 'Studio Membership Package',
    member: member || null,
    status: p.status || 'completed',
  };
}

/**
 * Enrich payment record with package and member metadata.
 * @param {Object} p
 * @returns {Object}
 */
function enrichPayment(p) {
  if (!p) return p;
  const pkg = state.packages.find(k => k.id === p.packageId);
  const member = (p.member && (p.member.fullName || p.member.full_name)) ? p.member : getMemberById(p.memberId);
  return {
    ...p,
    packageName: p.packageName || pkg?.name || 'Studio Membership Package',
    package: pkg || null,
    member: member || null
  };
}

/**
 * Get all payments in the system enriched with package and member (admin).
 * Deduplicated and ordered newest first.
 * @returns {Array}
 */
export function getAllPayments() {
  const seenRefs = new Set();
  const seenIds = new Set();
  const unique = [];

  const sorted = [...state.payments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  for (const p of sorted) {
    const refKey = p.reference ? `ref:${p.reference}` : `id:${p.id}`;
    if (seenRefs.has(refKey) || seenIds.has(p.id)) continue;
    seenRefs.add(refKey);
    seenIds.add(p.id);
    unique.push(p);
  }

  return unique.map(enrichPayment);
}

/**
 * Authoritative Supabase query for studio-wide admin payment ledger.
 * Fetches all payments and hydrates store state.
 * @returns {Promise<Array>}
 */
export async function fetchAdminPayments() {
  try {
    const remotePayments = await dbGetPayments(null);
    if (Array.isArray(remotePayments) && remotePayments.length > 0) {
      const seenRefs = new Set();
      const seenIds = new Set();
      const merged = [];
      for (const p of [...remotePayments, ...state.payments]) {
        const refKey = p.reference ? `ref:${p.reference}` : `id:${p.id}`;
        if (seenRefs.has(refKey) || seenIds.has(p.id)) continue;
        seenRefs.add(refKey);
        seenIds.add(p.id);
        merged.push(p);
      }
      state.payments = merged;
    }
  } catch (err) {
    console.error('[store.fetchAdminPayments error]', err);
  }
  return getAllPayments();
}

/**
 * Get payment history for a member with tax invoice metadata.
 * @param {string} memberId
 * @returns {Array}
 */
export function getPaymentHistory(memberId) {
  const seenRefs = new Set();
  const seenIds = new Set();
  const unique = [];

  const targetMember = resolveMember(memberId);
  const targetEmail = (targetMember?.email || '').toLowerCase();

  const memberPayments = state.payments
    .filter(p => isMemberIdMatch(p.memberId, memberId) || (targetEmail && (p.member?.email || '').toLowerCase() === targetEmail))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  for (const p of memberPayments) {
    const refKey = p.reference ? `ref:${p.reference}` : `id:${p.id}`;
    if (seenRefs.has(refKey) || seenIds.has(p.id)) continue;
    seenRefs.add(refKey);
    seenIds.add(p.id);
    unique.push(p);
  }

  return unique.map(enrichPayment);
}

/**
 * Add or update a payment record in local cache.
 * @param {Object} payment
 */
export function addPayment(payment) {
  if (!payment || !payment.id) return;
  const existingIdx = state.payments.findIndex(p => p.id === payment.id || (p.reference && p.reference === payment.reference));
  if (existingIdx >= 0) {
    state.payments[existingIdx] = { ...state.payments[existingIdx], ...payment };
  } else {
    state.payments.unshift(payment);
  }
}

/**
 * Add or update a member pass in local cache.
 * @param {Object} pass
 */
export function addMemberPass(pass) {
  if (!pass || !pass.id) return;
  const existingIdx = state.memberPasses.findIndex(p => p.id === pass.id);
  if (existingIdx >= 0) {
    state.memberPasses[existingIdx] = { ...state.memberPasses[existingIdx], ...pass };
  } else {
    state.memberPasses.push(pass);
  }
}

/**
 * Authoritative Supabase query for member payment history.
 * Fetches directly from Supabase public.payments with authenticated Member JWT.
 * @param {string} memberId
 * @returns {Promise<Array>}
 */
export async function fetchMemberPayments(memberId) {
  if (!memberId) return [];
  try {
    const remotePayments = await dbGetPayments(memberId);
    if (Array.isArray(remotePayments)) {
      const otherMembersPayments = state.payments.filter(p => !isMemberIdMatch(p.memberId, memberId));
      state.payments = [...remotePayments, ...otherMembersPayments];
    }
  } catch (err) {
    console.error('[store.fetchMemberPayments error]', err);
    throw err;
  }
  return getPaymentHistory(memberId);
}

/**
 * Authoritative Supabase query for member passes.
 * Fetches directly from Supabase / server API and populates store state.
 * @param {string} memberId
 * @returns {Promise<Array>}
 */
export async function fetchMemberPasses(memberId) {
  if (!memberId) return [];
  try {
    const remotePasses = await dbGetMemberPasses(memberId);
    const targetMember = resolveMember(memberId);
    let targetEmail = (targetMember?.email || '').toLowerCase();
    if (!targetEmail) {
      try {
        const raw = typeof localStorage !== 'undefined' ? (localStorage.getItem('plash_auth_session_v1') || localStorage.getItem('plash_session')) : null;
        if (raw) targetEmail = (JSON.parse(raw)?.currentUserEmail || '').toLowerCase();
      } catch (_) {}
    }

    const existingOther = state.memberPasses.filter(p => {
      const isMatch = isMemberIdMatch(p.memberId, memberId) || (targetEmail && (p.member?.email || '').toLowerCase() === targetEmail);
      return !isMatch;
    });
    state.memberPasses = [...(Array.isArray(remotePasses) ? remotePasses : []), ...existingOther];

    // Synchronize pass credits into store state for balance lookups
    const allCredits = [];
    state.memberPasses.forEach(p => {
      if (Array.isArray(p.credits)) {
        p.credits.forEach(c => {
          allCredits.push({
            memberPassId: p.id,
            disciplineId: c.disciplineId || c.discipline_id,
            sessionsIncluded: c.sessionsIncluded !== undefined ? c.sessionsIncluded : (c.total_credits || 0),
            sessionsUsed: c.sessionsUsed !== undefined ? c.sessionsUsed : ((c.total_credits || 0) - (c.remaining_credits || 0)),
          });
        });
      }
    });
    state.memberPassCredits = allCredits;
    saveMemberPassesCache();
  } catch (err) {
    console.error('[store.fetchMemberPasses error]', err);
    throw err;
  }
  return getMemberPasses(memberId);
}

/**
 * Get payment by ID.
 * @param {string} paymentId
 * @returns {Object|null}
 */
export function getPaymentById(paymentId) {
  const p = state.payments.find(pay => pay.id === paymentId);
  return p ? enrichPayment(p) : null;
}


/* ================================================================
   PAUSE REQUESTS
   ================================================================ */

/**
 * Request a pass pause.
 * @param {string} memberPassId
 * @returns {{request: Object}|{error: string}}
 */
export function requestPause(memberPassId) {
  const pass = state.memberPasses.find(p => p.id === memberPassId);
  if (!pass || pass.status !== 'active') return { error: 'No active pass to pause.' };
  const existing = state.pauseRequests.find(
    pr => pr.memberPassId === memberPassId && pr.status === 'pending'
  );
  if (existing) return { error: 'A pause request is already pending.' };

  const req = {
    id: genId('pause'),
    memberPassId,
    requestedAt: new Date().toISOString(),
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
  };
  state.pauseRequests.push(req);
  logActivity(pass.memberId, 'member', 'Submitted pass pause request', 'pass');
  events.emit(EVENT.PAUSE_REQUESTED, { request: req });
  return { request: req };
}

/** @returns {Array} All pause requests */
export function getPauseRequests() {
  return state.pauseRequests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
}

/**
 * Get pause requests for a specific member.
 * @param {string} memberId
 * @returns {Array}
 */
export function getMemberPauseRequests(memberId) {
  const passIds = state.memberPasses.filter(p => isMemberIdMatch(p.memberId, memberId)).map(p => p.id);
  return state.pauseRequests.filter(pr => passIds.includes(pr.memberPassId));
}

/**
 * Approve a pause request.
 * @param {string} pauseId
 */
export function approvePause(pauseId) {
  const req = state.pauseRequests.find(pr => pr.id === pauseId);
  if (!req) return;
  req.status = 'approved';
  req.reviewedBy = 'admin-001';
  req.reviewedAt = new Date().toISOString();
  const pass = state.memberPasses.find(p => p.id === req.memberPassId);
  if (pass) {
    pass.status = 'paused';
    logActivity(pass.memberId, 'admin', 'Pause request approved', 'pass');
  }
  events.emit(EVENT.PAUSE_APPROVED, { request: req });
}

/**
 * Reject a pause request.
 * @param {string} pauseId
 */
export function rejectPause(pauseId) {
  const req = state.pauseRequests.find(pr => pr.id === pauseId);
  if (!req) return;
  req.status = 'rejected';
  req.reviewedBy = 'admin-001';
  req.reviewedAt = new Date().toISOString();
  const pass = state.memberPasses.find(p => p.id === req.memberPassId);
  if (pass) logActivity(pass.memberId, 'admin', 'Pause request rejected', 'pass');
  events.emit(EVENT.PAUSE_REJECTED, { request: req });
}

/* ================================================================
   TRAINERS (Admin CRUD)
   ================================================================ */

export function addTrainer(data) {
  const trainer = { id: genId('trainer'), ...data, photoUrl: null };
  state.trainers.push(trainer);
  return trainer;
}

export function updateTrainer(trainerId, data) {
  const trainer = getTrainerById(trainerId);
  if (!trainer) throw new Error('Trainer not found');
  Object.assign(trainer, data);
  return trainer;
}

export function deleteTrainer(trainerId) {
  const idx = state.trainers.findIndex(t => t.id === trainerId);
  if (idx > -1) state.trainers.splice(idx, 1);
}

/* ================================================================
   PACKAGES (Admin CRUD)
   ================================================================ */

export async function addPackage(data) {
  if (!data.name || !data.name.trim()) {
    throw new Error('Package name is required');
  }
  const id = data.id || `pkg-${Date.now()}`;
  const priceInr = parseInt(data.priceInr, 10) || 0;
  const firstCirclePriceInr = parseInt(data.firstCirclePriceInr, 10) || Math.round(priceInr * 0.95);

  const newPkg = {
    id,
    name: data.name.trim(),
    disciplineId: data.disciplineId || null,
    durationMonths: parseInt(data.durationMonths, 10) || 1,
    priceInr,
    firstCirclePriceInr,
    sessionAllocations: Array.isArray(data.sessionAllocations) && data.sessionAllocations.length > 0
      ? data.sessionAllocations
      : [{ disciplineId: data.disciplineId || CONFIG.DISCIPLINES.PILATES, sessionCount: parseInt(data.totalSessions, 10) || 12 }],
    isPopular: !!data.isPopular,
    trainerTier: data.trainerTier || undefined,
  };

  // Write directly to Supabase
  if (isSupabaseConfigured()) {
    await dbCreatePackage(newPkg);
  }

  state.packages.push(newPkg);
  events.emit('package:created', { package: newPkg });
  events.emit(EVENT.DATA_MUTATED, { source: 'add_package', package: newPkg });
  return newPkg;
}

export function addPackageRecord(pkg) {
  state.packages.push(pkg);
  return pkg;
}

export async function updatePackage(packageId, data) {
  const pkg = state.packages.find(p => p.id === packageId);
  if (!pkg) throw new Error('Package not found');

  // Update in live Supabase
  if (isSupabaseConfigured()) {
    await dbUpdatePackage(packageId, data);
  }

  Object.assign(pkg, data);
  events.emit('package:updated', { packageId, package: pkg });
  events.emit(EVENT.DATA_MUTATED, { source: 'update_package', package: pkg });
  return pkg;
}

export async function deletePackage(packageId) {
  const idx = state.packages.findIndex(p => p.id === packageId);
  if (idx === -1) throw new Error('Package not found');

  // Delete from live Supabase
  if (isSupabaseConfigured()) {
    await dbDeletePackage(packageId);
  }

  const deleted = state.packages.splice(idx, 1)[0];
  events.emit('package:deleted', { packageId, package: deleted });
  events.emit(EVENT.DATA_MUTATED, { source: 'delete_package', packageId });
  return deleted;
}

export function updateFirstCircleCutoff(dateStr) {
  CONFIG.FIRST_CIRCLE_CUTOFF = dateStr;
}

/* ================================================================
   MEMBER STATS
   ================================================================ */



/**
 * Get stats for a member's dashboard.
 * @param {string} memberId
 * @returns {Object}
 */
export function getMemberStats(memberId) {
  const allBookings = state.bookings.filter(b => isMemberIdMatch(b.memberId, memberId));
  const completed = allBookings.filter(b => b.status === 'completed').length;
  const noShow = allBookings.filter(b => b.status === 'no_show').length;
  const lateCancel = allBookings.filter(b => b.status === 'cancelled').length;
  const upcoming = allBookings.filter(b => b.status === 'upcoming').length;
  const total = completed + noShow;
  return {
    totalSessions: completed,
    attendedCount: completed,
    noShows: noShow,
    noShowCount: noShow,
    lateCancelCount: lateCancel,
    upcomingSessions: upcoming,
    streakWeeks: Math.max(1, Math.min(6, completed)),
    attendanceRate: total > 0 ? Math.round((completed / total) * 100) : 100,
  };
}

/* ================================================================
   ADMIN OVERVIEW STATS
   ================================================================ */

export function getOverviewStats() {
  const activeMembers = state.members.filter(m =>
    state.memberPasses.some(p => isMemberIdMatch(p.memberId, m.id) && p.status === 'active')
  ).length;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const sessionsThisWeek = state.classSessions.filter(s => {
    const d = new Date(s.startsAt);
    return d >= weekStart && d < weekEnd;
  });

  const totalSpots = sessionsThisWeek.reduce((sum, s) => sum + (s.capacity || 6), 0);
  const allBookings = state.bookings;
  const filledSpots = sessionsThisWeek.reduce((sum, s) => {
    const linked = allBookings.filter(b => (b.classSessionId === s.id || b.sessionId === s.id) && b.status !== 'cancelled');
    const filled = Math.max(linked.length, Math.max(0, (s.capacity || 6) - (s.spotsRemaining ?? s.capacity ?? 6)));
    return sum + Math.min(s.capacity || 6, filled);
  }, 0);
  const utilization = totalSpots > 0 ? Math.round((filledSpots / totalSpots) * 100) : 0;

  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const monthlyRevenue = state.payments
    .filter(p => {
      const d = new Date(p.createdAt);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear && p.status === 'completed';
    })
    .reduce((sum, p) => sum + p.amountInr, 0);

  return {
    activeMembers,
    sessionsThisWeek: sessionsThisWeek.length,
    utilization,
    monthlyRevenue,
    sessionsDetail: sessionsThisWeek.map(s => ({
      ...s,
      filled: s.capacity - s.spotsRemaining,
      discipline: getDisciplineById(s.disciplineId),
      trainer: getTrainerById(s.trainerId),
    })),
  };
}

/* ================================================================
   ACTIVITY LOG
   ================================================================ */

/**
 * Get activity log for a member.
 * @param {string} memberId
 * @returns {Array}
 */
export function getActivityLog(memberId) {
  return state.activityLog
    .filter(l => isMemberIdMatch(l.memberId || l.userId, memberId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Get all studio activity logs across all actors with resolved identities and metadata.
 * @param {Object} [filters] - { category, search, startDate, endDate }
 * @returns {Array<Object>}
 */
export function getAllActivityLogs(filters = {}) {
  let logs = state.activityLog.map(l => {
    const rawId = l.memberId || l.userId;
    const user = l.user || resolveMember(rawId);
    const displayName = resolveMemberDisplayName(rawId);
    return {
      id: l.id,
      memberId: rawId,
      userId: rawId,
      actor: l.actor || (user && user.role) || 'member',
      action: l.action,
      category: l.category || (l.details && l.details.category) || 'general',
      details: l.details || {},
      createdAt: l.createdAt,
      user,
      displayName
    };
  });

  // Sort descending by createdAt
  logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (filters.category && filters.category !== 'all') {
    logs = logs.filter(l => (l.category || '').toLowerCase() === filters.category.toLowerCase());
  }

  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    logs = logs.filter(l => 
      (l.displayName || '').toLowerCase().includes(q) ||
      (l.action || '').toLowerCase().includes(q) ||
      (l.user && l.user.email && l.user.email.toLowerCase().includes(q))
    );
  }

  return logs;
}

/**
 * Synchronize audit activity logs from Supabase & server.
 * @returns {Promise<Array>}
 */
export async function syncActivityLogs() {
  try {
    const logs = await dbGetActivityLogs();
    if (Array.isArray(logs) && logs.length > 0) {
      const remoteIds = new Set(logs.map(l => l.id));
      const localOnly = (state.activityLog || []).filter(l => !remoteIds.has(l.id));
      state.activityLog = [
        ...logs.map(l => ({
          id: l.id,
          memberId: l.userId,
          userId: l.userId,
          actor: (l.user && l.user.role) || (l.details && l.details.actor) || 'member',
          action: l.action,
          category: (l.details && l.details.category) || 'general',
          details: l.details || {},
          createdAt: l.createdAt,
          user: l.user
        })),
        ...localOnly
      ];
    }
  } catch (err) {
    console.warn('[store.syncActivityLogs error]', err);
  }
  return state.activityLog;
}

/**
 * Log an activity entry both locally and to Supabase.
 * @param {string} memberId
 * @param {string} actor
 * @param {string} action
 * @param {string} category
 * @param {Object} [details]
 */
export function logActivity(memberId, actor, action, category, details = {}) {
  const mergedDetails = { ...details, category, actor };
  const entry = {
    id: genId('log'),
    memberId,
    userId: memberId,
    actor,
    action,
    category,
    details: mergedDetails,
    createdAt: new Date().toISOString(),
  };
  state.activityLog.push(entry);

  // Asynchronously persist to Supabase if available
  if (isSupabaseConfigured()) {
    dbCreateActivityLog({
      userId: memberId || null,
      action,
      details: mergedDetails
    }).then(remoteLog => {
      if (remoteLog && remoteLog.id) {
        entry.id = remoteLog.id;
        entry.user = remoteLog.user;
      }
    }).catch(err => {
      console.warn('[store.logActivity Supabase sync warn]', err);
    });
  }
}

/**
 * System-wide activity logger helper.
 * @param {string} userId
 * @param {string} actor - 'admin'|'member'|'trainer'|'partner'|'system'
 * @param {string} action
 * @param {string} category - 'auth'|'booking'|'payment'|'pass'|'profile'|'legal'|'system'
 * @param {Object} [details]
 */
export function logSystemActivity(userId, actor, action, category, details = {}) {
  logActivity(userId, actor, action, category, details);
}

/**
 * Get comprehensive batch enrollment data for trainer dashboard.
 * @param {Object} [filters] - { trainerId, disciplineId, onlyUpcoming }
 * @returns {Array<Object>} Enriched batches with enrollments and attendee details
 */
export function getTrainerBatchEnrollments(filters = {}) {
  const sessions = state.classSessions.slice();
  const allMembers = state.members;
  const allBookings = state.bookings;

  const batches = sessions.map(session => {
    const discipline = getDisciplineById(session.disciplineId) || { name: 'Pilates Apparatus' };
    const trainer = getTrainerById(session.trainerId) || { name: 'Master Trainer', tier: 'Master' };
    
    // Direct bookings for this session
    const linkedBookings = allBookings.filter(b => 
      (b.classSessionId === session.id || b.sessionId === session.id) &&
      b.status !== 'cancelled'
    );
    
    // Determine enrolled count
    const capacity = session.capacity || 6;
    const computedEnrolled = Math.max(
      linkedBookings.length,
      typeof session.spotsRemaining === 'number' ? Math.max(0, capacity - session.spotsRemaining) : 0
    );
    const enrolledCount = Math.min(capacity, computedEnrolled);
    const spotsRemaining = Math.max(0, capacity - enrolledCount);
    const occupancyRate = Math.round((enrolledCount / capacity) * 100);

    // Build attendees roster
    const attendees = [];
    const usedMemberIds = new Set();

    linkedBookings.forEach(b => {
      const mid = b.memberId || b.member_id;
      if (!mid) return;
      const midKey = String(mid).toLowerCase();
      if (usedMemberIds.has(midKey)) return;
      usedMemberIds.add(midKey);

      const m = b.member || getMemberById(mid) || resolveMember(mid) || {};
      const resolvedName = m.fullName || m.full_name || m.name || b.memberName || b.member_name || (b.member && (b.member.full_name || b.member.name)) || 'Studio Member';
      const resolvedEmail = m.email || b.memberEmail || b.member_email || (b.member && b.member.email) || '';
      const resolvedPhone = m.phone || b.memberPhone || b.member_phone || (b.member && b.member.phone) || '';
      const health = getHealthProfile(mid) || {};

      attendees.push({
        bookingId: b.id,
        memberId: mid,
        name: resolvedName,
        fullName: resolvedName,
        email: resolvedEmail,
        phone: resolvedPhone,
        status: b.status,
        creditWaived: b.creditWaived ?? b.credit_waived ?? false,
        attendanceNotes: b.attendanceNotes || b.attendance_notes || '',
        attendanceMarkedAt: b.attendanceMarkedAt || b.attendance_marked_at || null,
        healthNotes: health.injuriesNotes || (health.healthConditions || []).join(', ') || 'No health restrictions'
      });
    });

    return {
      id: session.id,
      title: session.title || `${discipline.name} Batch`,
      disciplineId: session.disciplineId,
      disciplineName: discipline.name,
      trainerId: session.trainerId,
      trainerName: '',
      trainerTier: '',
      date: session.date || toISODate(session.startsAt || session.startTime || session.start_time),
      startsAt: session.startsAt || session.startTime || session.start_time,
      durationMin: session.durationMin || session.durationMinutes || 60,
      capacity,
      spotsRemaining,
      enrolledCount,
      occupancyRate,
      isFull: spotsRemaining === 0,
      attendees
    };
  });

  return batches.filter(batch => {
    if (filters.trainerId && batch.trainerId !== filters.trainerId) return false;
    if (filters.disciplineId && batch.disciplineId !== filters.disciplineId) return false;
    if (filters.onlyUpcoming) {
      return new Date(batch.startsAt).getTime() >= Date.now() - 3600000;
    }
    return true;
  }).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
}

