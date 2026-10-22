/**
 * TMS – fuel.js
 * Vehicle refuelling logs, consumption tracking, and station expense records.
 */

let allFuel = [];
let vehiclesList = [];
let driversList = [];

const fuelTableBody = document.querySelector('#fuel-table tbody');
const fuelCountEl = document.querySelector('#fuel-count');
const fuelSearchInput = document.querySelector('#fuel-search');
const openFuelModalBtn = document.querySelector('#open-fuel-modal-btn');
const fuelModal = document.querySelector('#fuel-modal');
const fuelForm = document.querySelector('#fuel-form');
const fuelModalClose = document.querySelector('#fuel-modal-close');
const fuelModalCancel = document.querySelector('#fuel-modal-cancel');
const fuelSubmitBtn = document.querySelector('#fuel-submit-btn');
const fuelAlert = document.querySelector('#fuel-alert');
const fuelVehicleSelect = document.querySelector('#fuel-vehicle');
const fuelDriverSelect = document.querySelector('#fuel-driver');

const ghanaCedi = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'GHS',
});

function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleDateString();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderFuel(records) {
  if (!fuelTableBody) return;
  fuelTableBody.replaceChildren();

  if (records.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" class="workspace-empty">No fuel records found.</td>`;
    fuelTableBody.append(tr);
    if (fuelCountEl) fuelCountEl.textContent = '0 records';
    return;
  }

  let totalLitres = 0;
  let totalCost = 0;

  for (const f of records) {
    const litres = Number(f.litres) || 0;
    const cost = Number(f.cost) || 0;
    totalLitres += litres;
    totalCost += cost;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${escapeHtml(f.plate_number || 'Unassigned')}</code></td>
      <td><strong>${litres.toFixed(1)} L</strong></td>
      <td><strong>${ghanaCedi.format(cost)}</strong></td>
      <td>${escapeHtml(f.station || 'Station')}</td>
      <td>${formatDate(f.created_at)}</td>
    `;
    fuelTableBody.append(tr);
  }

  if (fuelCountEl) {
    fuelCountEl.textContent = `${records.length} logs · Total: ${totalLitres.toFixed(1)} L (${ghanaCedi.format(totalCost)})`;
  }
}

function filterFuel() {
  const query = (fuelSearchInput?.value || '').trim().toLowerCase();

  const filtered = allFuel.filter((f) => {
    const plate = (f.plate_number || '').toLowerCase();
    const station = (f.station || '').toLowerCase();
    return !query || plate.includes(query) || station.includes(query);
  });

  renderFuel(filtered);
}

async function loadDropdowns() {
  try {
    const [vehicles, drivers] = await Promise.all([
      apiFetch('/vehicles').catch(() => []),
      apiFetch('/drivers').catch(() => []),
    ]);

    vehiclesList = Array.isArray(vehicles) ? vehicles : [];
    driversList = Array.isArray(drivers) ? drivers : [];

    if (fuelVehicleSelect) {
      fuelVehicleSelect.innerHTML = '<option value="">Select vehicle…</option>';
      for (const v of vehiclesList) {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = `${v.plate_number} — ${v.make || ''} ${v.model || ''}`;
        fuelVehicleSelect.append(opt);
      }
    }

    if (fuelDriverSelect) {
      fuelDriverSelect.innerHTML = '<option value="">No assigned driver</option>';
      for (const d of driversList) {
        const opt = document.createElement('option');
        opt.value = d.id;
        const name = [d.first_name, d.last_name].filter(Boolean).join(' ') || d.driver_name || d.id;
        opt.textContent = `${name} (${d.license_number || 'No license'})`;
        fuelDriverSelect.append(opt);
      }
    }
  } catch (err) {
    console.error('Could not load vehicle/driver dropdowns:', err);
  }
}

async function loadFuel() {
  if (!fuelTableBody) return;
  if (window.showTableSkeleton) {
    window.showTableSkeleton(fuelTableBody, 5);
  } else {
    fuelTableBody.innerHTML = `<tr><td colspan="5" class="workspace-empty">Loading fuel records…</td></tr>`;
  }

  try {
    const data = await apiFetch('/fuel');
    if (!Array.isArray(data)) {
      throw new Error('Invalid fuel API response.');
    }
    allFuel = data;
    renderFuel(allFuel);
  } catch (error) {
    console.error('Could not load fuel records:', error);
    fuelTableBody.innerHTML = `<tr><td colspan="5" class="workspace-empty" style="color: var(--coral);">Failed to load fuel logs: ${escapeHtml(error.message)}</td></tr>`;
  }
}

// Modal controls
if (openFuelModalBtn && fuelModal) {
  openFuelModalBtn.addEventListener('click', async () => {
    fuelForm.reset();
    if (fuelAlert) fuelAlert.hidden = true;
    fuelSubmitBtn.disabled = false;
    await loadDropdowns();
    fuelModal.showModal();
  });
}
if (fuelModalClose && fuelModal) {
  fuelModalClose.addEventListener('click', () => fuelModal.close());
}
if (fuelModalCancel && fuelModal) {
  fuelModalCancel.addEventListener('click', () => fuelModal.close());
}
if (fuelModal) {
  fuelModal.addEventListener('click', (e) => {
    if (e.target === fuelModal) fuelModal.close();
  });
}

// Form submission
if (fuelForm) {
  fuelForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (fuelAlert) fuelAlert.hidden = true;
    fuelSubmitBtn.disabled = true;

    const formData = new FormData(fuelForm);
    const body = {
      vehicle_id: formData.get('vehicle_id'),
      litres: Number(formData.get('litres')),
      cost: Number(formData.get('cost')),
      station: formData.get('station')?.trim(),
      driver_id: formData.get('driver_id') || null,
    };

    try {
      await apiFetch('/fuel', {
        method: 'POST',
        body,
      });

      fuelModal.close();
      fuelForm.reset();
      await loadFuel();

      if (window.showToast) {
        window.showToast.success(`Logged refuelling of ${body.litres} L (${ghanaCedi.format(body.cost)}) at ${body.station}!`, 'Fuel Entry Saved');
      }
    } catch (err) {
      console.error('Could not log fuel entry:', err);
      fuelSubmitBtn.disabled = false;
      if (window.showAlert) {
        window.showAlert('#fuel-alert', err.message || 'Failed to save fuel entry.', 'error', 'Save Error');
      }
      if (window.showToast) {
        window.showToast.error(err.message || 'Failed to save fuel entry.', 'Error');
      }
    }
  });
}

if (fuelSearchInput) fuelSearchInput.addEventListener('input', filterFuel);

loadFuel();
loadDropdowns();
