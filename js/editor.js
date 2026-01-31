/* ==========================================================================
   LINKPAD - EDITOR APPLICATION (Minimal Design with Slash Commands)
   ========================================================================== */

import {
  compress,
  decompress,
  isCompressionSupported,
} from './utils/compression.js';
import { sanitize } from './utils/sanitizer.js';
import {
  $,
  debounce,
  copyToClipboard,
  showToast,
  getWordCount,
  getCharCount,
  isEmpty,
} from './utils/dom.js';

/**
 * Editor state
 */
const state = {
  isSaving: false,
  lastSaved: null,
  hasUnsavedChanges: false,
  slashMenuOpen: false,
  slashMenuIndex: 0,
  slashTriggered: false, // Track if "/" was typed to trigger menu
  pendingFontSize: null, // Font size to apply to newly typed text
};

/**
 * Slash command definitions
 */
const slashCommands = [
  { action: 'paragraph', label: 'Normal Text', format: () => formatBlock('p') },
  { action: 'heading-1', label: 'Heading 1', format: () => formatBlock('h1') },
  { action: 'heading-2', label: 'Heading 2', format: () => formatBlock('h2') },
  { action: 'heading-3', label: 'Heading 3', format: () => formatBlock('h3') },
  { action: 'heading-4', label: 'Heading 4', format: () => formatBlock('h4') },
  { action: 'bold', label: 'Bold', format: () => formatText('bold') },
  { action: 'italic', label: 'Italic', format: () => formatText('italic') },
  {
    action: 'underline',
    label: 'Underline',
    format: () => formatText('underline'),
  },
  {
    action: 'list-unordered',
    label: 'Bullet List',
    format: () => formatText('insertUnorderedList'),
  },
  {
    action: 'list-ordered',
    label: 'Numbered List',
    format: () => formatText('insertOrderedList'),
  },
  { action: 'quote', label: 'Quote', format: () => formatBlock('blockquote') },
];

/**
 * Font sizes available in dropdown
 */
const fontSizes = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64];

/**
 * DOM Elements
 */
let editor;
let statusIndicator;
let statusText;
let wordCountEl;
let charCountEl;
let slashMenu;
let fontSizeSelect;

/**
 * Initialize the editor
 */
export function initEditor() {
  // Check compression support
  if (!isCompressionSupported()) {
    showToast(
      'Your browser does not support compression. Please use a modern browser.',
      'error',
      5000,
    );
    return;
  }

  // Cache DOM elements
  editor = $('#editor');
  statusIndicator = $('#status-indicator');
  statusText = $('#status-text');
  wordCountEl = $('#word-count');
  charCountEl = $('#char-count');
  slashMenu = $('#slash-menu');
  fontSizeSelect = $('#font-size-select');

  if (!editor) {
    console.error('Editor element not found');
    return;
  }

  // Initialize event listeners
  initEventListeners();

  // Initialize theme
  initTheme();

  // Load content from URL hash
  loadFromHash();

  // Update stats
  updateStats();

  console.log('LinkPad Editor initialized');
}

/**
 * Set up event listeners
 */
