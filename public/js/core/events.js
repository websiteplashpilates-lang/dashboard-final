/**
 * Plash Pilates — Event Bus
 * Decoupled event system for module communication.
 * @module events
 */

/** @type {Map<string, Set<Function>>} */
const listeners = new Map();

export const events = {
  /**
   * Subscribe to an event.
   * @param {string} event - Event name
   * @param {Function} handler - Callback function
   */
  on(event, handler) {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event).add(handler);
  },

  /**
   * Unsubscribe from an event.
   * @param {string} event - Event name
   * @param {Function} handler - Callback to remove
   */
  off(event, handler) {
    if (listeners.has(event)) {
      listeners.get(event).delete(handler);
    }
  },

  /**
   * Emit an event with optional data.
   * @param {string} event - Event name
   * @param {*} [data] - Payload
   */
  emit(event, data) {
    if (listeners.has(event)) {
      listeners.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (err) {
          console.error(`Event handler error [${event}]:`, err);
        }
      });
    }
  },

  /**
   * Subscribe to an event, auto-unsubscribe after first fire.
   * @param {string} event
   * @param {Function} handler
   */
  once(event, handler) {
    const wrapper = (data) => {
      events.off(event, wrapper);
      handler(data);
    };
    events.on(event, wrapper);
  },
};

/* ---- Event name constants ---- */
export const EVENT = {
  AUTH_ROLE_CHANGED:    'auth:role-changed',
  AUTH_MEMBER_CHANGED:  'auth:member-changed',
  BOOKING_CREATED:      'booking:created',
  BOOKING_CANCELLED:    'booking:cancelled',
  BOOKING_APPROVED:     'booking:approved',
  BOOKING_DECLINED:     'booking:declined',
  PACKAGE_PURCHASED:    'package:purchased',
  PAUSE_REQUESTED:      'pause:requested',
  PAUSE_APPROVED:       'pause:approved',
  PAUSE_REJECTED:       'pause:rejected',
  CONSENT_UPDATED:      'consent:updated',
  TOAST_SHOW:           'toast:show',
  ROUTE_CHANGED:        'route:changed',
  PROFILE_UPDATED:      'profile:updated',
  DATA_MUTATED:         'data:mutated',
};
