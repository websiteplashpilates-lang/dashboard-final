/**
 * Plash Pilates — DOM Utilities
 * Safe DOM manipulation helpers (XSS-prevention).
 * @module dom
 */

/**
 * Create an HTML element with attributes and children.
 * All text is set via textContent (XSS-safe).
 * @param {string} tag
 * @param {Object} [attrs] - { class, id, 'aria-label', textContent, innerHTML (only for trusted static HTML), ... }
 * @param {Array<HTMLElement|string>} [children]
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, children = []) {
  return createElement(tag, attrs, children);
}

/**
 * Create an HTML element with attributes, styles, and children (XSS-safe).
 * @param {string} tag
 * @param {Object} [options]
 * @param {Array<HTMLElement|string>} [children]
 * @returns {HTMLElement}
 */
export function createElement(tag, options = {}, children = []) {
  if (typeof document === 'undefined') return {};
  const element = document.createElement(tag);

  if (typeof options === 'string') {
    element.className = options;
  } else if (options) {
    if (options.className) element.className = options.className;
    if (options.class) element.className = options.class;
    if (options.id) element.id = options.id;
    if (options.text) element.textContent = options.text;
    if (options.textContent) element.textContent = options.textContent;
    if (options.html) element.innerHTML = options.html;
    if (options.innerHTML) element.innerHTML = options.innerHTML;
    if (options.style) {
      if (typeof options.style === 'string') {
        element.style.cssText = options.style;
      } else if (typeof options.style === 'object') {
        Object.assign(element.style, options.style);
      }
    }
    if (options.attributes) {
      for (const [k, v] of Object.entries(options.attributes)) {
        if (v !== null && v !== undefined && v !== false) {
          element.setAttribute(k, v);
        }
      }
    }
    if (options.events && typeof options.events === 'object') {
      for (const [evt, handler] of Object.entries(options.events)) {
        if (typeof handler === 'function') {
          element.addEventListener(evt, handler);
        }
      }
    }
    for (const [key, value] of Object.entries(options)) {
      if (['className', 'class', 'id', 'text', 'textContent', 'html', 'innerHTML', 'style', 'attributes', 'children', 'events'].includes(key)) continue;
      if (key.startsWith('on') && typeof value === 'function') {
        element.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (value !== null && value !== undefined && value !== false) {
        element.setAttribute(key, value);
      }
    }
  }

  const childList = options && options.children ? options.children : children;
  if (Array.isArray(childList)) {
    for (const child of childList) {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child && typeof child === 'object' && typeof child.nodeType === 'number') {
        element.appendChild(child);
      }
    }
  }

  return element;
}

/**
 * Clear all children from an element.
 * @param {HTMLElement} element
 */
export function clearChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

/**
 * Append multiple children to a parent.
 * @param {HTMLElement} parent
 * @param {...(HTMLElement|string)} children
 */
export function appendTo(parent, ...children) {
  for (const child of children) {
    if (typeof child === 'string') {
      parent.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      parent.appendChild(child);
    }
  }
}

/**
 * Set safe innerHTML for trusted static content only.
 * @param {HTMLElement} element
 * @param {string} html - MUST be trusted/static content
 */
export function setTrustedHTML(element, html) {
  element.innerHTML = html;
}

/**
 * Create an SVG icon element (from Lucide CDN).
 * @param {string} name - Lucide icon name
 * @param {number} [size=18]
 * @param {string} [className='']
 * @returns {HTMLElement}
 */
export function icon(name, size = 18, className = '') {
  const i = document.createElement('i');
  i.setAttribute('data-lucide', name);
  i.style.width = `${size}px`;
  i.style.height = `${size}px`;
  if (className) i.className = className;
  return i;
}

/**
 * Render Lucide icons in a container.
 * Call after adding icon elements to DOM.
 * @param {HTMLElement} [container=document]
 */
export function renderIcons(container) {
  if (window.lucide) {
    window.lucide.createIcons({ attrs: { 'stroke-width': 1.75 }, nameAttr: 'data-lucide' });
  }
}

/**
 * Create a fragment from multiple elements.
 * @param {...HTMLElement} elements
 * @returns {DocumentFragment}
 */
export function fragment(...elements) {
  const frag = document.createDocumentFragment();
  elements.forEach(el => { if (el instanceof Node) frag.appendChild(el); });
  return frag;
}

/**
 * Safely escape special HTML characters to prevent XSS.
 * @param {*} str
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitize text for safe display.
 * @param {*} str
 * @returns {string}
 */
export function sanitize(str) {
  return escapeHtml(str);
}

