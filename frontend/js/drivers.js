/**
 * TMS – drivers.js
 * Driver roster, verification status, searching, filtering, and editing.
 */

let allDrivers = [];
let editingDriverId = null;

const driverTableBody = document.querySelector('#drivers-table tbody');
const driverCountEl = document.querySelector('#drivers-count');
const driverSearchInput = document.querySelector('#driver-search');
const driverStatusFilter = document.querySelector('#driver-status-filter');
const driverDialog = document.querySelector('#driver-dialog');
const driverForm = document.querySelector('#driver-form');
const driverDialogEyebrow = document.querySelector('#driver-dialog-eyebrow');
const driverDialogTitle = document.querySelector('#driver-dialog-title');
const driverSaveBtn = document.querySelector('#driver-save-btn');
const driverFormMessage = document.querySelector('#driver-form-message');

function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleDateString();
}

function formatDateForInput(val) {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
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

function openDriverDialog(driver, isEditing = true) {
  if (!driverDialog || !driverForm) return;
  driverForm.reset();
  if (driverFormMessage) driverFormMessage.textContent = '';
  editingDriverId = driver.id;

  const fullName = `${driver.first_name || ''} ${driver.middle_name ? driver.middle_name + ' ' : ''}${driver.last_name || ''}`.trim() || 'Driver';

  if (driverDialogEyebrow) driverDialogEyebrow.textContent = isEditing ? 'DRIVER MANAGEMENT' : 'DRIVER RECORD';
  if (driverDialogTitle) driverDialogTitle.textContent = isEditing ? `Edit driver — ${fullName}` : `Driver — ${fullName}`;
  if (driverSaveBtn) driverSaveBtn.hidden = !isEditing;

  const nameInput = document.querySelector('#drv-name');
  const phoneInput = document.querySelector('#drv-phone');
  const emailInput = document.querySelector('#drv-email');
  const licInput = document.querySelector('#drv-license');
  const expInput = document.querySelector('#drv-expiry');
  const statusInput = document.querySelector('#drv-status');
  const verInput = document.querySelector('#drv-verified');

  if (nameInput) nameInput.value = fullName;
  if (phoneInput) phoneInput.value = driver.phone || '—';
  if (emailInput) emailInput.value = driver.email || '—';
  if (licInput) {
    licInput.value = driver.license_number || '';
    licInput.readOnly = !isEditing;
  }
  if (expInput) {
    expInput.value = formatDateForInput(driver.license_expiry);
    expInput.readOnly = !isEditing;
  }
  if (statusInput) {
    statusInput.value = driver.status || 'available';
    statusInput.disabled = !isEditing;
  }
  if (verInput) {
    verInput.checked = Boolean(driver.license_verified);
    verInput.disabled = !isEditing;
  }

  driverDialog.showModal();
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
      <td style="text-align: right;">
        <div class="table-actions">
          <button type="button" class="button button-secondary button-sm" data-driver-view="${d.id}">View</button>
          <button type="button" class="button button-sm" data-driver-edit="${d.id}">Edit</button>
        </div>
      </td>
    `;

    const viewBtn = tr.querySelector(`[data-driver-view="${d.id}"]`);
    if (viewBtn) {
      viewBtn.addEventListener('click', () => openDriverDialog(d, false));
    }
    const editBtn = tr.querySelector(`[data-driver-edit="${d.id}"]`);
    if (editBtn) {
      editBtn.addEventListener('click', () => openDriverDialog(d, true));
    }

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

if (driverForm && driverDialog) {
  driverForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editingDriverId) return;

    if (driverFormMessage) {
      driverFormMessage.dataset.state = '';
      driverFormMessage.textContent = 'Saving driver changes…';
    }

    const formData = new FormData(driverForm);
    const body = {
      license_number: formData.get('license_number')?.trim(),
      license_expiry: formData.get('license_expiry'),
      status: formData.get('status'),
      license_verified: formData.get('license_verified') === 'on',
    };

    try {
      await apiFetch(`/drivers/${editingDriverId}`, {
        method: 'PATCH',
        body,
      });

      driverDialog.close();
      await loadDrivers();

      if (window.showToast) {
        window.showToast.success('Driver record updated successfully!', 'Driver Saved');
      }
    } catch (err) {
      if (driverFormMessage) {
        driverFormMessage.dataset.state = 'error';
        driverFormMessage.textContent = err.message || 'Could not update driver.';
      }
      if (window.showToast) {
        window.showToast.error(err.message || 'Could not update driver.', 'Save Failed');
      }
    }
  });
}

loadDrivers();
