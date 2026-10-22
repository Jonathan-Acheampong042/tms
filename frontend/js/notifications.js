/**
 * TMS – notifications.js
 * User notification feed, activity alerts, and reminder updates.
 */

let allNotifications = [];

const notifListEl = document.querySelector('#notifications-list');
const notifCountEl = document.querySelector('#notifications-count');
const markAllReadBtn = document.querySelector('#mark-all-read-btn');

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

function getTypeBadge(type) {
  const t = String(type || 'info').toLowerCase();
  const map = {
    announcement: 'badge-violet',
    reminder: 'badge-amber',
    alert: 'badge-red',
    info: 'badge-blue',
  };
  const cls = map[t] || 'badge-gray';
  return `<span class="badge ${cls}" style="text-transform: uppercase; font-size: 0.68rem;">${t}</span>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderNotifications(items) {
  if (!notifListEl) return;
  notifListEl.replaceChildren();

  // Filter out announcements so this feed is dedicated strictly to personal/activity notifications
  const userNotifs = items.filter(n => n.type !== 'announcement');

  if (userNotifs.length === 0) {
    const li = document.createElement('li');
    li.className = 'workspace-placeholder';
    li.innerHTML = '<p style="margin: 0;">No personal notifications right now. System updates will appear here.</p>';
    notifListEl.append(li);
    if (notifCountEl) notifCountEl.textContent = 'All caught up';
    if (markAllReadBtn) markAllReadBtn.disabled = true;
    return;
  }

  const unreadCount = userNotifs.filter(n => !n.is_read).length;
  if (notifCountEl) {
    notifCountEl.textContent = unreadCount > 0
      ? `${unreadCount} unread ${unreadCount === 1 ? 'notification' : 'notifications'}`
      : 'All notifications caught up';
  }
  if (markAllReadBtn) {
    markAllReadBtn.disabled = unreadCount === 0;
  }

  for (const n of userNotifs) {
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.justifyContent = 'space-between';
    li.style.alignItems = 'flex-start';
    li.style.gap = '16px';
    li.style.padding = '18px 20px';
    li.style.background = n.is_read ? 'var(--paper)' : '#fdfdfb';
    li.style.border = n.is_read ? '1px solid var(--line)' : '1px solid var(--line-med)';
    li.style.borderLeft = n.is_read ? '3px solid transparent' : '3px solid var(--brand)';
    li.style.borderRadius = 'var(--r-md)';

    li.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
        <div style="display: flex; align-items: center; gap: 8px;">
          ${getTypeBadge(n.type)}
          <span style="color: var(--ink-soft); font-size: 0.75rem;">${formatDateTime(n.created_at)}</span>
          ${!n.is_read ? '<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--brand);"></span>' : ''}
        </div>
        <p style="margin: 2px 0 0; color: var(--navy); font-weight: ${n.is_read ? '500' : '600'}; font-size: 0.9rem;">
          ${escapeHtml(n.message || 'Notification alert')}
        </p>
      </div>
      <div>
        ${!n.is_read ? `
          <button type="button" class="button button-secondary" style="min-height: 30px; padding: 0 10px; font-size: 0.75rem;" data-mark-read="${n.id}">
            Mark read
          </button>
        ` : '<span style="color: var(--ink-faint); font-size: 0.75rem;">Read</span>'}
      </div>
    `;

    const readBtn = li.querySelector(`[data-mark-read="${n.id}"]`);
    if (readBtn) {
      readBtn.addEventListener('click', async () => {
        readBtn.disabled = true;
        readBtn.textContent = '…';
        try {
          await apiFetch(`/notifications/${n.id}`, { method: 'PUT' });
          n.is_read = true;
          renderNotifications(allNotifications);
          if (window.showToast) {
            window.showToast.success('Notification marked as read.', 'Dismissed');
          }
        } catch (err) {
          console.error('Could not mark read:', err);
          readBtn.disabled = false;
          readBtn.textContent = 'Mark read';
          if (window.showToast) {
            window.showToast.error(err.message || 'Could not update notification.', 'Error');
          }
        }
      });
    }

    notifListEl.append(li);
  }
}

async function loadNotifications() {
  if (!notifListEl) return;
  if (window.showListSkeleton) {
    window.showListSkeleton(notifListEl, 5, 'row');
  } else {
    notifListEl.innerHTML = '<li class="workspace-placeholder"><p style="margin: 0;">Loading notifications…</p></li>';
  }

  try {
    const data = await apiFetch('/notifications');
    if (!Array.isArray(data)) {
      throw new Error('Invalid notifications API response.');
    }
    allNotifications = data;
    renderNotifications(allNotifications);
  } catch (error) {
    console.error('Could not load notifications:', error);
    notifListEl.innerHTML = `<li class="workspace-placeholder" style="color: var(--coral);"><p style="margin: 0;">Failed to load notifications: ${escapeHtml(error.message)}</p></li>`;
  }
}

if (markAllReadBtn) {
  markAllReadBtn.addEventListener('click', async () => {
    markAllReadBtn.disabled = true;
    const oldText = markAllReadBtn.textContent;
    markAllReadBtn.textContent = 'Marking…';
    try {
      await apiFetch('/notifications/read-all', { method: 'PUT' });
      for (const n of allNotifications) n.is_read = true;
      renderNotifications(allNotifications);
      if (window.showToast) {
        window.showToast.success('All notifications marked as read.', 'Inbox Cleared');
      }
    } catch (err) {
      console.error('Could not mark all read:', err);
      if (window.showToast) {
        window.showToast.error('Could not mark all notifications as read.', 'Error');
      }
    } finally {
      markAllReadBtn.textContent = oldText;
    }
  });
}

loadNotifications();
