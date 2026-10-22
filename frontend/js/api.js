// Base URL for the backend API and a shared fetch helper.
// Also exports shared skeleton-loader helpers used by every data page.

const BASE_URL = 'http://localhost:3001/api';

/**
 * Call the API and get back parsed JSON.
 *
 * @param {string} path   - path after /api, e.g. '/vehicles' or '/vehicles/1'
 * @param {object} [options] - { method, body } - body is JSON-encoded automatically
 * @returns {Promise<any>} the parsed JSON response
 * @throws {Error} with the server's message when the response is not ok
 */
async function apiFetch(path, { method = 'GET', body } = {}) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(BASE_URL + path, options);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || `Request failed (${response.status})`);
  }

  return data;
}

// Global Toast Notification Provider & Alert Helper
(function () {
  let container = null;

  function ensureContainer() {
    if (!container || !document.body.contains(container)) {
      container = document.createElement('div');
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(container);
    }
    return container;
  }

  const TOAST_ICONS = {
    success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    warning: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };

  const DEFAULT_TITLES = {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Information',
  };

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(messageOrOptions, maybeType = 'info', maybeOptions = {}) {
    let message = '';
    let type = 'info';
    let title = '';
    let duration = 4500;

    if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
      message = messageOrOptions.message || '';
      type = messageOrOptions.type || 'info';
      title = messageOrOptions.title || '';
      duration = messageOrOptions.duration ?? 4500;
    } else {
      message = String(messageOrOptions ?? '');
      type = typeof maybeType === 'string' ? maybeType : 'info';
      title = maybeOptions.title || '';
      duration = maybeOptions.duration ?? (type === 'error' ? 6000 : 4500);
    }

    if (!title) {
      title = DEFAULT_TITLES[type] || 'Notice';
    }

    const c = ensureContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const iconHtml = TOAST_ICONS[type] || TOAST_ICONS.info;
    toast.innerHTML = `
      ${iconHtml}
      <div class="toast-content">
        <div class="toast-title">${escapeHtml(title)}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
      </div>
      <button class="toast-close" type="button" aria-label="Dismiss notification">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    function dismiss() {
      if (toast.classList.contains('toast-hiding')) return;
      toast.classList.add('toast-hiding');
      setTimeout(() => {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
      }, 200);
    }

    toast.querySelector('.toast-close').addEventListener('click', dismiss);

    let timer = null;
    if (duration > 0) {
      timer = setTimeout(dismiss, duration);
      toast.addEventListener('mouseenter', () => clearTimeout(timer));
      toast.addEventListener('mouseleave', () => {
        timer = setTimeout(dismiss, 2000);
      });
    }

    c.appendChild(toast);
    return { dismiss };
  }

  showToast.success = (msg, title, opts) => showToast(msg, 'success', { title, ...opts });
  showToast.error = (msg, title, opts) => showToast(msg, 'error', { title, ...opts });
  showToast.warning = (msg, title, opts) => showToast(msg, 'warning', { title, ...opts });
  showToast.info = (msg, title, opts) => showToast(msg, 'info', { title, ...opts });

  window.showToast = showToast;

  window.showAlert = function (container, message, type = 'error', title = '') {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    if (!message) {
      el.innerHTML = '';
      el.hidden = true;
      return;
    }
    const icons = {
      success: '<svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
      warning: '<svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };
    el.className = `alert alert-${type}`;
    el.hidden = false;
    el.innerHTML = `
      ${icons[type] || icons.info}
      <div class="alert-body">
        ${title ? `<div class="alert-title">${escapeHtml(title)}</div>` : ''}
        <div class="alert-text">${escapeHtml(message)}</div>
      </div>
    `;
  };
})();

// ==========================================================================
// Shared Skeleton Loader Helpers
// Used by every data-loading page to show consistent shimmer placeholders
// while network requests are in flight.
// ==========================================================================

/**
 * Fills a <tbody> with skeleton shimmer rows while data loads.
 *
 * @param {HTMLElement} tbody    - the <tbody> element to fill
 * @param {number}      cols     - number of columns in the table
 * @param {number}      [rows=5] - number of skeleton rows to render
 */
window.showTableSkeleton = function showTableSkeleton(tbody, cols, rows = 5) {
  if (!tbody) return;
  tbody.replaceChildren();
  for (let r = 0; r < rows; r++) {
    const tr = document.createElement('tr');
    tr.className = 'skeleton-row';
    tr.setAttribute('aria-hidden', 'true');
    for (let c = 0; c < cols; c++) {
      const td = document.createElement('td');
      // Vary widths across cells and rows for a realistic look
      const widths = [55, 70, 45, 80, 60];
      const w = widths[(c + r) % widths.length];
      td.innerHTML = `<div class="skeleton-loader" style="width:${w}%; height: 14px; margin: 2px 0;"></div>`;
      tr.append(td);
    }
    tbody.append(tr);
  }
};

/**
 * Fills a list/card container with skeleton shimmer blocks while data loads.
 *
 * @param {HTMLElement} container - the list/div container to fill
 * @param {number}      [count=4] - number of skeleton blocks to render
 * @param {'card'|'row'} [style='card'] - visual variant
 */
window.showListSkeleton = function showListSkeleton(container, count = 4, style = 'card') {
  if (!container) return;
  container.replaceChildren();
  for (let i = 0; i < count; i++) {
    const el = document.createElement(style === 'card' ? 'div' : 'li');
    el.setAttribute('aria-hidden', 'true');
    if (style === 'card') {
      el.className = 'skeleton-card-block';
      el.innerHTML = `
        <div class="skeleton-line" style="width:40%; height:14px; margin-bottom:10px;"></div>
        <div class="skeleton-line" style="width:85%; height:12px; margin-bottom:6px;"></div>
        <div class="skeleton-line" style="width:65%; height:12px;"></div>
      `;
    } else {
      el.className = 'skeleton-list-item';
      el.innerHTML = `
        <div style="display:flex; gap:10px; align-items:center;">
          <div class="skeleton-box" style="width:32px; height:32px; border-radius:8px; flex-shrink:0;"></div>
          <div style="flex:1;">
            <div class="skeleton-line" style="width:55%; height:13px; margin-bottom:6px;"></div>
            <div class="skeleton-line" style="width:35%; height:11px;"></div>
          </div>
        </div>
      `;
    }
    container.append(el);
  }
};