function initEventListeners() {
  // Auto-save on input with debounce
  const debouncedSave = debounce(async () => {
    await saveToHash();
  }, 500);

  editor.addEventListener('input', () => {
    state.hasUnsavedChanges = true;
    updateStatus('saving');
    updateStats();
    debouncedSave();
  });

  // Apply pending font size to newly typed text
  editor.addEventListener('beforeinput', (e) => {
    if (state.pendingFontSize && e.inputType === 'insertText' && e.data) {
      e.preventDefault();

      // Insert the text wrapped in a span with the pending font size
      const span = document.createElement('span');
      span.style.fontSize = `${state.pendingFontSize}px`;
      span.textContent = e.data;

      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(span);

        // Move cursor after the inserted span
        range.setStartAfter(span);
        range.setEndAfter(span);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      // Trigger input event manually for save handling
      state.hasUnsavedChanges = true;
      updateStatus('saving');
      updateStats();
      debouncedSave();
    }
  });

  // Slash command trigger
  editor.addEventListener('keydown', handleEditorKeydown);

  // Handle paste - sanitize pasted content
  editor.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');

    // If pending font size, wrap pasted text
    if (state.pendingFontSize) {
      const span = document.createElement('span');
      span.style.fontSize = `${state.pendingFontSize}px`;
      span.textContent = text;

      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(span);
        range.setStartAfter(span);
        range.setEndAfter(span);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } else {
      document.execCommand('insertText', false, text);
    }
  });

  // Slash menu button clicks
  if (slashMenu) {
    slashMenu.addEventListener('click', (e) => {
      const btn = e.target.closest('.slash-menu__btn');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        const action = btn.dataset.action;

        // Size buttons don't close the menu
        if (action === 'size-decrease' || action === 'size-increase') {
          handleSizeChange(action === 'size-increase' ? 1 : -1);
          return;
        }

        executeSlashCommand(action, true);
      }
    });

    // Font size select change
    if (fontSizeSelect) {
      fontSizeSelect.addEventListener('change', (e) => {
        e.stopPropagation();
        const size = parseInt(e.target.value, 10);
        applyFontSize(size);
        editor.focus();
      });

      // Prevent select from closing menu
      fontSizeSelect.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
  }

  // Close slash menu on click outside
  document.addEventListener('mousedown', (e) => {
    if (state.slashMenuOpen && !slashMenu.contains(e.target)) {
      hideSlashMenu();
    }
  });

  // Global keydown for Escape to close toolbar
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.slashMenuOpen) {
      e.preventDefault();
      hideSlashMenu();
      editor.focus();
    }
  });

  // Show toolbar when text is selected in editor
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();

    // Check if selection is within the editor
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const isInEditor = editor.contains(range.commonAncestorContainer);

    if (!isInEditor) {
      // If selection is outside editor and menu is open, close it
      if (state.slashMenuOpen && !slashMenu.contains(document.activeElement)) {
        hideSlashMenu();
      }
      return;
    }

    // Update font size dropdown to reflect current text size at cursor
    updateFontSizeDropdown();

    // If text is selected (not just cursor), show toolbar
    if (!range.collapsed && selection.toString().trim().length > 0) {
      // Only show if not already triggered by slash
      if (!state.slashTriggered) {
        showSlashMenuAtSelection();
      }
    } else if (state.slashMenuOpen && !state.slashTriggered) {
      // If selection collapsed and menu was opened by selection (not slash), hide it
      hideSlashMenu();
    }
  });

  // Header action buttons
  const undoBtn = $('#undo-btn');
  const redoBtn = $('#redo-btn');
  const copyBtn = $('#copy-link-btn');
  const newBtn = $('#new-note-btn');

  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      document.execCommand('undo');
      editor.focus();
    });
  }

  if (redoBtn) {
    redoBtn.addEventListener('click', () => {
      document.execCommand('redo');
      editor.focus();
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      await copyLink();
    });
  }

  if (newBtn) {
    newBtn.addEventListener('click', () => {
      newNote();
    });
  }

  // Handle browser back/forward
  window.addEventListener('hashchange', () => {
    loadFromHash();
  });

  // Warn before leaving with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (state.hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

/**
 * Handle keydown in editor
 */
function handleEditorKeydown(e) {
  // Handle Tab key - insert tab character instead of changing focus
  if (e.key === 'Tab') {
    e.preventDefault();
    document.execCommand('insertText', false, '\t');
    return;
  }

  // Open slash menu on "/"
  if (e.key === '/' && !state.slashMenuOpen) {
    // Small delay to let "/" be inserted first
    state.slashTriggered = true;
    setTimeout(() => {
      showSlashMenu();
    }, 10);
    return;
  }

  // Handle slash menu navigation when open
  if (state.slashMenuOpen) {
    const btns = slashMenu.querySelectorAll('.slash-menu__btn');

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        state.slashMenuIndex = (state.slashMenuIndex + 1) % btns.length;
        updateSlashMenuSelection();
        break;

      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        state.slashMenuIndex =
          (state.slashMenuIndex - 1 + btns.length) % btns.length;
        updateSlashMenuSelection();
        break;

      case 'Enter':
        e.preventDefault();
        const activeBtn = btns[state.slashMenuIndex];
        if (activeBtn) {
          const action = activeBtn.dataset.action;
          // Size buttons don't close the menu - handle like mouse click
          if (action === 'size-decrease' || action === 'size-increase') {
            handleSizeChange(action === 'size-increase' ? 1 : -1);
          } else {
            executeSlashCommand(action, true);
          }
        }
        break;

      case 'Escape':
        e.preventDefault();
        hideSlashMenu();
        break;

      case 'Backspace':
        // If slash was deleted, close menu
        setTimeout(() => {
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const textBefore =
              range.startContainer.textContent?.slice(0, range.startOffset) ||
              '';
            if (!textBefore.endsWith('/')) {
              hideSlashMenu();
            }
          }
        }, 10);
        break;
    }
  }
}

