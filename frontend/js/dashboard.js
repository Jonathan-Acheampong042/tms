// Dashboard page logic (pages/dashboard.html).

function totalForStatus(rows, statuses) {
  if (!Array.isArray(rows)) {
    throw new Error('The dashboard summary returned an invalid status list.');
  }

  return rows.reduce((total, row) => {
    const count = Number(row.count);
    if (!Number.isFinite(count)) {
      throw new Error('The dashboard summary returned an invalid count.');
    }
    return total + (statuses.includes(row.status) ? count : 0);
  }, 0);
}

function totalCount(rows) {
  if (!Array.isArray(rows)) {
    throw new Error('The dashboard summary returned an invalid status list.');
  }

  return rows.reduce((total, row) => {
    const count = Number(row.count);
    if (!Number.isFinite(count)) {
      throw new Error('The dashboard summary returned an invalid count.');
    }
    return total + count;
  }, 0);
}

function showStat(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value);
}

async function loadDashboardSummary() {
  try {
    const summary = await apiFetch('/reports');
    showStat('stat-vehicles', totalCount(summary.fleet));
    showStat('stat-trips', totalForStatus(summary.trips, ['in_progress']));
    showStat('stat-bookings', totalForStatus(summary.bookings, ['pending']));
    showStat('stat-invoices', totalForStatus(summary.invoices, ['unpaid', 'overdue']));
  } catch (error) {
    console.error('Could not load dashboard summary:', error);
    for (const id of ['stat-vehicles', 'stat-trips', 'stat-bookings', 'stat-invoices']) {
      showStat(id, 'Unavailable');
    }
  }
}

/**
 * Maps an audit log {action, table_name} pair plus record details into a
 * human-readable description, icon SVG path, and accent colour class.
 */
function describeActivity(log) {
  const action = (log.action || '').toUpperCase();
  const table = (log.table_name || '').toLowerCase();

  // Build a contextual detail string from joined record data
  let detail = '';
  if (table === 'vehicles' && log.plate_number) {
    detail = log.plate_number;
  } else if (table === 'drivers' && (log.driver_first_name || log.driver_last_name)) {
    detail = [log.driver_first_name, log.driver_last_name].filter(Boolean).join(' ');
  } else if (table === 'trips' && log.route_name) {
    detail = log.route_name;
  } else if (table === 'invoices' && log.invoice_number) {
    detail = log.invoice_number;
  } else if (table === 'bookings') {
    detail = '';
  } else if (table === 'payments') {
    detail = '';
  }

  // Friendly label per table
  const tableLabels = {
    vehicles: 'vehicle',
    drivers: 'driver',
    trips: 'trip',
    bookings: 'booking',
    invoices: 'invoice',
    payments: 'payment',
    fuel_records: 'fuel record',
    driver_incidents: 'incident',
    users: 'user',
  };
  const entity = tableLabels[table] || table.replaceAll('_', ' ');

  // Action verb mapping
  const verbMap = {
    INSERT: { label: 'added', accent: 'activity--add' },
    UPDATE: { label: 'updated', accent: 'activity--update' },
    DELETE: { label: 'removed', accent: 'activity--delete' },
  };
  const verb = verbMap[action] || { label: action.toLowerCase(), accent: 'activity--update' };

  // Build the text
  const entityCapitalised = entity.charAt(0).toUpperCase() + entity.slice(1);
  let text;
  if (action === 'INSERT') {
    text = detail ? `New ${entity} registered — ${detail}` : `New ${entity} registered`;
  } else if (action === 'DELETE') {
    text = detail ? `${entityCapitalised} removed — ${detail}` : `${entityCapitalised} removed`;
  } else {
    text = detail ? `${entityCapitalised} ${verb.label} — ${detail}` : `${entityCapitalised} ${verb.label}`;
  }

  // Icon SVG paths per table (16×16 viewBox)
  const icons = {
    vehicles: '<path d="M2 9l1-4h10l1 4M3 13h2m6 0h2M3 9h10v4H3z" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    drivers: '<path d="M8 8a3 3 0 100-6 3 3 0 000 6zm-5 6a5 5 0 0110 0" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    trips: '<path d="M3 8h10M8 3v10M5 5l6 6M11 5l-6 6" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/>',
    bookings: '<path d="M4 2h8a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1zm2 4h4m-4 3h4" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    invoices: '<path d="M4 2h8a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1zm2 3h4m-4 2.5h4m-4 2.5h2" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    payments: '<path d="M2 5h12v7H2zM2 7.5h12" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    fuel_records: '<path d="M4 14V4a1 1 0 011-1h4a1 1 0 011 1v10m-7 0h9M11 5l1.5 1.5V9" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    driver_incidents: '<path d="M8 1L1 14h14L8 1zm0 5v3m0 2h.01" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    users: '<path d="M8 8a3 3 0 100-6 3 3 0 000 6zm-5 6a5 5 0 0110 0" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  const iconSvg = icons[table] || icons.users;

  // Actor name
  let actor = '';
  if (log.first_name || log.last_name) {
    actor = [log.first_name, log.last_name].filter(Boolean).join(' ');
  } else if (log.username) {
    actor = log.username;
  }

  return { text, iconSvg, accent: verb.accent, actor };
}

/**
 * Returns a human-friendly relative timestamp, e.g. "2 hours ago", "Yesterday".
 */
function relativeTime(dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatActivity(log) {
  const { text, iconSvg, accent, actor } = describeActivity(log);

  const item = document.createElement('li');
  item.className = `activity-item ${accent}`;

  // Icon indicator
  const indicator = document.createElement('span');
  indicator.className = 'activity-icon';
  indicator.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">${iconSvg}</svg>`;

  // Content wrapper
  const content = document.createElement('div');
  content.className = 'activity-content';

  const desc = document.createElement('span');
  desc.className = 'activity-desc';
  desc.textContent = text;

  const meta = document.createElement('span');
  meta.className = 'activity-meta';
  const parts = [];
  if (actor) parts.push(actor);
  if (log.created_at) parts.push(relativeTime(log.created_at));
  meta.textContent = parts.join(' · ');

  content.append(desc, meta);
  item.append(indicator, content);

  return item;
}

async function loadRecentActivity() {
  const list = document.getElementById('recent-activity');
  if (!list) return;

  try {
    const logs = await apiFetch('/audit-logs?limit=5');
    if (!Array.isArray(logs)) {
      throw new Error('The audit-log endpoint returned an invalid response.');
    }
    list.replaceChildren();
    if (logs.length === 0) {
      const empty = document.createElement('li');
      empty.textContent = 'No recent activity.';
      list.append(empty);
      return;
    }
    list.append(...logs.map(formatActivity));
  } catch (error) {
    console.error('Could not load recent activity:', error);
    const item = document.createElement('li');
    item.textContent = 'Recent activity could not be loaded.';
    list.replaceChildren(item);
  }
}

loadDashboardSummary();
loadRecentActivity();
