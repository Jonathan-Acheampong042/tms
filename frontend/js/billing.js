/**
 * TMS – billing.js
 * Invoices & Payments tab management, filtering, pagination, and exports.
 */

// Tab switching controller
(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab') || 'invoices';

  function activateTab(tabName) {
    const validTabs = ['invoices', 'payments'];
    const activeTab = validTabs.includes(tabName) ? tabName : 'invoices';

    document.querySelectorAll('.billing-tab-btn').forEach((btn) => {
      const active = btn.dataset.tab === activeTab;
      btn.setAttribute('aria-selected', String(active));
    });

    document.querySelectorAll('.billing-tab-panel').forEach((panel) => {
      const isCurrent = panel.id === `tab-${activeTab}`;
      panel.setAttribute('aria-hidden', String(!isCurrent));
    });

    const newUrl = activeTab === 'invoices'
      ? window.location.pathname
      : `${window.location.pathname}?tab=${activeTab}`;
    window.history.replaceState({ tab: activeTab }, '', newUrl);

    if (typeof window.updateSidebarActiveBillingTab === 'function') {
      window.updateSidebarActiveBillingTab(activeTab);
    }
  }

  document.querySelectorAll('.billing-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });

  window.addEventListener('popstate', (e) => {
    activateTab((e.state && e.state.tab) || 'invoices');
  });

  window.switchBillingTab = activateTab;

  activateTab(initialTab);
})();

const billingResources = {
  invoices: {
    form: document.querySelector('#invoices-filters'),
    table: document.querySelector('#invoices-table tbody'),
    message: document.querySelector('#invoices-status-message'),
    columns: [
      ['invoice_number', 'Invoice number'],
      ['amount', 'Amount'],
      ['issued_date', 'Issued'],
      ['due_date', 'Due date'],
      ['status', 'Status'],
    ],
  },
  payments: {
    form: document.querySelector('#payments-filters'),
    table: document.querySelector('#payments-table tbody'),
    message: document.querySelector('#payments-status-message'),
    columns: [
      ['invoice_number', 'Invoice'],
      ['amount', 'Amount'],
      ['method', 'Method'],
      ['status', 'Status'],
      ['created_at', 'Date'],
    ],
  },
};

const billingPages = { invoices: 1, payments: 1 };
const billingRequestIds = { invoices: 0, payments: 0 };
const billingAppliedFilters = {};
const ghanaCedi = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'GHS',
});

function billingDate(value) {
  if (!value) return '—';
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split('-');
    return `${day}/${month}/${year}`;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? text : date.toLocaleDateString();
}

function billingValue(key, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'amount') {
    const amount = Number(value);
    return Number.isFinite(amount) ? ghanaCedi.format(amount) : String(value);
  }
  if (key.endsWith('_date') || key === 'created_at') return billingDate(value);
  return String(value).replaceAll('_', ' ');
}

function readFormFilters(resource) {
  const formData = new FormData(billingResources[resource].form);
  const filters = new URLSearchParams();
  for (const key of ['pageSize', 'search', 'status', 'from', 'to']) {
    const value = String(formData.get(key) ?? '').trim();
    if (value) filters.set(key, value);
  }
  return filters;
}

function currentFilters(resource) {
  const filters = new URLSearchParams(billingAppliedFilters[resource]);
  filters.set('page', String(billingPages[resource]));
  return filters;
}

function renderBillingRows(resource, rows) {
  const config = billingResources[resource];
  config.table.replaceChildren();

  if (rows.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = config.columns.length;
    cell.className = 'workspace-empty';
    cell.textContent = 'No matching records were found.';
    row.append(cell);
    config.table.append(row);
    return;
  }

  for (const record of rows) {
    const row = document.createElement('tr');
    for (const [key] of config.columns) {
      const cell = document.createElement('td');
      if (key === 'status') {
        const val = String(record[key] || '').toLowerCase();
        const badge = document.createElement('span');
        const map = {
          paid: 'badge-green',
          completed: 'badge-green',
          unpaid: 'badge-amber',
          pending: 'badge-amber',
          overdue: 'badge-red',
          failed: 'badge-red',
        };
        badge.className = `badge ${map[val] || 'badge-gray'}`;
        badge.textContent = billingValue(key, record[key]);
        cell.append(badge);
      } else {
        cell.textContent = billingValue(key, record[key]);
      }
      row.append(cell);
    }
    config.table.append(row);
  }
}

