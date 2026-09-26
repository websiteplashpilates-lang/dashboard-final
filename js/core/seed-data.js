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
export const PHYSIQUE_57_WAIVER_TEXT = `CUSTOMER WAIVER — PHYSIQUE 57 / AMP FITNESS LLP

I confirm and declare that I am an adult of at least 18 years of age or am represented by an adult parent or guardian of at least 18 years of age and competent to contract and participate in this exercise class/ program. This informed consent is freely and voluntarily executed after fully understanding the contents thereof, not caused by coercion, undue influence, fraud, misinterpretation, or mistake and shall be binding upon me, my spouse, partner, parents /guardians, relatives, legal representatives, heirs, executors, administrators, successors and assignees. I confirm and declare that I am in adequate health to participate in any activities at the Studio(s) of AMP Fitness LLP and that I also do not have any illness, disease or other health condition which could potentially put me or anyone else at risk. I confirm and acknowledge that should this information or position change, it is my sole responsibility to promptly notify the instructors at the Studio(s) of AMP Fitness LLP.

In connection with my enrolment and participation in the exercise class / program organised by AMP Fitness, LLP (“AMP”) and use of the property, facilities and services provided to me by AMP (“Program”), I hereby, on behalf myself and my relatives, heirs, successors, executors and administrators, indemnify and agree to release, waive, discharge and agree and covenant to indemnify, release, waive, discharge and not to sue AMP, its designated partners, other partners, shareholders, directors, subsidiaries, affiliates, its and their licensees, licensors, successors, assigns, employees, officers, directors, consultants, service providers, agents, and contractors, and all persons, corporations, partnerships and other entities with which these entities may have become affiliated or may otherwise have dealings with at any time in the future, from any and all liability, claims, demands, actions and causes of action whatsoever arising out of or relating to any loss, expense, damages, injury, illnesses, diseases, disorders, conditions, disablement (whether partial, total, permanent or temporary), grievous bodily injury including death, that may be sustained by me, or to any property belonging to me, whether directly or indirectly caused to me by any person and on account of any reason whatsoever, whether by reason of due to my acts or omissions or by AMP or any of its instructors/ operators, or otherwise as a result of participating in the Program. I am voluntarily participating in the Program with full knowledge, understanding and appreciation of the risks inherent in any physical exercise and expressly assume all risks of injury, illnesses, diseases, disorders, conditions and even partial or permanent disablement and/or death which could occur by reason of my participation. I have disclosed all relevant information regarding my physical, medical, emotional or mental conditions that could cause harm to me or others by participating in this Program and I hereby expressly declare, confirm and state that I have neither at any time suffered nor currently suffer nor am I susceptible to suffering any form of health condition which prevents or could prevent me, in any manner whatsoever, from participating in the Program in the manner as required by AMP. I am executing this Release cum Indemnity Agreement after having viewed or having had the opportunity to view the site of AMP’s trial exercise classes; having reviewed the instructor’s qualifications; having had the scope of AMP’s classes and their associated risks fully explained to me; and after asking or having had an opportunity to ask questions regarding the classes and risks associated with AMP’s exercise classes. I hereby further declare, confirm and state that I have all the requisite qualifications and minimum fitness requirements to enable me to participate in the Program. I agree that my safety is primarily my own responsibility. I agree to make sure that I know how to safely participate in the Program, and I agree to observe any and all rules, codes, guidelines, procedures, manuals and practices that may be required to minimize the risk of injuries, illnesses, diseases, disorders, conditions and even partial or permanent disablement and/or death whether or not such rules, codes, guidelines, procedures, manuals and practices are specifically and/or expressly conveyed to me. I acknowledge that I am fully aware and conversant with the precautions that I am required to take in connection with any and all physical activities whilst partaking in the activities forming a part of the Program. I agree to stop and seek assistance if I do not believe I can safely continue with the activities involved in the Program, to limit my participation in the said Program to reflect my personal fitness level, and to refrain from any and all actions that would pose any form of hazard to myself or others in the Program. The services provided by AMP to me under the Program are on an is "as is” basis, without warranty of any kind, either expressed or implied, including without limitation any warranty for information services, coaching, uninterrupted access, or products and services provided through or in connection with the Program. All personal property carried by me and brought to AMP’s premises or the Program is brought at my sole risks and consequences and AMP shall not, in any manner whatsoever, be liable for any loss or damage caused to the same during the Program. I consent to AMP collecting, storing, possessing, dealing, disclosing, transferring and otherwise handling my personal information including sensitive personal data or information (“personal information”) for the purposes of my participating in the Programs. I agree to the terms of AMP’s Privacy Policy with regard to all matters pertaining to my personal information. I understand that personal information provided by me will be held confidential unless agreed otherwise in writing or as may be required by applicable law. Additionally, I understand that the use of technology is not always secure and I accept the risks involved in the transmission, exchange and storage of confidential and personal information in and through various electronic means, including but not limited to in the use of email, text, phones, video conferencing facilities and other technology. The terms of this Agreement are governed by the laws of India and shall be subject to the exclusive jurisdiction of the courts at Mumbai. Any dispute arising out of or in connection with this Agreement shall be referred to and finally resolved by arbitration in accordance with the Arbitration and Conciliation Act, 1996, and amendments thereto. The arbitration proceedings shall be conducted by a sole arbitrator to be mutually appointed by the parties. The seat, place and venue of the arbitration shall be Mumbai. The language of the arbitration shall be English only. This Release cum Indemnity Agreement shall be read in conjunction with the other application forms and documents executed between me and AMP in relation to the Program. By my signature below, I acknowledge that I have read and fully understood and accept the terms of this Release cum Indemnity Agreement and represent and agree that my signature is freely and knowingly given.

PHYSIQUE 57 MEMBERSHIP, PACKAGES & CLASS POLICIES:
-> Any personal property brought to Classes is brought at your sole risk as to its theft, damage, or loss. You agree that Physique 57 is in no way responsible for the safekeeping of your personal belongings while you attend Classes or are otherwise at a Physique 57 location.
-> All cancellations must be given in writing to info@physique57bengaluru.com 12 hours prior to the class booking. All cancellations outside of this time frame will be deducted from your class package.
-> Clients will be unable to join a Full or Express Studio Barre Class 10-Minutes past the scheduled start time; should this happen, this class will be deducted from your class package.
-> All Physique 57 Membership, Packages & Class Policies apply.
-> Payments can be made online via our app, using a valid credit or debit card.
-> All classes must be paid for in advance and are non-refundable.
-> Clients can pre-register for class up to one hour prior to the scheduled class time in order to reserve their space in class.
-> If the class is full, you will be placed on the waitlist; additions to the class from the waitlist will be on an 'double opt in' basis.
-> Instructor requests will be subject to availability.
-> Preferred date and class timings will be subject to availability.`;

