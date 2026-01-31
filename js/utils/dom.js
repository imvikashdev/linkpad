/* ==========================================================================
   LINKPAD - DOM UTILITIES
   Common DOM manipulation helpers
   ========================================================================== */

/**
 * Query selector shorthand
 * @param {string} selector
 * @param {Element} context
 * @returns {Element|null}
 */
export function $(selector, context = document) {
  return context.querySelector(selector);
}

/**
 * Query selector all shorthand
 * @param {string} selector
 * @param {Element} context
 * @returns {NodeList}
 */
export function $$(selector, context = document) {
  return context.querySelectorAll(selector);
}

/**
 * Create a debounced version of a function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function}
 */
export function debounce(fn, delay = 300) {
  let timeoutId = null;

  return function (...args) {
    const context = this;

    clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      fn.apply(context, args);
    }, delay);
  };
}

/**
 * Create a throttled version of a function
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Minimum time between calls in ms
 * @returns {Function}
 */
export function throttle(fn, limit = 100) {
  let inThrottle = false;

  return function (...args) {
    const context = this;

    if (!inThrottle) {
      fn.apply(context, args);
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Copy text to clipboard
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const success = document.execCommand('copy');
    document.body.removeChild(textarea);

    return success;
  } catch (error) {
    console.error('Copy to clipboard failed:', error);
    return false;
  }
}

/**
 * Show a toast notification
 * @param {string} message
 * @param {string} type - 'success' | 'error' | 'info'
 * @param {number} duration - Duration in ms
 */
export function showToast(message, type = 'success', duration = 3000) {
  // Remove existing toast
  const existingToast = $('.copy-toast');
  if (existingToast) {
    existingToast.remove();
  }

  // Create new toast
  const toast = document.createElement('div');
  toast.className = `copy-toast ${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');

  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto-hide
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Get character count from HTML content
 * @param {string} html
 * @returns {number}
 */
export function getCharCount(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || '').length;
}

/**
 * Get word count from HTML content
 * @param {string} html
 * @returns {number}
 */
export function getWordCount(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  const text = div.textContent || '';
  const words = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  return words.length;
}

/**
 * Check if content is empty (ignoring whitespace and empty tags)
 * @param {string} html
 * @returns {boolean}
 */
export function isEmpty(html) {
  if (!html) return true;
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || '').trim().length === 0;
}
