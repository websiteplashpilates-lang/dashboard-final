/**
 * Plash Pilates — Seed Data
 * Comprehensive mock data for Phase 1 demo.
 * @module seed-data
 */

import { CONFIG } from './config.js';

/* ---- Helpers ---- */
const id = (prefix, n) => `${prefix}-${String(n).padStart(3, '0')}`;
const today = new Date();
const dayMs = 86400000;

/**
 * Get a date relative to today.
 * @param {number} offsetDays
 * @param {number} [hour=9]
 * @param {number} [minute=0]
 * @returns {Date}
 */
function relDate(offsetDays, hour = 9, minute = 0) {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function pastDate(daysAgo) {
  return new Date(today.getTime() - daysAgo * dayMs);
}

/* ================================================================
   STUDIO
   ================================================================ */
export const studio = {
  id: 'studio-001',
  name: CONFIG.STUDIO.name,
  address: CONFIG.STUDIO.address,
  phone: CONFIG.STUDIO.phone,
  email: CONFIG.STUDIO.email,
  hours: CONFIG.STUDIO.hours,
  capacityPerClass: CONFIG.CAPACITY_PER_CLASS,
};

/* ================================================================
   DISCIPLINES
   ================================================================ */
export const disciplines = [
  {
    id: CONFIG.DISCIPLINES.PILATES,
    name: 'Reformer Pilates',
    description: 'Precision-based Reformer training combining controlled movements with spring resistance for total-body conditioning, posture correction, and injury prevention.',
  },
  {
    id: CONFIG.DISCIPLINES.BARRE,
    name: 'Barre Conditioning',
    description: 'Ballet-inspired low-impact workout blending isometric holds, small pulses, and stretching. Delivered by Physicq 57 on weekends.',
  },
  {
    id: CONFIG.DISCIPLINES.SCULPT_YOGA,
    name: 'Sculpt Yoga',
    description: 'A dynamic fusion of yoga flows and strength training, using body weight and light resistance to sculpt lean muscle while improving flexibility.',
  },
];

/* ================================================================
   TRAINERS
   ================================================================ */
export const trainers = [
  // Pilates trainers
  { id: id('trainer', 1), name: 'Priya Sharma', bio: 'STOTT-certified master trainer with 12 years experience. Former trainer to professional athletes.', disciplineId: CONFIG.DISCIPLINES.PILATES, tier: 'master', photoUrl: null },
  { id: id('trainer', 2), name: 'Ananya Reddy', bio: 'Lead Reformer instructor specializing in prenatal and postnatal Pilates.', disciplineId: CONFIG.DISCIPLINES.PILATES, tier: 'lead', photoUrl: null },
  { id: id('trainer', 3), name: 'Kavita Desai', bio: 'Balanced Body-certified instructor focused on rehabilitation and flexibility.', disciplineId: CONFIG.DISCIPLINES.PILATES, tier: 'standard', photoUrl: null },
  // Barre trainers
  { id: id('trainer', 4), name: 'Ritika Menon', bio: 'Physicq 57 lead instructor. Trained in New York, specializing in high-intensity barre cardio.', disciplineId: CONFIG.DISCIPLINES.BARRE, tier: 'lead', photoUrl: null },
  { id: id('trainer', 5), name: 'Sneha Nair', bio: 'Physicq 57 instructor with a background in contemporary dance and Pilates mat.', disciplineId: CONFIG.DISCIPLINES.BARRE, tier: 'standard', photoUrl: null },
  // Sculpt Yoga trainers
  { id: id('trainer', 6), name: 'Deepa Iyer', bio: 'RYT-500 certified yoga teacher with a strength-training background. Creator of the Plash Sculpt method.', disciplineId: CONFIG.DISCIPLINES.SCULPT_YOGA, tier: 'lead', photoUrl: null },
  { id: id('trainer', 7), name: 'Meera Krishnan', bio: 'Vinyasa and power yoga specialist focused on athletic performance.', disciplineId: CONFIG.DISCIPLINES.SCULPT_YOGA, tier: 'standard', photoUrl: null },
];

/* ================================================================
   PACKAGES (all 6 types from brochure)
   ================================================================ */
export const packages = [];
export const classSessions = [];
export const members = [];
export const healthProfiles = [];
export const memberPasses = [];
export const memberPassCredits = [];
export const bookings = [];
export const pauseRequests = [];

/* ================================================================
   WAIVER (Default Studio Legal Text)
   ================================================================ */
export const waivers = [
  {
    id: 'waiver-001',
    version: '1.0',
    title: 'Plash Pilates Studio Member Liability Waiver & Health Declaration',
    content: 'I hereby acknowledge and agree that Pilates, Barre, and Sculpt Yoga involve physical exertion. I declare that I am physically fit to participate in studio apparatus classes...',
    effectiveDate: '2026-01-01',
  },
];

export const waiverAcceptances = [];

/* ================================================================
   PARTNER ORG & USERS
   ================================================================ */
export const partnerOrgs = [
  { id: CONFIG.PARTNER.orgId, name: CONFIG.PARTNER.name, code: 'P57-BLR' },
];

export const partnerUsers = [
  { id: 'partner-user-001', name: 'Ananya Deshmukh', partnerOrgId: CONFIG.PARTNER.orgId, role: 'partner' },
];

export const partnerNotifications = [];
export const payments = [];

/* ================================================================
   ADMIN USERS
   ================================================================ */
export const adminUsers = [
  { id: 'admin-001', name: 'Studio Administrator', role: 'admin' },
];

export const activityLog = [];
