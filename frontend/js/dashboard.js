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

function formatActivity(log) {
  const action = typeof log.action === 'string' ? log.action.toLowerCase() : 'updated';
  const table = typeof log.table_name === 'string' ? log.table_name.replaceAll('_', ' ') : 'record';
  const description = document.createElement('span');
  description.textContent = `${action} ${table}`;

  const item = document.createElement('li');
  item.append(description);

  if (log.created_at) {
    const date = new Date(log.created_at);
    if (!Number.isNaN(date.getTime())) {
      const time = document.createElement('time');
      time.dateTime = date.toISOString();
      time.textContent = ` — ${date.toLocaleString()}`;
      item.append(time);
    }
  }

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
