/**
 * TMS – incidents.js
 * Driver safety incidents, severity classification, logging, viewing, and editing.
 */

let allIncidents = [];
let availableDrivers = [];
let editingIncidentId = null;

const incidentTableBody = document.querySelector('#incidents-table tbody');
const incidentCountEl = document.querySelector('#incidents-count');
const incidentSearchInput = document.querySelector('#incident-search');
const incidentSeverityFilter = document.querySelector('#incident-severity-filter');
const reportIncidentBtn = document.querySelector('#report-incident-btn');
const incidentDialog = document.querySelector('#incident-dialog');
const incidentForm = document.querySelector('#incident-form');
const driverSelectEl = document.querySelector('#inc-driver');
const formMessage = document.querySelector('#incident-form-message');
const incidentDialogEyebrow = document.querySelector('#incident-dialog-eyebrow');
const incidentDialogTitle = document.querySelector('#incident-dialog-title');
const incidentSubmitBtn = document.querySelector('#incident-submit-btn');

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

function getSeverityBadge(sev) {
  const s = String(sev || '').toLowerCase();
  const map = {
    low: 'badge-blue',
    medium: 'badge-amber',
    high: 'badge-red',
  };
  const cls = map[s] || 'badge-gray';
  return `<span class="badge ${cls}" style="text-transform: uppercase; font-size: 0.7rem;">${s}</span>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function openIncidentEditDialog(inc) {
  if (!incidentDialog || !incidentForm) return;
  editingIncidentId = inc ? inc.id : null;
  if (formMessage) formMessage.textContent = '';
  await populateDriverSelect();

  if (inc) {
    if (incidentDialogEyebrow) incidentDialogEyebrow.textContent = 'SAFETY INCIDENT MANAGEMENT';
    if (incidentDialogTitle) incidentDialogTitle.textContent = 'Edit incident report';
    if (incidentSubmitBtn) incidentSubmitBtn.textContent = 'Save changes';

    if (driverSelectEl) driverSelectEl.value = inc.driver_id || '';
    const sevSelect = incidentForm.querySelector('#inc-severity');
    if (sevSelect) sevSelect.value = inc.severity || 'low';
    const dateInput = incidentForm.querySelector('#inc-date');
    if (dateInput) dateInput.value = formatDateForInput(inc.incident_date);
    const descInput = incidentForm.querySelector('#inc-desc');
    if (descInput) descInput.value = inc.description || '';
  } else {
    if (incidentDialogEyebrow) incidentDialogEyebrow.textContent = 'SAFETY LOGGING';
    if (incidentDialogTitle) incidentDialogTitle.textContent = 'Log driver incident';
    if (incidentSubmitBtn) incidentSubmitBtn.textContent = 'Submit incident report';

    incidentForm.reset();
    const today = new Date().toISOString().split('T')[0];
    const dateInput = incidentForm.querySelector('#inc-date');
    if (dateInput) dateInput.value = today;
  }

  incidentDialog.showModal();
}

function openIncidentDetails(inc) {
  const modal = document.querySelector('#view-incident-dialog');
  if (!modal) return;
  const driverName = inc.first_name || inc.last_name
    ? `${inc.first_name || ''} ${inc.last_name || ''}`.trim()
    : 'Unassigned driver';
  const licenceNumber = inc.license_number ? ` (${inc.license_number})` : '';

  const sevEl = document.querySelector('#view-inc-severity');
  if (sevEl) sevEl.innerHTML = getSeverityBadge(inc.severity);
  const dateEl = document.querySelector('#view-inc-date');
  if (dateEl) dateEl.textContent = formatDate(inc.incident_date);
  const drvEl = document.querySelector('#view-inc-driver');
  if (drvEl) drvEl.textContent = `${driverName}${licenceNumber}`;
  const descEl = document.querySelector('#view-inc-desc');
  if (descEl) descEl.textContent = inc.description || 'No description recorded.';
  
  const tripWrapper = document.querySelector('#view-inc-trip-wrapper');
  const tripEl = document.querySelector('#view-inc-trip');
  if (tripWrapper && tripEl) {
    if (inc.trip_id) {
      tripWrapper.hidden = false;
      tripEl.textContent = inc.trip_id;
    } else {
      tripWrapper.hidden = true;
    }
  }
  modal.showModal();
}

function renderIncidents(incidents) {
  if (!incidentTableBody) return;
  incidentTableBody.replaceChildren();

  if (incidents.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" class="workspace-empty">No driver incident reports found.</td>`;
    incidentTableBody.append(tr);
    if (incidentCountEl) incidentCountEl.textContent = '0 incidents recorded';
    return;
  }

  for (const inc of incidents) {
    const driverName = inc.first_name || inc.last_name
      ? `${inc.first_name || ''} ${inc.last_name || ''}`.trim()
      : 'Unassigned driver';
    const licenceNumber = inc.license_number ? ` (${inc.license_number})` : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${formatDate(inc.incident_date)}</strong></td>
      <td>
        <div>
          <strong>${escapeHtml(driverName)}</strong>
          <span style="color: var(--ink-soft); font-size: 0.78rem;">${escapeHtml(licenceNumber)}</span>
        </div>
      </td>
      <td>${getSeverityBadge(inc.severity)}</td>
      <td style="color: var(--ink);">${escapeHtml(inc.description || '—')}</td>
      <td style="text-align: right;">
        <div class="table-actions">
          <button type="button" class="button button-secondary button-sm" data-incident-view="${inc.id}">View</button>
          <button type="button" class="button button-sm" data-incident-edit="${inc.id}">Edit</button>
        </div>
      </td>
    `;

    const viewBtn = tr.querySelector(`[data-incident-view="${inc.id}"]`);
    if (viewBtn) {
      viewBtn.addEventListener('click', () => openIncidentDetails(inc));
    }
    const editBtn = tr.querySelector(`[data-incident-edit="${inc.id}"]`);
    if (editBtn) {
      editBtn.addEventListener('click', () => openIncidentEditDialog(inc));
    }

    incidentTableBody.append(tr);
  }

  if (incidentCountEl) {
    incidentCountEl.textContent = `${incidents.length} ${incidents.length === 1 ? 'incident' : 'incidents'} on record`;
  }
}

function filterIncidents() {
  const query = (incidentSearchInput?.value || '').trim().toLowerCase();
  const severity = (incidentSeverityFilter?.value || '').trim().toLowerCase();

  const filtered = allIncidents.filter((inc) => {
    const driver = `${inc.first_name || ''} ${inc.last_name || ''} ${inc.license_number || ''}`.toLowerCase();
    const desc = (inc.description || '').toLowerCase();
    const matchesQuery = !query || driver.includes(query) || desc.includes(query);
    const matchesSeverity = !severity || inc.severity === severity;
    return matchesQuery && matchesSeverity;
  });

  renderIncidents(filtered);
}

async function loadIncidents() {
  if (!incidentTableBody) return;
  if (window.showTableSkeleton) {
    window.showTableSkeleton(incidentTableBody, 5);
  } else {
    incidentTableBody.innerHTML = `<tr><td colspan="5" class="workspace-empty">Loading driver incident reports…</td></tr>`;
  }

  try {
    const data = await apiFetch('/incidents');
    if (!Array.isArray(data)) {
      throw new Error('Invalid incidents API response.');
    }
    allIncidents = data;
    renderIncidents(allIncidents);
  } catch (error) {
    console.error('Could not load incidents:', error);
    incidentTableBody.innerHTML = `<tr><td colspan="5" class="workspace-empty" style="color: var(--coral);">Failed to load incidents: ${escapeHtml(error.message)}</td></tr>`;
  }
}

async function populateDriverSelect() {
  if (!driverSelectEl) return;
  try {
    const drivers = await apiFetch('/drivers');
    if (Array.isArray(drivers)) {
      availableDrivers = drivers;
      driverSelectEl.innerHTML = '<option value="">Select a driver</option>' +
        drivers.map(d => `<option value="${d.id}">${escapeHtml(d.first_name)} ${escapeHtml(d.last_name)} (${escapeHtml(d.license_number)})</option>`).join('');
    }
  } catch (err) {
    console.error('Could not load drivers for incident form:', err);
  }
}

if (incidentSearchInput) incidentSearchInput.addEventListener('input', filterIncidents);
if (incidentSeverityFilter) incidentSeverityFilter.addEventListener('change', filterIncidents);

if (reportIncidentBtn && incidentDialog) {
  reportIncidentBtn.addEventListener('click', () => openIncidentEditDialog(null));
}

if (incidentForm && incidentDialog) {
  incidentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (formMessage) {
      formMessage.dataset.state = '';
      formMessage.textContent = 'Saving incident report…';
    }

    const formData = new FormData(incidentForm);
    const body = {
      driver_id: formData.get('driver_id'),
      severity: formData.get('severity') || 'low',
      incident_date: formData.get('incident_date'),
      description: formData.get('description')?.trim(),
    };

    try {
      if (editingIncidentId) {
        await apiFetch(`/incidents/${editingIncidentId}`, {
          method: 'PATCH',
          body,
        });
        if (window.showToast) {
          window.showToast.success('Driver safety incident report updated successfully!', 'Incident Saved');
        }
      } else {
        await apiFetch('/incidents', {
          method: 'POST',
          body,
        });
        if (window.showToast) {
          window.showToast.success('Driver safety incident report logged successfully!', 'Incident Recorded');
        }
      }

      incidentDialog.close();
      await loadIncidents();
    } catch (err) {
      if (formMessage) {
        formMessage.dataset.state = 'error';
        formMessage.textContent = err.message || 'Could not save incident.';
      }
      if (window.showToast) {
        window.showToast.error(err.message || 'Could not save incident.', 'Submission Failed');
      }
    }
  });
}

loadIncidents();
