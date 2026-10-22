// Toast Provider & In-Page Alert System
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