/**
 * Show slash command menu at cursor position
 */
function showSlashMenu() {
  if (!slashMenu) return;

  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // Position menu below cursor
  const menuTop = rect.bottom + 8;
  const menuLeft = rect.left;

  // Ensure menu stays within viewport
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  slashMenu.style.top = `${Math.min(menuTop, viewportHeight - 320)}px`;
  slashMenu.style.left = `${Math.min(menuLeft, viewportWidth - 220)}px`;

  slashMenu.hidden = false;
  state.slashMenuOpen = true;
  state.slashMenuIndex = 0;
  updateSlashMenuSelection();

  // Re-render icons in menu
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/**
 * Show slash menu positioned at current text selection (floating above selection)
 */
function showSlashMenuAtSelection() {
  if (!slashMenu) return;
  if (state.slashMenuOpen) return; // Already open

  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // Position menu above the selection
  const menuHeight = 50; // Approximate height of toolbar
  let menuTop = rect.top - menuHeight - 8;
  let menuLeft = rect.left;

  // If would go off top of screen, position below instead
  if (menuTop < 10) {
    menuTop = rect.bottom + 8;
  }

  // Ensure menu stays within viewport horizontally
  const viewportWidth = window.innerWidth;
  if (menuLeft + 400 > viewportWidth) {
    menuLeft = viewportWidth - 400 - 20;
  }
  if (menuLeft < 10) {
    menuLeft = 10;
  }

  slashMenu.style.top = `${menuTop}px`;
  slashMenu.style.left = `${menuLeft}px`;

  slashMenu.hidden = false;
  state.slashMenuOpen = true;
  state.slashMenuIndex = 0;
  updateSlashMenuSelection();

  // Re-render icons in menu
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/**
 * Hide slash command menu
 */
function hideSlashMenu() {
  if (!slashMenu) return;
  slashMenu.hidden = true;
  state.slashMenuOpen = false;
}

/**
 * Update visual selection in slash menu
 */
function updateSlashMenuSelection() {
  const btns = slashMenu.querySelectorAll('.slash-menu__btn');
  btns.forEach((btn, index) => {
    if (index === state.slashMenuIndex) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * Execute a slash command
 * @param {string} action - The action to execute
 * @param {boolean} removeSlash - Whether to remove the "/" character
 */
function executeSlashCommand(action, removeSlash = false) {
  hideSlashMenu();

  // Only remove the "/" character if it was typed to trigger the menu and a command was selected
  if (removeSlash && state.slashTriggered) {
    document.execCommand('delete', false, null);
  }

  // Reset the slash triggered state
  state.slashTriggered = false;

  // Find and execute the command
  const cmd = slashCommands.find((c) => c.action === action);
  if (cmd) {
    cmd.format();
  }

  editor.focus();
}

/**
 * Format text using execCommand
 */
function formatText(command) {
  document.execCommand(command, false, null);
}

/**
 * Format block element
 */
function formatBlock(tag) {
  document.execCommand('formatBlock', false, `<${tag}>`);
}

/**
 * Handle size increment/decrement
 */
function handleSizeChange(direction) {
  if (!fontSizeSelect) return;

  const currentIndex = fontSizes.indexOf(parseInt(fontSizeSelect.value, 10));
  const newIndex = Math.max(
    0,
    Math.min(fontSizes.length - 1, currentIndex + direction),
  );
  const newSize = fontSizes[newIndex];

  fontSizeSelect.value = newSize;
  applyFontSize(newSize);

  // Update tooltips to show next size
  updateSizeButtonTooltips(newIndex);

  editor.focus();
}

/**
 * Apply font size to selected text
 */
function applyFontSize(size) {
  // Focus the editor first
  editor.focus();

  // Check if there's a selection
  const selection = window.getSelection();
  if (!selection.rangeCount) {
    // No selection at all - set pending size for next typed text
    state.pendingFontSize = size;
    showToast(`Font size set to ${size}px for new text`, 'info', 2000);
    return;
  }

  const range = selection.getRangeAt(0);

  // If no text selected (cursor only), set pending size for next typed text
  if (range.collapsed) {
    state.pendingFontSize = size;
    showToast(`Font size set to ${size}px for new text`, 'info', 2000);
    return;
  }

  // Apply to selected text
  // Use execCommand fontSize (1-7 scale) then replace with our custom size
  document.execCommand('fontSize', false, '7');

  // Find all font elements with size 7 and replace with our custom size
  const fonts = editor.querySelectorAll('font[size="7"]');
  fonts.forEach((font) => {
    // Create a span with proper styling
    const span = document.createElement('span');
    span.style.fontSize = `${size}px`;
    span.innerHTML = font.innerHTML;
    font.parentNode.replaceChild(span, font);

    // If the span is inside a list item, apply font-size to the li too
    // so the marker inherits the size
    const li = span.closest('li');
    if (li) {
      li.style.fontSize = `${size}px`;
    }
  });

  // Clear any pending font size since we applied directly
  state.pendingFontSize = null;

  // Update the save status since content changed
  state.hasUnsavedChanges = true;
}

/**
 * Update size button tooltips
 */
function updateSizeButtonTooltips(currentIndex) {
  const decreaseBtn = document.getElementById('size-decrease-btn');
  const increaseBtn = document.getElementById('size-increase-btn');

  if (decreaseBtn) {
    const prevSize =
      currentIndex > 0 ? fontSizes[currentIndex - 1] : fontSizes[0];
    decreaseBtn.dataset.tooltip = `Decrease to ${prevSize}px`;
  }

  if (increaseBtn) {
    const nextSize =
      currentIndex < fontSizes.length - 1
        ? fontSizes[currentIndex + 1]
        : fontSizes[fontSizes.length - 1];
    increaseBtn.dataset.tooltip = `Increase to ${nextSize}px`;
  }
}

/**
 * Update font size dropdown to reflect current text size at cursor
 */
function updateFontSizeDropdown() {
  if (!fontSizeSelect) return;

  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  let node = range.startContainer;

  // If text node, get parent element
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }

  if (!node || !editor.contains(node)) return;

  // Get computed font-size at cursor position
  const computedStyle = window.getComputedStyle(node);
  const fontSize = parseFloat(computedStyle.fontSize);

  if (fontSize && !isNaN(fontSize)) {
    // Round to nearest available size
    const roundedSize = fontSizes.reduce((prev, curr) =>
      Math.abs(curr - fontSize) < Math.abs(prev - fontSize) ? curr : prev,
    );

    // Update dropdown if different
    if (parseInt(fontSizeSelect.value, 10) !== roundedSize) {
      fontSizeSelect.value = roundedSize;

      // Update tooltips
      const currentIndex = fontSizes.indexOf(roundedSize);
      updateSizeButtonTooltips(currentIndex);
    }
  }
}

/**
 * Save content to URL hash
 */
async function saveToHash() {
  if (state.isSaving) return;

  state.isSaving = true;
  updateStatus('saving');

  try {
    const content = editor.innerHTML;

    if (isEmpty(content)) {
      history.replaceState(null, '', window.location.pathname);
      state.hasUnsavedChanges = false;
      updateStatus('saved');
      state.isSaving = false;
      return;
    }

    const compressed = await compress(content);
    history.replaceState(null, '', `#${compressed}`);

    state.hasUnsavedChanges = false;
    state.lastSaved = new Date();
    updateStatus('saved');
  } catch (error) {
    console.error('Save failed:', error);
    updateStatus('error');
    showToast('Failed to save. Please try again.', 'error');
  }

  state.isSaving = false;
}

/**
 * Load content from URL hash
 */
async function loadFromHash() {
  const hash = window.location.hash.slice(1);

  if (!hash) {
    // Show demo content when no saved content exists
    editor.innerHTML = getDemoContent();
    updateStats();
    return;
  }

  try {
    const content = await decompress(hash);
    const sanitizedContent = sanitize(content);
    editor.innerHTML = sanitizedContent;
    updateStats();
    updateStatus('saved');
  } catch (error) {
    console.error('Load failed:', error);
    showToast(
      'Failed to load content. The link may be corrupted.',
      'error',
      5000,
    );
    editor.innerHTML = '';
  }
}

/**
 * Copy current URL to clipboard
 */
async function copyLink() {
  if (state.hasUnsavedChanges) {
    await saveToHash();
  }

  const url = window.location.href;
  const success = await copyToClipboard(url);

  if (success) {
    showToast('Link copied to clipboard!', 'success');
  } else {
    showToast('Failed to copy. Please copy the URL manually.', 'error');
  }
}

/**
 * Create a new empty note
 */
function newNote() {
  if (state.hasUnsavedChanges) {
    const confirm = window.confirm(
      'You have unsaved changes. Create new note anyway?',
    );
    if (!confirm) return;
  }

  editor.innerHTML = '';
  history.replaceState(null, '', window.location.pathname);
  state.hasUnsavedChanges = false;
  updateStats();
  updateStatus('saved');
  editor.focus();
}

/**
 * Update status indicator
 */
function updateStatus(status) {
  if (!statusIndicator || !statusText) return;

  statusIndicator.classList.remove('saving', 'saved', 'error');

  switch (status) {
    case 'saving':
      statusIndicator.classList.add('saving');
      statusText.textContent = 'Saving...';
      break;
    case 'saved':
      statusIndicator.classList.add('saved');
      statusText.textContent = 'Saved';
      break;
    case 'error':
      statusIndicator.classList.add('error');
      statusText.textContent = 'Error';
      break;
  }
}

/**
 * Update word/character counts
 */
function updateStats() {
  const content = editor.innerHTML;

  if (wordCountEl) {
    wordCountEl.textContent = getWordCount(content);
  }

  if (charCountEl) {
    charCountEl.textContent = getCharCount(content);
  }
}

/**
 * Initialize theme toggle
 */
function initTheme() {
  const toggle = $('#theme-toggle');
  if (!toggle) return;

  const savedTheme = localStorage.getItem('linkpad-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme === 'light' || (!savedTheme && !prefersDark)) {
    document.body.classList.add('light-mode');
  }

  toggle.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('linkpad-theme', isLight ? 'light' : 'dark');

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  });
}

/**
 * Get demo content to showcase all editor features
 */
function getDemoContent() {
  return `
<h1>Welcome to LinkPad! 🎉</h1>
<p>A minimal, shareable notepad that lives in your URL. <strong>No sign-up required.</strong></p>

<h2>Getting Started</h2>
<p>Select any text to see the <strong>formatting toolbar</strong>, or type <strong>/</strong> to open it anywhere.</p>

<h3>Text Formatting</h3>
<p>Make text <strong>bold</strong>, <em>italic</em>, or <u>underlined</u> with a single click.</p>

<h3>Font Sizes</h3>
<p>Use the <span style="font-size: 14px;">size dropdown</span> to adjust text size from <span style="font-size: 10px;">tiny (10px)</span> to <span style="font-size: 32px;">large (32px)</span>.</p>

<h4>Lists</h4>
<ul>
  <li>Bullet points for unordered items</li>
  <li>Great for quick notes</li>
  <li>Easy to organize thoughts</li>
</ul>

<ol>
  <li>Numbered lists for sequences</li>
  <li>Perfect for step-by-step guides</li>
  <li>Auto-numbered for convenience</li>
</ol>

<h4>Quotes</h4>
<blockquote>Use blockquotes to highlight important information or cite sources. They add visual emphasis to key points.</blockquote>

<h2>How It Works</h2>
<p>Your content is <strong>compressed</strong> and stored right in the URL. Simply <strong>copy the link</strong> to save and share!</p>

<h3>Pro Tips</h3>
<ul>
  <li>Press <strong>Tab</strong> to indent</li>
  <li>Press <strong>Escape</strong> to close the toolbar</li>
  <li>Click anywhere to position cursor, then set font size for new text</li>
</ul>

<p><em>Start typing below to create your own note...</em></p>
<p></p>
`;
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEditor);
} else {
  initEditor();
}
