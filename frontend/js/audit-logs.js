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
    const shortRecordId = log.record_id ? `${String(log.record_id).slice(0, 8)}…` : '—';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="white-space: nowrap; color: var(--ink-soft); font-size: 0.8125rem;">${formatDateTime(log.created_at)}</td>
      <td>${getActionBadge(log.action)}</td>
      <td style="text-transform: capitalize;"><strong>${escapeHtml(tableName)}</strong></td>
      <td>${actor}</td>
      <td><code>${escapeHtml(shortRecordId)}</code></td>
    `;
    auditTableBody.append(tr);
  }

  if (auditCountEl) {
    auditCountEl.textContent = `${logs.length} ${logs.length === 1 ? 'audit record' : 'audit records'} retrieved`;
  }
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

