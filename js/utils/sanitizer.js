/* ==========================================================================
   LINKPAD - HTML SANITIZER
   Prevents XSS attacks by whitelisting allowed tags and attributes
   ========================================================================== */

/**
 * Allowed HTML tags for the editor
 */
const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'div',
  'span',
  'b',
  'strong',
  'i',
  'em',
  'u',
  'h1',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
]);

/**
 * Allowed attributes (only on specific tags)
 */
const ALLOWED_ATTRIBUTES = {
  // No attributes allowed by default for security
};

/**
 * Dangerous patterns to remove
 */
const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:/gi,
  /vbscript:/gi,
];

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param {string} html - Raw HTML string
 * @returns {string} - Sanitized HTML string
 */
export function sanitize(html) {
  if (!html || typeof html !== 'string') return '';

  // First pass: remove dangerous patterns
  let cleaned = html;
  for (const pattern of DANGEROUS_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Parse as DOM
  const parser = new DOMParser();
  const doc = parser.parseFromString(cleaned, 'text/html');

  // Recursively clean the document
  const cleanedBody = cleanNode(doc.body);

  return cleanedBody.innerHTML;
}

/**
 * Recursively clean a DOM node
 * @param {Node} node
 * @returns {Node}
 */
function cleanNode(node) {
  // Create a document fragment to hold clean nodes
  const fragment = document.createDocumentFragment();

  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      // Text nodes are safe
      fragment.appendChild(document.createTextNode(child.textContent));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tagName = child.tagName.toLowerCase();

      if (ALLOWED_TAGS.has(tagName)) {
        // Create a clean version of the element
        const cleanElement = document.createElement(tagName);

        // Copy allowed attributes
        const allowedAttrs = ALLOWED_ATTRIBUTES[tagName] || [];
        for (const attr of allowedAttrs) {
          if (child.hasAttribute(attr)) {
            const value = child.getAttribute(attr);
            // Additional validation for attribute values
            if (isAttributeValueSafe(attr, value)) {
              cleanElement.setAttribute(attr, value);
            }
          }
        }

        // Recursively clean children
        const cleanChildren = cleanNode(child);
        cleanElement.appendChild(cleanChildren);

        fragment.appendChild(cleanElement);
      } else {
        // For disallowed tags, keep the text content but remove the tag
        const cleanChildren = cleanNode(child);
        fragment.appendChild(cleanChildren);
      }
    }
  }

  // Create a container and append fragment
  const container = document.createElement('div');
  container.appendChild(fragment);

  return container;
}

/**
 * Check if an attribute value is safe
 * @param {string} attr
 * @param {string} value
 * @returns {boolean}
 */
function isAttributeValueSafe(attr, value) {
  if (!value) return true;

  const lowerValue = value.toLowerCase().trim();

  // Block dangerous URL schemes
  const dangerousSchemes = ['javascript:', 'data:', 'vbscript:'];
  for (const scheme of dangerousSchemes) {
    if (lowerValue.startsWith(scheme)) {
      return false;
    }
  }

  return true;
}

/**
 * Escape HTML entities in a string (for displaying raw text)
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Unescape HTML entities
 * @param {string} html
 * @returns {string}
 */
export function unescapeHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
}
