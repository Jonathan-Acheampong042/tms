/**
 * TMS – vehicles.js
 * Vehicle fleet listing, searching, filtering, and adding new vehicles.
 */

let allVehicles = [];

const vehicleTableBody = document.querySelector('#vehicles-table tbody');
const vehicleCountEl = document.querySelector('#vehicles-count');
const vehicleSearchInput = document.querySelector('#vehicle-search');
const vehicleStatusFilter = document.querySelector('#vehicle-status-filter');
const addVehicleDialog = document.querySelector('#add-vehicle-dialog');
const addVehicleForm = document.querySelector('#add-vehicle-form');
const addVehicleBtn = document.querySelector('#add-vehicle-btn');
const closeDialogBtn = document.querySelector('#close-vehicle-dialog');
const formMessage = document.querySelector('#vehicle-form-message');

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
    maintenance: 'badge-amber',
    decommissioned: 'badge-red',
  };
  const cls = map[s] || 'badge-gray';
  const label = s.replace('_', ' ');
  return `<span class="badge ${cls}">${label}</span>`;
}

function renderVehicles(vehicles) {
  if (!vehicleTableBody) return;
  vehicleTableBody.replaceChildren();

  if (vehicles.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="7" class="workspace-empty">No vehicle records found.</td>`;
    vehicleTableBody.append(tr);
    if (vehicleCountEl) vehicleCountEl.textContent = '0 vehicles';
    return;
  }

  for (const v of vehicles) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(v.plate_number)}</strong></td>
      <td style="text-transform: capitalize;">${escapeHtml(v.category || '—')}</td>
      <td>${escapeHtml(v.model || '—')} ${v.year ? `(${escapeHtml(v.year)})` : ''}</td>
      <td>${v.capacity ? `${v.capacity} seats` : '—'}</td>
      <td>${getStatusBadge(v.status)}</td>
      <td>${formatDate(v.insurance_expiry)}</td>
      <td style="text-align: right;">
        <span style="color: var(--ink-soft); font-size: 0.8125rem;">${v.insurance ? 'Insured' : 'Uninsured'}</span>
      </td>
    `;
    vehicleTableBody.append(tr);
  }

  if (vehicleCountEl) {
    vehicleCountEl.textContent = `${vehicles.length} ${vehicles.length === 1 ? 'vehicle' : 'vehicles'} registered`;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function filterVehicles() {
  const query = (vehicleSearchInput?.value || '').trim().toLowerCase();
  const status = (vehicleStatusFilter?.value || '').trim().toLowerCase();

  const filtered = allVehicles.filter((v) => {
    const matchesSearch = !query ||
      (v.plate_number && v.plate_number.toLowerCase().includes(query)) ||
      (v.model && v.model.toLowerCase().includes(query));
    const matchesStatus = !status || v.status === status;
    return matchesSearch && matchesStatus;
  });

  renderVehicles(filtered);
}

async function loadVehicles() {
  if (!vehicleTableBody) return;
  if (window.showTableSkeleton) {
    window.showTableSkeleton(vehicleTableBody, 7);
  } else {
    vehicleTableBody.innerHTML = `<tr><td colspan="7" class="workspace-empty">Loading vehicle records…</td></tr>`;
  }

  try {
    const data = await apiFetch('/vehicles');
    if (!Array.isArray(data)) {
      throw new Error('Invalid vehicle list response.');
    }
    allVehicles = data;
    renderVehicles(allVehicles);
  } catch (error) {
    console.error('Could not load vehicles:', error);
    vehicleTableBody.innerHTML = `<tr><td colspan="7" class="workspace-empty" style="color: var(--coral);">Failed to load vehicles: ${escapeHtml(error.message)}</td></tr>`;
  }
}

// Event listeners
if (vehicleSearchInput) {
  vehicleSearchInput.addEventListener('input', filterVehicles);
}
if (vehicleStatusFilter) {
  vehicleStatusFilter.addEventListener('change', filterVehicles);
}

if (addVehicleBtn && addVehicleDialog) {
  addVehicleBtn.addEventListener('click', () => {
    if (formMessage) formMessage.textContent = '';
    if (addVehicleForm) addVehicleForm.reset();
    addVehicleDialog.showModal();
  });
}

if (closeDialogBtn && addVehicleDialog) {
  closeDialogBtn.addEventListener('click', () => {
    addVehicleDialog.close();
  });
}

if (addVehicleForm && addVehicleDialog) {
  addVehicleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (formMessage) {
      formMessage.dataset.state = '';
      formMessage.textContent = 'Saving vehicle…';
    }

    const formData = new FormData(addVehicleForm);
    const body = {
      plate_number: formData.get('plate_number')?.trim(),
      category: formData.get('category'),
      model: formData.get('model')?.trim(),
      year: formData.get('year')?.trim() || null,
      capacity: parseInt(formData.get('capacity'), 10),
      status: formData.get('status') || 'available',
      insurance_expiry: formData.get('insurance_expiry'),
      license_expiry: formData.get('license_expiry'),
      insurance: true,
    };

    try {
      const res = await apiFetch('/vehicles', {
        method: 'POST',
        body,
      });
      if (formMessage) {
        formMessage.dataset.state = 'success';
        formMessage.textContent = 'Vehicle created successfully!';
      }
      addVehicleDialog.close();
      await loadVehicles();
      if (window.showToast) {
        window.showToast.success(`Vehicle ${body.plate_number} (${body.model}) added to fleet!`, 'Vehicle Registered');
      }
    } catch (err) {
      if (formMessage) {
        formMessage.dataset.state = 'error';
        formMessage.textContent = err.message || 'Could not create vehicle.';
      }
      if (window.showToast) {
        window.showToast.error(err.message || 'Could not create vehicle.', 'Registration Failed');
      }
    }
  });
}

loadVehicles();
