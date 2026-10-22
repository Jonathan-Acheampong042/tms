/**
 * TMS – drivers.js
 * Driver roster, verification status, searching and filtering.
 */

let allDrivers = [];

const driverTableBody = document.querySelector('#drivers-table tbody');
const driverCountEl = document.querySelector('#drivers-count');
const driverSearchInput = document.querySelector('#driver-search');
const driverStatusFilter = document.querySelector('#driver-status-filter');

function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleDateString();
}

function getStatusBadge(status) {
  const s = String(status || '').toLowerCase();
  const map = {
    available: 'badge-green',
    on_trip: 'badge-blue',
    off_duty: 'badge-amber',
    suspended: 'badge-red',
  };
  const cls = map[s] || 'badge-gray';
  const label = s.replace('_', ' ');
  return `<span class="badge ${cls}">${label}</span>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderDrivers(drivers) {
  if (!driverTableBody) return;
  driverTableBody.replaceChildren();

  if (drivers.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" class="workspace-empty">No driver records found.</td>`;
    driverTableBody.append(tr);
    if (driverCountEl) driverCountEl.textContent = '0 drivers';
    return;
  }

  for (const d of drivers) {
    const fullName = `${d.first_name || ''} ${d.middle_name ? d.middle_name + ' ' : ''}${d.last_name || ''}`.trim() || '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(fullName)}</strong></td>
      <td><code>${escapeHtml(d.license_number || '—')}</code></td>
      <td>${formatDate(d.license_expiry)}</td>
      <td>
        ${d.license_verified ? '<span class="badge badge-green">Verified</span>' : '<span class="badge badge-gray">Unverified</span>'}
      </td>
      <td>${getStatusBadge(d.status)}</td>
      <td>
        <div style="display: flex; flex-direction: column; gap: 2px; font-size: 0.8125rem;">
          <span>${escapeHtml(d.phone || '—')}</span>
          <span style="color: var(--ink-soft); font-size: 0.75rem;">${escapeHtml(d.email || '')}</span>
        </div>
      </td>
    `;
    driverTableBody.append(tr);
  }

  if (driverCountEl) {
    driverCountEl.textContent = `${drivers.length} ${drivers.length === 1 ? 'driver' : 'drivers'} on roster`;
  }
}

function filterDrivers() {
  const query = (driverSearchInput?.value || '').trim().toLowerCase();
  const status = (driverStatusFilter?.value || '').trim().toLowerCase();

  const filtered = allDrivers.filter((d) => {
    const fullName = `${d.first_name || ''} ${d.last_name || ''}`.toLowerCase();
    const license = (d.license_number || '').toLowerCase();
    const matchesSearch = !query || fullName.includes(query) || license.includes(query);
    const matchesStatus = !status || d.status === status;
    return matchesSearch && matchesStatus;
  });

  renderDrivers(filtered);
}

async function loadDrivers() {
  if (!driverTableBody) return;
  if (window.showTableSkeleton) {
    window.showTableSkeleton(driverTableBody, 6);
  } else {
    driverTableBody.innerHTML = `<tr><td colspan="6" class="workspace-empty">Loading driver roster…</td></tr>`;
  }

  try {
    const data = await apiFetch('/drivers');
    if (!Array.isArray(data)) {
      throw new Error('Invalid drivers API response.');
    }
    allDrivers = data;
    renderDrivers(allDrivers);
  } catch (error) {
    console.error('Could not load drivers:', error);
    driverTableBody.innerHTML = `<tr><td colspan="6" class="workspace-empty" style="color: var(--coral);">Failed to load drivers: ${escapeHtml(error.message)}</td></tr>`;
  }
}

if (driverSearchInput) driverSearchInput.addEventListener('input', filterDrivers);
if (driverStatusFilter) driverStatusFilter.addEventListener('change', filterDrivers);

loadDrivers();
