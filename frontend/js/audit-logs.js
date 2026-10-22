/**
 * TMS – audit-logs.js
 * System audit ledger, change tracking, and actor history.
 */

let allAuditLogs = [];

const auditTableBody = document.querySelector('#audit-table tbody');
const auditCountEl = document.querySelector('#audit-count');
const auditSearchInput = document.querySelector('#audit-search');
const auditActionFilter = document.querySelector('#audit-action-filter');
const auditTableFilter = document.querySelector('#audit-table-filter');

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
    second: '2-digit',
  });
}

function getActionBadge(action) {
  const a = String(action || '').toUpperCase();
  const map = {
    INSERT: 'badge-green',
    UPDATE: 'badge-blue',
    DELETE: 'badge-red',
  };
  const cls = map[a] || 'badge-gray';
  return `<span class="badge ${cls}">${a}</span>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderAuditLogs(logs) {
  if (!auditTableBody) return;
  auditTableBody.replaceChildren();

  if (logs.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" class="workspace-empty">No audit records match your filters.</td>`;
    auditTableBody.append(tr);
    if (auditCountEl) auditCountEl.textContent = '0 audit logs';
    return;
  }

  for (const log of logs) {
    const tableName = (log.table_name || 'record').replaceAll('_', ' ');
    const actor = log.username ? `<strong>${escapeHtml(log.username)}</strong>` : '<span style="color: var(--ink-faint);">System Automated</span>';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="white-space: nowrap; color: var(--ink-soft); font-size: 0.8125rem;">${formatDateTime(log.created_at)}</td>
      <td>${getActionBadge(log.action)}</td>
      <td style="text-transform: capitalize;"><strong>${escapeHtml(tableName)}</strong></td>
      <td>${actor}</td>
      <td style="text-align: right;">
        <button type="button" class="button button-secondary button-sm" data-audit-id="${log.id}">Details</button>
      </td>
    `;

    const btn = tr.querySelector(`[data-audit-id="${log.id}"]`);
    if (btn) {
      btn.addEventListener('click', () => openAuditDetails(log));
    }

    auditTableBody.append(tr);
  }

  if (auditCountEl) {
    auditCountEl.textContent = `${logs.length} ${logs.length === 1 ? 'audit record' : 'audit records'} retrieved`;
  }
}

function openAuditDetails(log) {
  const modal = document.querySelector('#audit-detail-dialog');
  if (!modal) return;

  const badgeEl = document.querySelector('#audit-detail-badge');
  if (badgeEl) badgeEl.innerHTML = getActionBadge(log.action);
  const tableEl = document.querySelector('#audit-detail-table');
  if (tableEl) tableEl.textContent = (log.table_name || 'record').replaceAll('_', ' ');
  const timeEl = document.querySelector('#audit-detail-time');
  if (timeEl) timeEl.textContent = formatDateTime(log.created_at);
  const actorEl = document.querySelector('#audit-detail-actor');
  if (actorEl) {
    const name = [log.first_name, log.last_name].filter(Boolean).join(' ');
    actorEl.textContent = log.username ? `${log.username} ${name ? '(' + name + ')' : ''} [${log.role || 'user'}]` : 'System automated trigger';
  }

  let contextStr = '';
  if (log.plate_number) contextStr = `Vehicle plate: ${log.plate_number}`;
  else if (log.driver_first_name || log.driver_last_name) contextStr = `Driver: ${[log.driver_first_name, log.driver_last_name].filter(Boolean).join(' ')}`;
  else if (log.route_name) contextStr = `Route: ${log.route_name}`;
  else if (log.invoice_number) contextStr = `Invoice: ${log.invoice_number}`;

  const ctxWrap = document.querySelector('#audit-detail-context-wrapper');
  const ctxEl = document.querySelector('#audit-detail-context');
  if (ctxWrap && ctxEl) {
    if (contextStr) {
      ctxWrap.hidden = false;
      ctxEl.textContent = contextStr;
    } else {
      ctxWrap.hidden = true;
    }
  }

  const recEl = document.querySelector('#audit-detail-recid');
  if (recEl) recEl.textContent = log.record_id || '—';

  modal.showModal();
}

function filterAuditLogs() {
  const query = (auditSearchInput?.value || '').trim().toLowerCase();
  const action = (auditActionFilter?.value || '').trim().toUpperCase();
  const table = (auditTableFilter?.value || '').trim().toLowerCase();

  const filtered = allAuditLogs.filter((log) => {
    const matchQuery = !query ||
      (log.table_name && log.table_name.toLowerCase().includes(query)) ||
      (log.username && log.username.toLowerCase().includes(query)) ||
      (log.record_id && String(log.record_id).toLowerCase().includes(query));
    const matchAction = !action || log.action === action;
    const matchTable = !table || (log.table_name && log.table_name.toLowerCase() === table);
    return matchQuery && matchAction && matchTable;
  });

  renderAuditLogs(filtered);
}

async function loadAuditLogs() {
  if (!auditTableBody) return;
  if (window.showTableSkeleton) {
    window.showTableSkeleton(auditTableBody, 5);
  } else {
    auditTableBody.innerHTML = `<tr><td colspan="5" class="workspace-empty">Loading audit ledger…</td></tr>`;
  }

  try {
    const data = await apiFetch('/audit-logs?limit=200');
    if (!Array.isArray(data)) {
      throw new Error('Invalid audit-logs API response.');
    }
    allAuditLogs = data;

    // Populate distinct tables into table filter
    if (auditTableFilter) {
      const distinctTables = [...new Set(data.map(d => d.table_name).filter(Boolean))].sort();
      const currentSelected = auditTableFilter.value;
      auditTableFilter.innerHTML = '<option value="">All entity tables</option>' +
        distinctTables.map(t => `<option value="${t}" ${t === currentSelected ? 'selected' : ''}>${t.replaceAll('_', ' ')}</option>`).join('');
    }

    renderAuditLogs(allAuditLogs);
  } catch (error) {
    console.error('Could not load audit logs:', error);
    auditTableBody.innerHTML = `<tr><td colspan="5" class="workspace-empty" style="color: var(--coral);">Failed to load audit logs: ${escapeHtml(error.message)}</td></tr>`;
  }
}

if (auditSearchInput) auditSearchInput.addEventListener('input', filterAuditLogs);
if (auditActionFilter) auditActionFilter.addEventListener('change', filterAuditLogs);
if (auditTableFilter) auditTableFilter.addEventListener('change', filterAuditLogs);

loadAuditLogs();