export const PLASH_PILATES_WAIVER_TEXT = `PLASH PILATES STUDIO MEMBER LIABILITY WAIVER & PRIVACY POLICY

1. HEALTH & PHYSICAL READINESS DECLARATION
I declare and affirm that I am participating in physical exercise classes including Reformer Pilates, Mat Pilates, and Sculpt Yoga offered by Plash Pilates Studio voluntarily and of my own free will. I confirm that I am in adequate physical condition, have no undisclosed medical, spinal, orthopedic, cardiac, or chronic ailments that would make strenuous exercise hazardous, and have consulted a qualified medical physician where appropriate before undertaking any apparatus or resistance training.

2. ASSUMPTION OF RISK & LIABILITY RELEASE
I understand that Pilates and movement training involve inherent physical demands, resistance equipment (such as Reformers, springs, straps, towers, and weights), and potential risks of muscle strain, joint sprain, or bodily injury. I assume full personal responsibility for any injury, loss, or damage arising directly or indirectly from my participation in studio activities. I release, waive, and hold harmless Plash Pilates Studio, its founders, directors, employees, contracted instructors, and agents from any and all liability, claims, or damages, except where caused by gross negligence or willful misconduct.

3. STUDIO ETIQUETTE & SAFETY POLICIES
• Grip Socks: For hygiene and safety on Reformer carriages, grip socks are mandatory for all Pilates sessions.
• Punctuality: Clients arriving after the warm-up period (more than 5 minutes past class start) may be denied entry for safety reasons and the session credit forfeited.
• Studio Cancellations: Cancellation windows (12 hours for morning classes before 12:00 PM; 6 hours for evening classes) are strictly enforced to preserve studio spots for other members.
• Personal Belongings: Dedicated lockers are provided; however, Plash Pilates is not responsible for the loss, theft, or damage of personal items brought onto the premises.

4. PRIVACY POLICY & DATA HANDLING (DPDPA COMPLIANCE)
Plash Pilates respects your privacy and is committed to protecting your personal data in accordance with the Digital Personal Data Protection Act (DPDPA) and applicable Indian laws.
• Data Collected: We collect your name, contact information (email, mobile number, emergency contact), billing details, and relevant health/physical assessment declarations to safely administer classes and issue legal tax invoices under GST SAC 999723.
• Use of Information: Personal information is used strictly for membership administration, safety assessments, reservation reminders, and transaction receipts.
• Confidentiality: Health information shared with trainers is held strictly confidential and never shared with third-party marketers.
• Secure Storage: Member records and transaction histories are stored on secure, encrypted database infrastructure with strict role-based access control.`;

export const waivers = [
  {
    id: 'waiver-plash-1.0',
    version: '1.0',
    type: 'plash',
    title: 'Plash Pilates Studio Member Liability Waiver & Privacy Policy',
    content: PLASH_PILATES_WAIVER_TEXT,
    bodyText: PLASH_PILATES_WAIVER_TEXT,
    effectiveDate: '2026-01-01',
  },
  {
    id: 'waiver-p57-1.0',
    version: '1.0',
    type: 'barre',
    title: 'Physique 57 / AMP Fitness LLP Customer Waiver & Policies',
    content: PHYSIQUE_57_WAIVER_TEXT,
    bodyText: PHYSIQUE_57_WAIVER_TEXT,
    effectiveDate: '2026-01-01',
  },
  {
    id: 'waiver-combined-1.0',
    version: '1.0',
    type: 'combined',
    title: 'Dual Studio Waiver — Plash Pilates & Physique 57 Barre',
    content: `${PLASH_PILATES_WAIVER_TEXT}\n\n=========================================\n\n${PHYSIQUE_57_WAIVER_TEXT}`,
    bodyText: `${PLASH_PILATES_WAIVER_TEXT}\n\n=========================================\n\n${PHYSIQUE_57_WAIVER_TEXT}`,
    effectiveDate: '2026-01-01',
  },
  {
    id: 'waiver-001',
    version: '1.0',
    type: 'plash',
    title: 'Plash Pilates Studio Member Liability Waiver & Health Declaration',
    content: PLASH_PILATES_WAIVER_TEXT,
    bodyText: PLASH_PILATES_WAIVER_TEXT,
    effectiveDate: '2026-01-01',
  }
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
