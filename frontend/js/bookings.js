/**
 * TMS – bookings.js
 * Customer transport bookings, cargo/passenger requests, and status tracking.
 */

let allBookings = [];

const bookingTableBody = document.querySelector('#bookings-table tbody');
const bookingCountEl = document.querySelector('#bookings-count');
const bookingSearchInput = document.querySelector('#booking-search');
const bookingStatusFilter = document.querySelector('#booking-status-filter');
const bookingTypeFilter = document.querySelector('#booking-type-filter');
const openBookingModalBtn = document.querySelector('#open-booking-modal-btn');
const bookingModal = document.querySelector('#booking-modal');
const bookingForm = document.querySelector('#booking-form');
const bookingModalClose = document.querySelector('#booking-modal-close');
const bookingModalCancel = document.querySelector('#booking-modal-cancel');
const bookingSubmitBtn = document.querySelector('#booking-submit-btn');
const bookingAlert = document.querySelector('#booking-alert');
const bookTypeSelect = document.querySelector('#book-type');
const cargoWeightField = document.querySelector('#cargo-weight-field');

function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleDateString();
}

function getStatusBadge(status) {
  const s = String(status || '').toLowerCase();
  const map = {
    pending: 'badge-amber',
    allocated: 'badge-blue',
    dispatched: 'badge-blue',
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

function renderBookings(bookings) {
  if (!bookingTableBody) return;
  bookingTableBody.replaceChildren();

  if (bookings.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" class="workspace-empty">No booking records found.</td>`;
    bookingTableBody.append(tr);
    if (bookingCountEl) bookingCountEl.textContent = '0 bookings';
    return;
  }

  for (const b of bookings) {
    const typeBadge = b.booking_type === 'cargo'
      ? '<span class="badge badge-amber">Cargo</span>'
      : '<span class="badge badge-blue">Passenger</span>';

    const cargoDetail = b.weight ? `${b.weight} kg cargo` : 'Passenger transport';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${typeBadge}</td>
      <td><strong>${escapeHtml(b.pickup || '—')}</strong></td>
      <td><strong>${escapeHtml(b.dropoff || '—')}</strong></td>
      <td style="color: var(--ink-soft);">${escapeHtml(cargoDetail)}</td>
      <td>${getStatusBadge(b.status)}</td>
      <td>${formatDate(b.created_at)}</td>
    `;
    bookingTableBody.append(tr);
  }

  if (bookingCountEl) {
    bookingCountEl.textContent = `${bookings.length} ${bookings.length === 1 ? 'booking' : 'bookings'} recorded`;
  }
}

function filterBookings() {
  const query = (bookingSearchInput?.value || '').trim().toLowerCase();
  const status = (bookingStatusFilter?.value || '').trim().toLowerCase();
  const type = (bookingTypeFilter?.value || '').trim().toLowerCase();

  const filtered = allBookings.filter((b) => {
    const pickup = (b.pickup || '').toLowerCase();
    const dropoff = (b.dropoff || '').toLowerCase();
    const matchesSearch = !query || pickup.includes(query) || dropoff.includes(query);
    const matchesStatus = !status || b.status === status;
    const matchesType = !type || b.booking_type === type;
    return matchesSearch && matchesStatus && matchesType;
  });

  renderBookings(filtered);
}

async function loadBookings() {
  if (!bookingTableBody) return;
  if (window.showTableSkeleton) {
    window.showTableSkeleton(bookingTableBody, 6);
  } else {
    bookingTableBody.innerHTML = `<tr><td colspan="6" class="workspace-empty">Loading booking records…</td></tr>`;
  }

  try {
    const data = await apiFetch('/bookings');
    if (!Array.isArray(data)) {
      throw new Error('Invalid bookings API response.');
    }
    allBookings = data;
    renderBookings(allBookings);
  } catch (error) {
    console.error('Could not load bookings:', error);
    bookingTableBody.innerHTML = `<tr><td colspan="6" class="workspace-empty" style="color: var(--coral);">Failed to load transport bookings: ${escapeHtml(error.message)}</td></tr>`;
  }
}

// Modal controls
if (bookTypeSelect && cargoWeightField) {
  bookTypeSelect.addEventListener('change', () => {
    cargoWeightField.hidden = bookTypeSelect.value !== 'cargo';
  });
}

if (openBookingModalBtn && bookingModal) {
  openBookingModalBtn.addEventListener('click', () => {
    bookingForm.reset();
    if (cargoWeightField) cargoWeightField.hidden = true;
    if (bookingAlert) bookingAlert.hidden = true;
    bookingSubmitBtn.disabled = false;
    bookingModal.showModal();
  });
}
if (bookingModalClose && bookingModal) {
  bookingModalClose.addEventListener('click', () => bookingModal.close());
}
if (bookingModalCancel && bookingModal) {
  bookingModalCancel.addEventListener('click', () => bookingModal.close());
}
if (bookingModal) {
  bookingModal.addEventListener('click', (e) => {
    if (e.target === bookingModal) bookingModal.close();
  });
}

// Form submission
if (bookingForm) {
  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (bookingAlert) bookingAlert.hidden = true;
    bookingSubmitBtn.disabled = true;

    let user_id = null;
    try {
      const u = JSON.parse(sessionStorage.getItem('tms.currentUser'));
      user_id = u?.id || null;
    } catch (_) {}

    const formData = new FormData(bookingForm);
    const booking_type = formData.get('booking_type');
    const weightVal = formData.get('weight');
    const body = {
      booking_type,
      pickup: formData.get('pickup')?.trim(),
      dropoff: formData.get('dropoff')?.trim(),
      weight: booking_type === 'cargo' && weightVal ? Number(weightVal) : null,
      status: 'pending',
      user_id,
    };

    try {
      await apiFetch('/bookings', {
        method: 'POST',
        body,
      });

      bookingModal.close();
      bookingForm.reset();
      await loadBookings();

      if (window.showToast) {
        window.showToast.success(`Booking from ${body.pickup} to ${body.dropoff} submitted successfully!`, 'Booking Created');
      }
    } catch (err) {
      console.error('Could not create booking:', err);
      bookingSubmitBtn.disabled = false;
      if (window.showAlert) {
        window.showAlert('#booking-alert', err.message || 'Failed to submit transport booking.', 'error', 'Booking Error');
      }
      if (window.showToast) {
        window.showToast.error(err.message || 'Could not submit booking.', 'Error');
      }
    }
  });
}

if (bookingSearchInput) bookingSearchInput.addEventListener('input', filterBookings);
if (bookingStatusFilter) bookingStatusFilter.addEventListener('change', filterBookings);
if (bookingTypeFilter) bookingTypeFilter.addEventListener('change', filterBookings);

loadBookings();
