/**
 * TMS – announcements.js
 * Dedicated company bulletins and admin announcement broadcasts.
 */

const announcementsListEl = document.querySelector('#announcements-list');
const announcementsCountEl = document.querySelector('#announcements-count');
const openBroadcastModalBtn = document.querySelector('#open-broadcast-modal-btn');
const broadcastModal = document.querySelector('#broadcast-modal');
const broadcastForm = document.querySelector('#broadcast-form');
const broadcastModalClose = document.querySelector('#broadcast-modal-close');
const broadcastModalCancel = document.querySelector('#broadcast-modal-cancel');
const broadcastSubmitBtn = document.querySelector('#broadcast-submit-btn');
const broadcastAlert = document.querySelector('#broadcast-alert');

let userRole = null;
try {
  const user = JSON.parse(sessionStorage.getItem('tms.currentUser'));
  userRole = user?.role;
} catch (e) {
  console.error('Could not parse user:', e);
}

// Show broadcast action if user is admin
if (userRole === 'admin' && openBroadcastModalBtn) {
  openBroadcastModalBtn.style.display = 'inline-flex';
}

function formatDateTime(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getPriorityBadge(type) {
  const t = String(type || 'announcement').toLowerCase();
  if (t === 'alert') {
    return '<span class="badge badge-red" style="font-weight: 700; text-transform: uppercase; font-size: 0.7rem;">Urgent Alert</span>';
  }
  if (t === 'reminder') {
    return '<span class="badge badge-amber" style="font-weight: 700; text-transform: uppercase; font-size: 0.7rem;">Reminder</span>';
  }
  return '<span class="badge badge-teal" style="font-weight: 700; text-transform: uppercase; font-size: 0.7rem;">Announcement</span>';
}

function renderAnnouncements(items) {
  if (!announcementsListEl) return;
  announcementsListEl.replaceChildren();

  // Deduplicate announcements by message and close created_at timestamps if broadcast across multiple users
  const seen = new Set();
  const uniqueItems = [];

  for (const item of items) {
    const key = `${item.message}_${(item.created_at || '').slice(0, 16)}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueItems.push(item);
    }
  }

  if (uniqueItems.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'workspace-placeholder';
    emptyDiv.innerHTML = '<p style="margin: 0;">No active announcements at this time. Check back later for system bulletins.</p>';
    announcementsListEl.append(emptyDiv);
    if (announcementsCountEl) announcementsCountEl.textContent = '0 active announcements';
    return;
  }

  if (announcementsCountEl) {
    announcementsCountEl.textContent = `${uniqueItems.length} ${uniqueItems.length === 1 ? 'announcement' : 'announcements'}`;
  }

  for (const item of uniqueItems) {
    const card = document.createElement('div');
    const priority = String(item.type || 'announcement').toLowerCase();
    card.className = `announcement-card priority-${priority}`;

    card.innerHTML = `
      <div class="announcement-card-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          ${getPriorityBadge(item.type)}
          <span style="font-size: 0.75rem; color: var(--ink-faint); font-weight: 600;">System Broadcast</span>
        </div>
        <div class="announcement-meta">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--ink-faint);"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>${formatDateTime(item.created_at)}</span>
        </div>
      </div>
      <p class="announcement-body">
        ${escapeHtml(item.message || 'System bulletin')}
      </p>
    `;

    announcementsListEl.append(card);
  }
}

async function loadAnnouncements() {
  if (!announcementsListEl) return;
  if (window.showListSkeleton) {
    window.showListSkeleton(announcementsListEl, 4, 'card');
  } else {
    announcementsListEl.innerHTML = '<div class="workspace-placeholder"><p style="margin: 0;">Loading announcements…</p></div>';
  }

  try {
    const data = await apiFetch('/notifications');
    if (!Array.isArray(data)) {
      throw new Error('Invalid announcements API response.');
    }
    // Filter for announcements or broadcast notices
    const announcements = data.filter(n => n.type === 'announcement' || n.type === 'alert' || n.type === 'reminder');
    renderAnnouncements(announcements);
  } catch (error) {
    console.error('Could not load announcements:', error);
    announcementsListEl.innerHTML = `<div class="workspace-placeholder" style="color: var(--coral);"><p style="margin: 0;">Failed to load announcements: ${escapeHtml(error.message)}</p></div>`;
  }
}

// Dialog controls
if (openBroadcastModalBtn && broadcastModal) {
  openBroadcastModalBtn.addEventListener('click', () => {
    broadcastForm.reset();
    if (broadcastAlert) broadcastAlert.hidden = true;
    broadcastSubmitBtn.disabled = false;
    broadcastModal.showModal();
  });
}
if (broadcastModalClose && broadcastModal) {
  broadcastModalClose.addEventListener('click', () => broadcastModal.close());
}
if (broadcastModalCancel && broadcastModal) {
  broadcastModalCancel.addEventListener('click', () => broadcastModal.close());
}
if (broadcastModal) {
  broadcastModal.addEventListener('click', (e) => {
    if (e.target === broadcastModal) broadcastModal.close();
  });
}

// Form submission
if (broadcastForm) {
  broadcastForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (broadcastAlert) broadcastAlert.hidden = true;
    broadcastSubmitBtn.disabled = true;

    const formData = new FormData(broadcastForm);
    const body = {
      target: formData.get('target'),
      type: formData.get('type'),
      message: formData.get('message')?.trim(),
    };

    try {
      const res = await apiFetch('/notifications', {
        method: 'POST',
        body,
      });

      broadcastModal.close();
      broadcastForm.reset();
      await loadAnnouncements();

      if (window.showToast) {
        window.showToast.success(`Announcement broadcast successfully to ${res.recipientsCount || 'all'} recipients!`, 'Broadcast Dispatched');
      }
    } catch (err) {
      console.error('Could not send announcement:', err);
      broadcastSubmitBtn.disabled = false;
      if (window.showAlert) {
        window.showAlert('#broadcast-alert', err.message || 'Failed to dispatch announcement.', 'error');
      }
      if (window.showToast) {
        window.showToast.error(err.message || 'Could not send announcement.', 'Broadcast Failed');
      }
    }
  });
}

loadAnnouncements();

