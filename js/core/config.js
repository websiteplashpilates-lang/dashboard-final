/**
 * Plash Pilates — Configuration
 * All configurable constants for the application.
 * @module config
 */

export const CONFIG = {
  /** Date after which First Circle pricing is no longer offered */
  FIRST_CIRCLE_CUTOFF: '2026-04-11',

  /** Hours before class start that cancellation is blocked for morning sessions (< 12:00 PM IST) */
  CANCELLATION_WINDOW_MORNING_HOURS: 12,

  /** Hours before class start that cancellation is blocked for evening sessions (>= 12:00 PM IST) */
  CANCELLATION_WINDOW_EVENING_HOURS: 6,

  /** Default/backward-compatible cancellation window in hours */
  CANCELLATION_WINDOW_HOURS: 6,

  /** Hours before an unapproved Barre booking auto-expires */
  BARRE_APPROVAL_EXPIRY_HOURS: 48,

  /** Max members per class */
  CAPACITY_PER_CLASS: 6,

  /** Data retention period in months (DPDPA compliance) */
  DATA_RETENTION_MONTHS: 24,

  /** Current waiver version */
  WAIVER_VERSION: '1.0',

  /** Studio details */
  STUDIO: {
    name: 'Plash Pilates',
    tagline: 'Private sanctuary of strength and elegance',
    gstin: '29ABIFP5917A1Z7',
    address: '2nd Floor, No. 8, 1st Main Road, Sadashiva Nagar, Bengaluru 560080',
    phone: '+91 XXXXX XXXXX',
    email: 'hello@plashpilates.com',
    whatsapp: '+91 XXXXX XXXXX',
    hours: {
      weekday: '6:00 AM - 8:00 PM',
      saturday: '7:00 AM - 6:00 PM',
      sunday: '8:00 AM - 12:00 PM',
    },
    concierge: {
      name: 'Studio Concierge',
      phone: '+91 XXXXX XXXXX',
      email: 'concierge@plashpilates.com',
    },
  },

  /** Partner studio */
  PARTNER: {
    name: 'Physicq 57',
    orgId: 'partner-physicq57',
  },

  /** Discipline IDs (stable references) */
  DISCIPLINES: {
    PILATES: 'disc-pilates',
    BARRE: 'disc-barre',
    SCULPT_YOGA: 'disc-sculpt-yoga',
  },

  /** Supabase Project Configuration (injected via environment / /api/public-config) */
  SUPABASE: {
    URL: (typeof window !== 'undefined' && (window.PLASH_SUPABASE_URL || localStorage.getItem('plash_supabase_url'))) || '',
    ANON_KEY: (typeof window !== 'undefined' && (window.PLASH_SUPABASE_ANON_KEY || localStorage.getItem('plash_supabase_anon_key'))) || '',
  },

  /** Razorpay Gateway Configuration (loaded at runtime from environment / /api/public-config) */
  RAZORPAY: {
    KEY_ID: (typeof window !== 'undefined' && (window.PLASH_RAZORPAY_KEY || localStorage.getItem('plash_razorpay_key'))) || '',
    NAME: 'Plash Pilates Studio',
    THEME_COLOR: '#934b2d',
  },
};
