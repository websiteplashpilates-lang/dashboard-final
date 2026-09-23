/**
 * Plash Pilates — Validation Utilities
 * Form validation with ARIA integration.
 * @module validate
 */

/**
 * Validate an email address.
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate an Indian phone number.
 * @param {string} phone
 * @returns {boolean}
 */
export function isValidPhone(phone) {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  return /^(\+91)?[6-9]\d{9}$/.test(cleaned);
}

/**
 * Check if a value is non-empty.
 * @param {*} value
 * @returns {boolean}
 */
export function isRequired(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== null && value !== undefined;
}

/**
 * Validate a form and set ARIA attributes.
 * @param {HTMLFormElement} formEl
 * @param {Object} rules - { fieldName: [{ validate: fn, message: string }] }
 * @returns {{ valid: boolean, errors: Object }}
 */
export function validateForm(formEl, rules) {
  const errors = {};
  let valid = true;

  for (const [fieldName, validators] of Object.entries(rules)) {
    const input = formEl.querySelector(`[name="${fieldName}"]`);
    if (!input) continue;

    // Clear previous errors
    input.removeAttribute('aria-invalid');
    const errorEl = formEl.querySelector(`[data-error-for="${fieldName}"]`);
    if (errorEl) errorEl.textContent = '';

    for (const { validate, message } of validators) {
      if (!validate(input.value)) {
        errors[fieldName] = message;
        valid = false;
        input.setAttribute('aria-invalid', 'true');
        if (errorEl) {
          errorEl.textContent = message;
          input.setAttribute('aria-describedby', errorEl.id);
        }
        break;
      }
    }
  }

  return { valid, errors };
}

/**
 * Clear all validation errors in a form.
 * @param {HTMLFormElement} formEl
 */
export function clearFormErrors(formEl) {
  formEl.querySelectorAll('[aria-invalid]').forEach(el => {
    el.removeAttribute('aria-invalid');
    el.removeAttribute('aria-describedby');
  });
  formEl.querySelectorAll('[data-error-for]').forEach(el => {
    el.textContent = '';
  });
}