async function loadBillingPage(resource) {
  const config = billingResources[resource];
  const filters = currentFilters(resource);
  const requestId = ++billingRequestIds[resource];
  const previous = document.querySelector(`[data-page-direction="-1"][data-page-resource="${resource}"]`);
  const next = document.querySelector(`[data-page-direction="1"][data-page-resource="${resource}"]`);
  previous.disabled = true;
  next.disabled = true;
  config.message.dataset.state = '';
  config.message.textContent = '';

  // Show skeleton rows while loading
  if (window.showTableSkeleton) {
    window.showTableSkeleton(config.table, config.columns.length);
  } else {
    config.message.textContent = 'Loading records…';
  }

  try {
    const result = await apiFetch(`/billing/${resource}?${filters.toString()}`);
    if (requestId !== billingRequestIds[resource]) return;
    if (!result || !Array.isArray(result.items) || !Number.isInteger(result.total)) {
      throw new Error('The billing endpoint returned an invalid response.');
    }

    renderBillingRows(resource, result.items);
    const totalPages = Math.max(result.totalPages, 1);
    document.querySelector(`[data-page-label="${resource}"]`).textContent =
      `Page ${result.page} of ${totalPages} · ${result.total} ${result.total === 1 ? 'record' : 'records'}`;
    document.querySelector(`[data-page-direction="-1"][data-page-resource="${resource}"]`).disabled =
      result.page <= 1;
    document.querySelector(`[data-page-direction="1"][data-page-resource="${resource}"]`).disabled =
      result.page >= totalPages;
    config.message.textContent = '';
  } catch (error) {
    if (requestId !== billingRequestIds[resource]) return;
    console.error(`Could not load ${resource}:`, error);
    renderBillingRows(resource, []);
    config.message.dataset.state = '';
    config.message.textContent = error.message || `Could not load ${resource}.`;
    previous.disabled = billingPages[resource] <= 1;
    next.disabled = true;
  }
}

async function downloadBillingExport(resource, format, button) {
  const query = new URLSearchParams(billingAppliedFilters[resource]);
  query.delete('page');
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = 'Preparing…';

  try {
    const response = await fetch(`${BASE_URL}/billing/${resource}/export?${query.toString()}&format=${encodeURIComponent(format)}`);
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || `Export failed (${response.status}).`);
    }
    const file = await response.blob();
    const url = URL.createObjectURL(file);
    const download = document.createElement('a');
    download.href = url;
    download.download = `${resource}.${format}`;
    document.body.append(download);
    download.click();
    download.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    const config = billingResources[resource];
    config.message.dataset.state = '';
    config.message.textContent = error.message || 'Could not generate the export.';
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

for (const [resource, config] of Object.entries(billingResources)) {
  billingAppliedFilters[resource] = readFormFilters(resource);
  config.form.addEventListener('submit', (event) => {
    event.preventDefault();
    billingPages[resource] = 1;
    billingAppliedFilters[resource] = readFormFilters(resource);
    loadBillingPage(resource);
  });
}

document.querySelectorAll('[data-page-direction]').forEach((button) => {
  button.addEventListener('click', () => {
    const resource = button.dataset.pageResource;
    billingPages[resource] += Number(button.dataset.pageDirection);
    loadBillingPage(resource);
  });
});

document.querySelectorAll('[data-export-resource]').forEach((button) => {
  button.addEventListener('click', () => {
    downloadBillingExport(
      button.dataset.exportResource,
      button.dataset.exportFormat,
      button
    );
  });
});

for (const resource of Object.keys(billingResources)) loadBillingPage(resource);

// Invoice Modal Logic
const openInvoiceModalBtn = document.querySelector('#open-invoice-modal-btn');
const createInvoiceModal = document.querySelector('#create-invoice-modal');
const createInvoiceForm = document.querySelector('#create-invoice-form');
const createInvoiceClose = document.querySelector('#create-invoice-close');
const createInvoiceCancel = document.querySelector('#create-invoice-cancel');
const createInvoiceSubmit = document.querySelector('#create-invoice-submit');
const invoiceAlert = document.querySelector('#invoice-alert');

if (openInvoiceModalBtn && createInvoiceModal) {
  openInvoiceModalBtn.addEventListener('click', () => {
    createInvoiceForm.reset();
    const today = new Date();
    const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const dueDateInput = document.querySelector('#inv-due-date');
    if (dueDateInput) dueDateInput.value = in30Days.toISOString().slice(0, 10);
    if (invoiceAlert) invoiceAlert.hidden = true;
    createInvoiceSubmit.disabled = false;
    createInvoiceModal.showModal();
  });
}
if (createInvoiceClose && createInvoiceModal) {
  createInvoiceClose.addEventListener('click', () => createInvoiceModal.close());
}
if (createInvoiceCancel && createInvoiceModal) {
  createInvoiceCancel.addEventListener('click', () => createInvoiceModal.close());
}
if (createInvoiceModal) {
  createInvoiceModal.addEventListener('click', (e) => {
    if (e.target === createInvoiceModal) createInvoiceModal.close();
  });
}

