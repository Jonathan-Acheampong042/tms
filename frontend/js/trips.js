/**
 * TMS – trips.js
 * Trip scheduling, route tracking, and status monitoring.
 */

let allTrips = [];
let vehiclesList = [];
let driversList = [];

const tripTableBody = document.querySelector('#trips-table tbody');
const tripCountEl = document.querySelector('#trips-count');
const tripSearchInput = document.querySelector('#trip-search');
const tripStatusFilter = document.querySelector('#trip-status-filter');
const openTripModalBtn = document.querySelector('#open-trip-modal-btn');
const tripModal = document.querySelector('#trip-modal');
const tripForm = document.querySelector('#trip-form');
const tripModalClose = document.querySelector('#trip-modal-close');
const tripModalCancel = document.querySelector('#trip-modal-cancel');
const tripSubmitBtn = document.querySelector('#trip-submit-btn');
const tripAlert = document.querySelector('#trip-alert');
const tripVehicleSelect = document.querySelector('#trip-vehicle');
const tripDriverSelect = document.querySelector('#trip-driver');

function formatDateTime(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadge(status) {
  const s = String(status || '').toLowerCase();
  const map = {
    scheduled: 'badge-amber',
    in_progress: 'badge-blue',
    completed: 'badge-green',
    cancelled: 'badge-red',
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

function renderTrips(trips) {
  if (!tripTableBody) return;
  tripTableBody.replaceChildren();

  if (trips.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" class="workspace-empty">No trip records found.</td>`;
    tripTableBody.append(tr);
    if (tripCountEl) tripCountEl.textContent = '0 trips';
    return;
  }

  for (const t of trips) {
    const routeTitle = t.route_name || `${t.origin || 'Start'} → ${t.destination || 'End'}`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <strong>${escapeHtml(routeTitle)}</strong>
          <span style="color: var(--ink-soft); font-size: 0.78rem;">${escapeHtml(t.origin || '')} to ${escapeHtml(t.destination || '')}</span>
        </div>
      </td>
      <td><code>${escapeHtml(t.plate_number || 'Unassigned')}</code></td>
      <td>${escapeHtml(t.driver_name || 'Assigned Driver')}</td>
      <td>${formatDateTime(t.scheduled_start)}</td>
      <td>${formatDateTime(t.scheduled_end)}</td>
      <td>${getStatusBadge(t.status)}</td>
    `;
    tripTableBody.append(tr);
  }

  if (tripCountEl) {
    tripCountEl.textContent = `${trips.length} ${trips.length === 1 ? 'trip' : 'trips'} scheduled`;
  }
}

function filterTrips() {
  const query = (tripSearchInput?.value || '').trim().toLowerCase();
  const status = (tripStatusFilter?.value || '').trim().toLowerCase();

  const filtered = allTrips.filter((t) => {
    const route = (t.route_name || '').toLowerCase();
    const origin = (t.origin || '').toLowerCase();
    const dest = (t.destination || '').toLowerCase();
    const plate = (t.plate_number || '').toLowerCase();
    const matchesSearch = !query ||
      route.includes(query) ||
      origin.includes(query) ||
      dest.includes(query) ||
      plate.includes(query);
    const matchesStatus = !status || t.status === status;
    return matchesSearch && matchesStatus;
  });

  renderTrips(filtered);
}

async function loadDropdowns() {
  try {
    const [vehicles, drivers] = await Promise.all([
      apiFetch('/vehicles').catch(() => []),
      apiFetch('/drivers').catch(() => []),
    ]);

    vehiclesList = Array.isArray(vehicles) ? vehicles : [];
    driversList = Array.isArray(drivers) ? drivers : [];

    if (tripVehicleSelect) {
      tripVehicleSelect.innerHTML = '<option value="">Select vehicle…</option>';
      for (const v of vehiclesList) {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = `${v.plate_number} — ${v.make || ''} ${v.model || ''}`;
        tripVehicleSelect.append(opt);
      }
    }

    if (tripDriverSelect) {
      tripDriverSelect.innerHTML = '<option value="">Select driver…</option>';
      for (const d of driversList) {
        const opt = document.createElement('option');
        opt.value = d.id;
        const name = [d.first_name, d.last_name].filter(Boolean).join(' ') || d.driver_name || d.id;
        opt.textContent = `${name} (${d.license_number || 'No license'})`;
        tripDriverSelect.append(opt);
      }
    }
  } catch (err) {
    console.error('Could not load vehicle/driver dropdowns:', err);
  }
}

async function loadTrips() {
  if (!tripTableBody) return;
  if (window.showTableSkeleton) {
    window.showTableSkeleton(tripTableBody, 6);
  } else {
    tripTableBody.innerHTML = `<tr><td colspan="6" class="workspace-empty">Loading trip records…</td></tr>`;
  }

  try {
    const data = await apiFetch('/trips');
    if (!Array.isArray(data)) {
      throw new Error('Invalid trips API response.');
    }
    allTrips = data;
    renderTrips(allTrips);
  } catch (error) {
    console.error('Could not load trips:', error);
    tripTableBody.innerHTML = `<tr><td colspan="6" class="workspace-empty" style="color: var(--coral);">Failed to load trip schedules: ${escapeHtml(error.message)}</td></tr>`;
  }
}

// Modal controls
if (openTripModalBtn && tripModal) {
  openTripModalBtn.addEventListener('click', async () => {
    tripForm.reset();
    const now = new Date();
    const startStr = new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 16);
    const endStr = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 16);
    document.querySelector('#trip-start').value = startStr;
    document.querySelector('#trip-end').value = endStr;
    if (tripAlert) tripAlert.hidden = true;
    tripSubmitBtn.disabled = false;
    await loadDropdowns();
    tripModal.showModal();
  });
}
if (tripModalClose && tripModal) {
  tripModalClose.addEventListener('click', () => tripModal.close());
}
if (tripModalCancel && tripModal) {
  tripModalCancel.addEventListener('click', () => tripModal.close());
}
if (tripModal) {
  tripModal.addEventListener('click', (e) => {
    if (e.target === tripModal) tripModal.close();
  });
}

// Form submission
if (tripForm) {
  tripForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (tripAlert) tripAlert.hidden = true;
    tripSubmitBtn.disabled = true;

    const formData = new FormData(tripForm);
    const body = {
      origin: formData.get('origin')?.trim(),
      destination: formData.get('destination')?.trim(),
      vehicle_id: formData.get('vehicle_id'),
      driver_id: formData.get('driver_id'),
      scheduled_start: formData.get('scheduled_start'),
      scheduled_end: formData.get('scheduled_end'),
      status: formData.get('status') || 'scheduled',
    };

    try {
      await apiFetch('/trips', {
        method: 'POST',
        body,
      });

      tripModal.close();
      tripForm.reset();
      await loadTrips();

      if (window.showToast) {
        window.showToast.success(`Trip from ${body.origin} to ${body.destination} scheduled successfully!`, 'Trip Scheduled');
      }
    } catch (err) {
      console.error('Could not schedule trip:', err);
      tripSubmitBtn.disabled = false;
      if (window.showAlert) {
        window.showAlert('#trip-alert', err.message || 'Failed to schedule trip.', 'error', 'Scheduling Error');
      }
      if (window.showToast) {
        window.showToast.error(err.message || 'Could not schedule trip.', 'Error');
      }
    }
  });
}

if (tripSearchInput) tripSearchInput.addEventListener('input', filterTrips);
if (tripStatusFilter) tripStatusFilter.addEventListener('change', filterTrips);

loadTrips();
loadDropdowns();
