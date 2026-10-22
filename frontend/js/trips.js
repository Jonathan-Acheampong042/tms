/**
 * TMS – trips.js
 * Trip scheduling, route tracking, and status monitoring.
 */

let allTrips = [];
let vehiclesList = [];
let driversList = [];
let editingTripId = null;

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
const tripOriginInput = document.querySelector('#trip-origin');
const tripDestinationInput = document.querySelector('#trip-destination');
const tripVehicleSelect = document.querySelector('#trip-vehicle');
const tripDriverSelect = document.querySelector('#trip-driver');
const tripModalTitle = document.querySelector('#trip-modal-title');

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
    tr.innerHTML = `<td colspan="7" class="workspace-empty">No trip records found.</td>`;
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
      <td style="text-align: right;">
        <div class="table-actions">
          <button type="button" class="button button-secondary button-sm" data-trip-edit="${t.id}">Edit</button>
          <button type="button" class="button button-sm" data-trip-manage="${t.id}" data-trip-status="${t.status}">
            ${t.status === 'scheduled' ? 'Start' : (t.status === 'in_progress' ? 'Finish' : 'Reset')}
          </button>
        </div>
      </td>
    `;

    const editBtn = tr.querySelector(`[data-trip-edit="${t.id}"]`);
    if (editBtn) {
      editBtn.addEventListener('click', () => openTripModal(t));
    }

    const updateBtn = tr.querySelector(`[data-trip-manage="${t.id}"]`);
    if (updateBtn) {
      updateBtn.addEventListener('click', async () => {
        const nextStatus = t.status === 'scheduled' ? 'in_progress' : (t.status === 'in_progress' ? 'completed' : 'scheduled');
        try {
          await apiFetch(`/trips/${t.id}/status`, {
            method: 'PATCH',
            body: { status: nextStatus },
          });
          if (window.showToast) {
            window.showToast.success(`Trip status updated to ${nextStatus.replace('_', ' ')}!`, 'Trip Updated');
          }
          await loadTrips();
        } catch (err) {
          if (window.showToast) {
            window.showToast.error(err.message || 'Could not update trip status.', 'Error');
          }
        }
      });
    }
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
    window.showTableSkeleton(tripTableBody, 7);
  } else {
    tripTableBody.innerHTML = `<tr><td colspan="7" class="workspace-empty">Loading trip records…</td></tr>`;
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
    tripTableBody.innerHTML = `<tr><td colspan="7" class="workspace-empty" style="color: var(--coral);">Failed to load trip schedules: ${escapeHtml(error.message)}</td></tr>`;
  }
}

async function openTripModal(trip = null) {
  if (!tripForm || !tripModal) return;
  tripForm.reset();
  if (tripAlert) tripAlert.hidden = true;
  tripSubmitBtn.disabled = false;
  editingTripId = trip ? trip.id : null;
  await loadDropdowns();

  if (trip) {
    if (tripModalTitle) tripModalTitle.textContent = 'Edit scheduled trip';
    if (tripSubmitBtn) tripSubmitBtn.textContent = 'Save changes';

    if (tripOriginInput) {
      tripOriginInput.value = trip.origin || '';
      tripOriginInput.readOnly = true;
    }
    if (tripDestinationInput) {
      tripDestinationInput.value = trip.destination || '';
      tripDestinationInput.readOnly = true;
    }
    if (tripVehicleSelect) tripVehicleSelect.value = trip.vehicle_id || '';
    if (tripDriverSelect) tripDriverSelect.value = trip.driver_id || '';

    const startStr = trip.scheduled_start ? new Date(trip.scheduled_start).toISOString().slice(0, 16) : '';
    const endStr = trip.scheduled_end ? new Date(trip.scheduled_end).toISOString().slice(0, 16) : '';
    const startInp = document.querySelector('#trip-start');
    const endInp = document.querySelector('#trip-end');
    if (startInp) startInp.value = startStr;
    if (endInp) endInp.value = endStr;
  } else {
    if (tripModalTitle) tripModalTitle.textContent = 'Schedule new trip';
    if (tripSubmitBtn) tripSubmitBtn.textContent = 'Schedule trip';

    if (tripOriginInput) tripOriginInput.readOnly = false;
    if (tripDestinationInput) tripDestinationInput.readOnly = false;

    const now = new Date();
    const startStr = new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 16);
    const endStr = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 16);
    const startInp = document.querySelector('#trip-start');
    const endInp = document.querySelector('#trip-end');
    if (startInp) startInp.value = startStr;
    if (endInp) endInp.value = endStr;
  }

  tripModal.showModal();
}

// Modal controls
if (openTripModalBtn) {
  openTripModalBtn.addEventListener('click', () => openTripModal(null));
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
    const origin = formData.get('origin')?.trim() || '';
    const destination = formData.get('destination')?.trim() || '';

    const body = {
      origin,
      destination,
      vehicle_id: formData.get('vehicle_id'),
      driver_id: formData.get('driver_id'),
      scheduled_start: formData.get('scheduled_start'),
      scheduled_end: formData.get('scheduled_end'),
    };

    try {
      if (editingTripId) {
        await apiFetch(`/trips/${editingTripId}`, {
          method: 'PATCH',
          body: {
            vehicle_id: body.vehicle_id,
            driver_id: body.driver_id,
            scheduled_start: body.scheduled_start,
            scheduled_end: body.scheduled_end,
          },
        });
        if (window.showToast) {
          window.showToast.success('Trip schedule updated successfully!', 'Trip Saved');
        }
      } else {
        await apiFetch('/trips', {
          method: 'POST',
          body,
        });
        const routeDesc = origin && destination ? `${origin} to ${destination}` : 'Scheduled route';
        if (window.showToast) {
          window.showToast.success(`Trip for ${routeDesc} scheduled successfully!`, 'Trip Scheduled');
        }
      }

      tripModal.close();
      tripForm.reset();
      await loadTrips();
    } catch (err) {
      console.error('Could not schedule trip:', err);
      tripSubmitBtn.disabled = false;
      if (window.showAlert) {
        window.showAlert('#trip-alert', err.message || 'Failed to save trip.', 'error', 'Scheduling Error');
      }
      if (window.showToast) {
        window.showToast.error(err.message || 'Could not save trip.', 'Error');
      }
    }
  });
}

if (tripSearchInput) tripSearchInput.addEventListener('input', filterTrips);
if (tripStatusFilter) tripStatusFilter.addEventListener('change', filterTrips);

loadTrips();
loadDropdowns();
