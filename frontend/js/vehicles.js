/**
 * TMS – vehicles.js
 * Vehicle fleet listing, searching, filtering, adding and editing vehicles.
 */

let allVehicles = [];
let editingVehicleId = null;

const vehicleTableBody = document.querySelector('#vehicles-table tbody');
const vehicleCountEl = document.querySelector('#vehicles-count');
const vehicleSearchInput = document.querySelector('#vehicle-search');
const vehicleStatusFilter = document.querySelector('#vehicle-status-filter');
const addVehicleDialog = document.querySelector('#add-vehicle-dialog');
const addVehicleForm = document.querySelector('#add-vehicle-form');
const addVehicleBtn = document.querySelector('#add-vehicle-btn');
const closeDialogBtn = document.querySelector('#close-vehicle-dialog');
const formMessage = document.querySelector('#vehicle-form-message');
const vehicleDialogEyebrow = document.querySelector('#vehicle-dialog-eyebrow');
const vehicleDialogTitle = document.querySelector('#vehicle-dialog-title');
const vehicleSubmitBtn = document.querySelector('#vehicle-submit-btn');

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
    maintenance: 'badge-amber',
    decommissioned: 'badge-red',
  };
  const cls = map[s] || 'badge-gray';
  const label = s.replace('_', ' ');
  return `<span class="badge ${cls}">${label}</span>`;
}

function openVehicleDialog(vehicle = null, isEditing = true) {
  if (!addVehicleDialog || !addVehicleForm) return;
  addVehicleForm.reset();
  if (formMessage) formMessage.textContent = '';
  editingVehicleId = vehicle ? vehicle.id : null;

  const plateInput = document.querySelector('#v-plate');
  const catInput = document.querySelector('#v-category');
  const modelInput = document.querySelector('#v-model');
  const yearInput = document.querySelector('#v-year');
  const capInput = document.querySelector('#v-capacity');
  const statusInput = document.querySelector('#v-status');
  const insInput = document.querySelector('#v-ins-exp');
  const licInput = document.querySelector('#v-lic-exp');

  const allInputs = [plateInput, catInput, modelInput, yearInput, capInput, statusInput, insInput, licInput];

  if (vehicle) {
    if (vehicleDialogEyebrow) vehicleDialogEyebrow.textContent = isEditing ? 'FLEET MANAGEMENT' : 'VEHICLE RECORD';
    if (vehicleDialogTitle) vehicleDialogTitle.textContent = isEditing ? `Edit vehicle ${vehicle.plate_number}` : `Vehicle ${vehicle.plate_number}`;
    if (vehicleSubmitBtn) {
      vehicleSubmitBtn.textContent = 'Save changes';
      vehicleSubmitBtn.hidden = !isEditing;
    }

    if (plateInput) {
      plateInput.value = vehicle.plate_number || '';
      plateInput.readOnly = true;
    }
    if (catInput) {
      catInput.value = vehicle.category || 'bus';
      catInput.disabled = !isEditing;
    }
    if (modelInput) {
      modelInput.value = vehicle.model || '';
      modelInput.readOnly = !isEditing;
    }
    if (yearInput) {
      yearInput.value = vehicle.year || '';
      yearInput.readOnly = !isEditing;
    }
    if (capInput) {
      capInput.value = vehicle.capacity || 15;
      capInput.readOnly = !isEditing;
    }
    if (statusInput) {
      statusInput.value = vehicle.status || 'available';
      statusInput.disabled = !isEditing;
    }
    if (insInput) {
      insInput.value = formatDateForInput(vehicle.insurance_expiry);
      insInput.readOnly = !isEditing;
    }
    if (licInput) {
      licInput.value = formatDateForInput(vehicle.license_expiry);
      licInput.readOnly = !isEditing;
    }
  } else {
    if (vehicleDialogEyebrow) vehicleDialogEyebrow.textContent = 'FLEET REGISTRATION';
    if (vehicleDialogTitle) vehicleDialogTitle.textContent = 'Add new vehicle';
    if (vehicleSubmitBtn) {
      vehicleSubmitBtn.textContent = 'Register vehicle';
      vehicleSubmitBtn.hidden = false;
    }
    allInputs.forEach(inp => {
      if (!inp) return;
      inp.readOnly = false;
      inp.disabled = false;
    });
  }

  addVehicleDialog.showModal();
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
        <div class="table-actions">
          <button type="button" class="button button-secondary button-sm" data-vehicle-view="${v.id}">View</button>
          <button type="button" class="button button-sm" data-vehicle-edit="${v.id}">Edit</button>
        </div>
      </td>
    `;

    const viewBtn = tr.querySelector(`[data-vehicle-view="${v.id}"]`);
    if (viewBtn) {
      viewBtn.addEventListener('click', () => openVehicleDialog(v, false));
    }
    const editBtn = tr.querySelector(`[data-vehicle-edit="${v.id}"]`);
    if (editBtn) {
      editBtn.addEventListener('click', () => openVehicleDialog(v, true));
    }

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

if (addVehicleBtn) {
  addVehicleBtn.addEventListener('click', () => openVehicleDialog(null, true));
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
      if (editingVehicleId) {
        await apiFetch(`/vehicles/${editingVehicleId}`, {
          method: 'PATCH',
          body,
        });
        if (window.showToast) {
          window.showToast.success(`Vehicle ${body.plate_number} updated successfully!`, 'Vehicle Saved');
        }
      } else {
        await apiFetch('/vehicles', {
          method: 'POST',
          body,
        });
        if (window.showToast) {
          window.showToast.success(`Vehicle ${body.plate_number} (${body.model}) added to fleet!`, 'Vehicle Registered');
        }
      }
      addVehicleDialog.close();
      await loadVehicles();
    } catch (err) {
      if (formMessage) {
        formMessage.dataset.state = 'error';
        formMessage.textContent = err.message || 'Could not save vehicle.';
      }
      if (window.showToast) {
        window.showToast.error(err.message || 'Could not save vehicle.', 'Save Failed');
      }
    }
  });
}

loadVehicles();