if (createInvoiceForm) {
  createInvoiceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (invoiceAlert) invoiceAlert.hidden = true;
    createInvoiceSubmit.disabled = true;

    const formData = new FormData(createInvoiceForm);
    const body = {
      invoice_number: formData.get('invoice_number')?.trim() || null,
      amount: Number(formData.get('amount')),
      due_date: formData.get('due_date'),
      status: formData.get('status') || 'unpaid',
    };

    try {
      const newInv = await apiFetch('/invoices', { method: 'POST', body });
      createInvoiceModal.close();
      createInvoiceForm.reset();
      loadBillingPage('invoices');
      if (window.showToast) {
        window.showToast.success(`Invoice ${newInv.invoice_number || 'entry'} generated successfully!`, 'Invoice Created');
      }
    } catch (err) {
      console.error('Could not create invoice:', err);
      createInvoiceSubmit.disabled = false;
      if (window.showAlert) {
        window.showAlert('#invoice-alert', err.message || 'Failed to create invoice.', 'error');
      }
      if (window.showToast) {
        window.showToast.error(err.message || 'Could not create invoice.', 'Error');
      }
    }
  });
}

// Payment Modal Logic
const openPaymentModalBtn = document.querySelector('#open-payment-modal-btn');
const createPaymentModal = document.querySelector('#create-payment-modal');
const createPaymentForm = document.querySelector('#create-payment-form');
const createPaymentClose = document.querySelector('#create-payment-close');
const createPaymentCancel = document.querySelector('#create-payment-cancel');
const createPaymentSubmit = document.querySelector('#create-payment-submit');
const paymentAlert = document.querySelector('#payment-alert');
const payInvoiceSelect = document.querySelector('#pay-invoice-id');

async function populateInvoiceSelect() {
  if (!payInvoiceSelect) return;
  payInvoiceSelect.innerHTML = '<option value="">Loading invoices…</option>';
  try {
    const res = await apiFetch('/billing/invoices?pageSize=50');
    const items = res?.items || [];
    payInvoiceSelect.innerHTML = '<option value="">Select invoice to pay…</option>';
    for (const inv of items) {
      const opt = document.createElement('option');
      opt.value = inv.id;
      opt.textContent = `${inv.invoice_number} — ${ghanaCedi.format(inv.amount)} (${inv.status})`;
      payInvoiceSelect.append(opt);
    }
  } catch (err) {
    payInvoiceSelect.innerHTML = '<option value="">Failed to load invoices</option>';
  }
}

if (openPaymentModalBtn && createPaymentModal) {
  openPaymentModalBtn.addEventListener('click', async () => {
    createPaymentForm.reset();
    if (paymentAlert) paymentAlert.hidden = true;
    createPaymentSubmit.disabled = false;
    await populateInvoiceSelect();
    createPaymentModal.showModal();
  });
}
if (createPaymentClose && createPaymentModal) {
  createPaymentClose.addEventListener('click', () => createPaymentModal.close());
}
if (createPaymentCancel && createPaymentModal) {
  createPaymentCancel.addEventListener('click', () => createPaymentModal.close());
}
if (createPaymentModal) {
  createPaymentModal.addEventListener('click', (e) => {
    if (e.target === createPaymentModal) createPaymentModal.close();
  });
}

if (createPaymentForm) {
  createPaymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (paymentAlert) paymentAlert.hidden = true;
    createPaymentSubmit.disabled = true;

    const formData = new FormData(createPaymentForm);
    const body = {
      invoice_id: formData.get('invoice_id'),
      amount: Number(formData.get('amount')),
      method: formData.get('method'),
      status: formData.get('status') || 'completed',
    };

    try {
      await apiFetch('/payments', { method: 'POST', body });
      createPaymentModal.close();
      createPaymentForm.reset();
      loadBillingPage('payments');
      loadBillingPage('invoices');
      if (window.showToast) {
        window.showToast.success(`Payment of ${ghanaCedi.format(body.amount)} recorded successfully!`, 'Payment Logged');
      }
    } catch (err) {
      console.error('Could not record payment:', err);
      createPaymentSubmit.disabled = false;
      if (window.showAlert) {
        window.showAlert('#payment-alert', err.message || 'Failed to record payment.', 'error');
      }
      if (window.showToast) {
        window.showToast.error(err.message || 'Could not record payment.', 'Error');
      }
    }
  });
}
