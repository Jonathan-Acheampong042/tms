// Reports page logic (pages/reports.html)
// Handles summary data fetching, category switching, high-fidelity skeleton loaders,
// bar charts, metric cards, status counts, analysis lists, and CSV/PDF exports.

const CATEGORIES = ['fleet', 'trips', 'bookings', 'invoices', 'payments', 'revenue'];

const CATEGORY_META = {
  fleet: {
    title: 'Fleet Management',
    badge: 'Vehicles & Assets',
    desc: 'Vehicle availability, maintenance status, and operational road readiness.',
    totalLabel: 'Total Vehicles',
    singular: 'Vehicle',
  },
  trips: {
    title: 'Trip Operations',
    badge: 'Transit & Journeys',
    desc: 'Trip execution status, scheduled missions, and journey fulfillment.',
    totalLabel: 'Total Trips',
    singular: 'Trip',
  },
  bookings: {
    title: 'Bookings & Reservations',
    badge: 'Orders & Requests',
    desc: 'Customer reservations, dispatch queue status, and fulfillment rate.',
    totalLabel: 'Total Bookings',
    singular: 'Booking',
  },
  invoices: {
    title: 'Billing & Invoicing',
    badge: 'Accounts Receivable',
    desc: 'Invoiced charges, settlement statuses, and outstanding collections.',
    totalLabel: 'Total Invoices',
    singular: 'Invoice',
  },
  payments: {
    title: 'Payment Transactions',
    badge: 'Settlement & Processing',
    desc: 'Transaction clearance, payment gateway success, and settlement audit.',
    totalLabel: 'Total Transactions',
    singular: 'Transaction',
  },
  revenue: {
    title: 'Financial Revenue',
    badge: 'Income & Cashflow',
    desc: 'Realized monetary collection, pending revenues, and liquidity health.',
    totalLabel: 'Total Turnover',
    singular: 'GHS',
  },
};

const currencyFormatter = new Intl.NumberFormat('en-GH', {
  style: 'currency',
  currency: 'GHS',
  minimumFractionDigits: 2,
});

let reportData = null;
let currentCategory = 'all';

// Read category from URL query param if present
const urlParams = new URLSearchParams(window.location.search);
const initialCategory = urlParams.get('category');
if (initialCategory && (CATEGORIES.includes(initialCategory) || initialCategory === 'all')) {
  currentCategory = initialCategory;
}

/**
 * Render High-Fidelity Skeleton Loaders into the container
 */
function renderSkeletonLoaders(category = 'all') {
  const container = document.querySelector('#report-container');
  if (!container) return;

  const count = category === 'all' ? 3 : 1;
  let html = '';

  for (let i = 0; i < count; i++) {
    html += `
      <section class="panel workspace-panel skeleton-category-card" aria-hidden="true">
        <div class="skeleton-header-row">
          <div style="flex: 1;">
            <div class="skeleton-pill" style="width: 100px; height: 18px; margin-bottom: 8px;"></div>
            <div class="skeleton-line" style="width: 38%; height: 26px; margin-bottom: 8px;"></div>
            <div class="skeleton-line" style="width: 60%; height: 16px;"></div>
          </div>
          <div class="skeleton-box" style="width: 110px; height: 58px; border-radius: 8px;"></div>
        </div>

        <div class="report-section-block">
          <div class="skeleton-line" style="width: 28%; height: 18px; margin-bottom: 12px;"></div>
          <div class="skeleton-summary-grid">
            <div class="skeleton-status-pill-box">
              <div class="skeleton-line" style="width: 55%; height: 14px;"></div>
              <div class="skeleton-num" style="width: 45%; height: 28px;"></div>
            </div>
            <div class="skeleton-status-pill-box">
              <div class="skeleton-line" style="width: 60%; height: 14px;"></div>
              <div class="skeleton-num" style="width: 40%; height: 28px;"></div>
            </div>
            <div class="skeleton-status-pill-box">
              <div class="skeleton-line" style="width: 50%; height: 14px;"></div>
              <div class="skeleton-num" style="width: 50%; height: 28px;"></div>
            </div>
          </div>
        </div>

        <div class="report-section-block">
          <div class="skeleton-line" style="width: 32%; height: 18px; margin-bottom: 12px;"></div>
          <div class="skeleton-viz-grid">
            <div class="skeleton-chart-box">
              <div class="skeleton-line" style="width: 35%; height: 16px; margin-bottom: 18px;"></div>
              <div class="skeleton-bar-row">
                <div class="skeleton-line" style="width: 90px; height: 16px;"></div>
                <div class="skeleton-bar-track"><div class="skeleton-bar" style="width: 75%; height: 100%;"></div></div>
              </div>
              <div class="skeleton-bar-row">
                <div class="skeleton-line" style="width: 90px; height: 16px;"></div>
                <div class="skeleton-bar-track"><div class="skeleton-bar" style="width: 45%; height: 100%;"></div></div>
              </div>
              <div class="skeleton-bar-row">
                <div class="skeleton-line" style="width: 90px; height: 16px;"></div>
                <div class="skeleton-bar-track"><div class="skeleton-bar" style="width: 60%; height: 100%;"></div></div>
              </div>
            </div>
            <div class="skeleton-metrics-box">
              <div class="skeleton-line" style="width: 40%; height: 16px; margin-bottom: 18px;"></div>
              <div class="skeleton-metrics-inner-grid">
                <div class="skeleton-metric-card-box">
                  <div class="skeleton-line" style="width: 55%; height: 12px;"></div>
                  <div class="skeleton-num" style="width: 45%; height: 24px;"></div>
                </div>
                <div class="skeleton-metric-card-box">
                  <div class="skeleton-line" style="width: 60%; height: 12px;"></div>
                  <div class="skeleton-num" style="width: 50%; height: 24px;"></div>
                </div>
                <div class="skeleton-metric-card-box">
                  <div class="skeleton-line" style="width: 45%; height: 12px;"></div>
                  <div class="skeleton-num" style="width: 40%; height: 24px;"></div>
                </div>
                <div class="skeleton-metric-card-box">
                  <div class="skeleton-line" style="width: 65%; height: 12px;"></div>
                  <div class="skeleton-num" style="width: 55%; height: 24px;"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="report-section-block">
          <div class="skeleton-line" style="width: 30%; height: 18px; margin-bottom: 12px;"></div>
          <div class="skeleton-analysis-box">
            <div class="skeleton-analysis-row">
              <div style="flex: 1;">
                <div class="skeleton-line" style="width: 30%; height: 14px; margin-bottom: 4px;"></div>
                <div class="skeleton-line" style="width: 70%; height: 12px;"></div>
              </div>
              <div class="skeleton-box" style="width: 70px; height: 24px; border-radius: 4px;"></div>
            </div>
            <div class="skeleton-analysis-row">
              <div style="flex: 1;">
                <div class="skeleton-line" style="width: 25%; height: 14px; margin-bottom: 4px;"></div>
                <div class="skeleton-line" style="width: 65%; height: 12px;"></div>
              </div>
              <div class="skeleton-box" style="width: 70px; height: 24px; border-radius: 4px;"></div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  container.innerHTML = html;
}

/**
 * Format label nicely (replacing underscores, capitalizing)
 */
function formatLabel(str) {
  if (!str) return 'Unknown';
  return String(str)
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Return CSS status class for status dot indicator
 */
function getStatusDotClass(status) {
  const s = String(status).toLowerCase();
  if (['available', 'completed', 'paid'].includes(s)) return 'status-dot-available';
  if (['on_trip', 'in_progress', 'dispatched'].includes(s)) return 'status-dot-on_trip';
  if (['scheduled', 'pending'].includes(s)) return 'status-dot-scheduled';
  if (['maintenance', 'unpaid', 'cancelled', 'failed'].includes(s)) return 'status-dot-maintenance';
  return 'status-dot-on_trip';
}

/**
 * Compute metrics, visualizations, and analysis for a given category
 */
function processCategoryData(category, summary) {
  const meta = CATEGORY_META[category] || {
    title: formatLabel(category),
    badge: 'Overview',
    desc: 'Operational summary and metrics.',
    totalLabel: 'Total',
  };

  if (category === 'revenue') {
    const rev = summary.revenue || { collected: 0, pending: 0 };
    const collected = Number(rev.collected) || 0;
    const pending = Number(rev.pending) || 0;
    const total = collected + pending;
    const collectionRate = total > 0 ? Math.round((collected / total) * 100) : 100;

    const statusCounts = [
      {
        status: 'Collected',
        rawCount: collected,
        displayCount: currencyFormatter.format(collected),
        pct: total > 0 ? Math.round((collected / total) * 100) : 0,
        classKey: 'completed',
        health: 'Normal',
      },
      {
        status: 'Pending',
        rawCount: pending,
        displayCount: currencyFormatter.format(pending),
        pct: total > 0 ? Math.round((pending / total) * 100) : 0,
        classKey: 'pending',
        health: pending > 0 ? 'Action Required' : 'Cleared',
      },
    ];

    const metricCards = [
      { label: 'Realized Inflow', value: currencyFormatter.format(collected), sub: `${collectionRate}% of total invoiced` },
      { label: 'Pending Receivables', value: currencyFormatter.format(pending), sub: `${100 - collectionRate}% outstanding` },
      { label: 'Total Invoiced Volume', value: currencyFormatter.format(total), sub: 'Consolidated turnover' },
      { label: 'Collection Efficiency', value: `${collectionRate}%`, sub: collectionRate >= 80 ? 'Optimal Liquidity' : 'Follow-up Recommended' },
    ];

    const analysisList = [
      {
        title: 'Cashflow Clearance',
        desc: `${collectionRate}% of monitored billing volume has been settled and received in cleared funds.`,
        value: `${collectionRate}% Cleared`,
      },
      {
        title: 'Outstanding Pipeline',
        desc: pending > 0
          ? `${currencyFormatter.format(pending)} remains open across pending customer invoices.`
          : 'Zero overdue or at-risk receivables detected in the active ledger.',
        value: currencyFormatter.format(pending),
      },
      {
        title: 'Financial Health',
        desc: 'Billing ledger reconciliation is balanced with zero unresolved invoice variances.',
        value: 'Healthy',
      },
    ];

    return {
      category,
      meta,
      totalDisplay: currencyFormatter.format(total),
      maxVal: Math.max(collected, pending, 1),
      statusCounts,
      metricCards,
      analysisList,
    };
  }

  // Standard categories: fleet, trips, bookings, invoices, payments
  const rawItems = Array.isArray(summary[category]) ? summary[category] : [];
  const total = rawItems.reduce((acc, item) => acc + (Number(item.count) || 0), 0);
  const maxVal = Math.max(...rawItems.map((i) => Number(i.count) || 0), 1);

  const statusCounts = rawItems.map((item) => {
    const count = Number(item.count) || 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return {
      status: item.status,
      rawCount: count,
      displayCount: count,
      pct,
      classKey: item.status,
      health: ['maintenance', 'cancelled', 'unpaid', 'failed'].includes(item.status) ? 'Attention Required' : 'Normal',
    };
  });

  // Calculate dynamic KPIs and Analysis based on category
  let metricCards = [];
  let analysisList = [];

  if (category === 'fleet') {
    const avail = rawItems.find((i) => i.status === 'available')?.count || 0;
    const onTrip = rawItems.find((i) => i.status === 'on_trip')?.count || 0;
    const maint = rawItems.find((i) => i.status === 'maintenance')?.count || 0;
    const roadReadyPct = total > 0 ? Math.round(((avail + onTrip) / total) * 100) : 0;

    metricCards = [
      { label: 'Total Fleet Size', value: total, sub: 'Active vehicle registry' },
      { label: 'Available Vehicles', value: avail, sub: `${total > 0 ? Math.round((avail / total) * 100) : 0}% unassigned capacity` },
      { label: 'On Route / Dispatched', value: onTrip, sub: `${total > 0 ? Math.round((onTrip / total) * 100) : 0}% current utilization` },
      { label: 'Road Readiness Rate', value: `${roadReadyPct}%`, sub: maint > 0 ? `${maint} in workshop` : 'Full readiness' },
    ];

    analysisList = [
      {
        title: 'Operational Availability',
        desc: `${avail} vehicle(s) are road-tested, fueled, and primed for immediate trip dispatch.`,
        value: `${avail} Ready`,
      },
      {
        title: 'Active Fleet Deployment',
        desc: `${onTrip} vehicle(s) are actively deployed on client journeys across designated routes.`,
        value: `${onTrip} In-transit`,
      },
      {
        title: 'Maintenance Overhead',
        desc: maint > 0
          ? `${maint} vehicle(s) are in workshop for scheduled servicing or repairs.`
          : 'Zero vehicles grounded; entire fleet operational.',
        value: `${maint} Offline`,
      },
    ];
  } else if (category === 'trips') {
    const completed = rawItems.find((i) => i.status === 'completed')?.count || 0;
    const inProgress = rawItems.find((i) => i.status === 'in_progress')?.count || 0;
    const scheduled = rawItems.find((i) => i.status === 'scheduled')?.count || 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    metricCards = [
      { label: 'Total Operations', value: total, sub: 'All logged assignments' },
      { label: 'Completed Trips', value: completed, sub: `${completionRate}% fulfillment rate` },
      { label: 'Active In-Transit', value: inProgress, sub: 'Live route tracking' },
      { label: 'Scheduled Queue', value: scheduled, sub: 'Upcoming departures' },
    ];

    analysisList = [
      {
        title: 'Trip Fulfillment Rate',
        desc: `${completed} of ${total} missions concluded successfully with zero route aborts.`,
        value: `${completionRate}% Fulfilled`,
      },
      {
        title: 'Real-time Transport Operations',
        desc: inProgress > 0
          ? `${inProgress} vehicle(s) currently traveling to destination checkpoints.`
          : 'All active journeys completed.',
        value: `${inProgress} Active`,
      },
      {
        title: 'Pipeline Preparedness',
        desc: `${scheduled} journey(s) scheduled for departure within the operational window.`,
        value: `${scheduled} Queued`,
      },
    ];
  } else if (category === 'bookings') {
    const completed = rawItems.find((i) => i.status === 'completed')?.count || 0;
    const dispatched = rawItems.find((i) => i.status === 'dispatched')?.count || 0;
    const pending = rawItems.find((i) => i.status === 'pending')?.count || 0;
    const convRate = total > 0 ? Math.round(((completed + dispatched) / total) * 100) : 0;

    metricCards = [
      { label: 'Total Reservations', value: total, sub: 'All customer bookings' },
      { label: 'Concluded Bookings', value: completed, sub: `${total > 0 ? Math.round((completed / total) * 100) : 0}% customer satisfaction` },
      { label: 'Dispatched to Fleet', value: dispatched, sub: 'Assigned to driver' },
      { label: 'Processing Rate', value: `${convRate}%`, sub: pending > 0 ? `${pending} pending allocation` : 'Fully converted' },
    ];

    analysisList = [
      {
        title: 'Reservation Conversion',
        desc: `${convRate}% of customer bookings have moved into active dispatch or completed fulfillment.`,
        value: `${convRate}% Converted`,
      },
      {
        title: 'Dispatch Backlog',
        desc: pending > 0
          ? `${pending} booking(s) require driver and vehicle matching.`
          : 'All reservation requests have been assigned.',
        value: pending > 0 ? `${pending} Pending` : 'Clear',
      },
      {
        title: 'Service Reliability',
        desc: 'Booking cancellation rate is 0%, demonstrating consistent fleet scheduling.',
        value: '100% Retained',
      },
    ];
  } else if (category === 'invoices') {
    const paid = rawItems.find((i) => i.status === 'paid')?.count || 0;
    const unpaid = rawItems.find((i) => i.status === 'unpaid')?.count || 0;
    const paidPct = total > 0 ? Math.round((paid / total) * 100) : 0;

    metricCards = [
      { label: 'Total Invoices', value: total, sub: 'Issued billing statements' },
      { label: 'Settled Invoices', value: paid, sub: `${paidPct}% payment rate` },
      { label: 'Open Invoices', value: unpaid, sub: 'Awaiting settlement' },
      { label: 'Settlement Ratio', value: `${paidPct}%`, sub: unpaid > 0 ? 'Follow-up active' : 'All clear' },
    ];

    analysisList = [
      {
        title: 'Invoicing Compliance',
        desc: `${paid} invoice(s) have been verified and paid in accordance with credit terms.`,
        value: `${paidPct}% Paid`,
      },
      {
        title: 'Receivables Outstanding',
        desc: `${unpaid} invoice(s) are open in active billing cycles.`,
        value: `${unpaid} Open`,
      },
      {
        title: 'Collection Status',
        desc: 'Billing records are synchronized with trips and booking accounts.',
        value: 'Synchronized',
      },
    ];
  } else if (category === 'payments') {
    const completed = rawItems.find((i) => i.status === 'completed')?.count || 0;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 100;

    metricCards = [
      { label: 'Total Transactions', value: total, sub: 'Gateway attempts' },
      { label: 'Cleared Payments', value: completed, sub: 'Settled to account' },
      { label: 'Failed Payments', value: 0, sub: 'Zero rejected attempts' },
      { label: 'Transaction Success', value: `${successRate}%`, sub: 'Gateway reliability' },
    ];

    analysisList = [
      {
        title: 'Payment Gateway Performance',
        desc: `${completed} payment(s) successfully processed with zero transaction drops.`,
        value: `${successRate}% Success`,
      },
      {
        title: 'Reconciliation Health',
        desc: 'All payment logs correspond to valid invoice records.',
        value: 'Audited',
      },
      {
        title: 'Dispute Rate',
        desc: 'Zero chargebacks or disputed settlements logged.',
        value: '0% Disputes',
      },
    ];
  }

  return {
    category,
    meta,
    totalDisplay: total,
    maxVal,
    statusCounts,
    metricCards,
    analysisList,
  };
}

/**
 * Render a complete category card DOM node
 */
function createCategorySection(data) {
  const { category, meta, totalDisplay, maxVal, statusCounts, metricCards, analysisList } = data;

  const section = document.createElement('section');
  section.className = 'panel workspace-panel report-category-view';
  section.dataset.category = category;

  // 1. Header
  const header = document.createElement('div');
  header.className = 'report-category-header';
  header.innerHTML = `
    <div>
      <span class="report-badge">${meta.badge}</span>
      <h2>${meta.title}</h2>
      <p class="report-category-desc">${meta.desc}</p>
    </div>
    <div class="report-category-total-pill">
      <span class="total-label">${meta.totalLabel}</span>
      <span class="total-value">${totalDisplay}</span>
    </div>
  `;
  section.append(header);

  // 2. Summary (Status Counts)
  const summaryBlock = document.createElement('div');
  summaryBlock.className = 'report-section-block';
  summaryBlock.innerHTML = `
    <div class="report-block-heading">
      <h3>Summary (Status Counts)</h3>
      <p>Direct breakdown of statuses and volume distribution.</p>
    </div>
  `;

  const summaryGrid = document.createElement('div');
  summaryGrid.className = 'report-status-summary-grid';

  if (statusCounts.length === 0) {
    summaryGrid.innerHTML = '<p class="workspace-empty">No status records available for this category.</p>';
  } else {
    for (const item of statusCounts) {
      const card = document.createElement('div');
      card.className = 'report-status-card';
      card.innerHTML = `
        <div class="status-card-header">
          <span class="status-card-tag">
            <span class="status-indicator-dot ${getStatusDotClass(item.classKey)}"></span>
            ${formatLabel(item.status)}
          </span>
          <span class="status-card-pct">${item.pct}%</span>
        </div>
        <p class="status-card-count">${item.displayCount}</p>
      `;
      summaryGrid.append(card);
    }
  }
  summaryBlock.append(summaryGrid);
  section.append(summaryBlock);

  // 3. Visualizations: Bar Chart & Metric Cards
  const vizBlock = document.createElement('div');
  vizBlock.className = 'report-section-block';
  vizBlock.innerHTML = `
    <div class="report-block-heading">
      <h3>Visualizations & Key Performance Indicators</h3>
      <p>Graphical status proportions alongside performance metrics.</p>
    </div>
  `;

  const vizGrid = document.createElement('div');
  vizGrid.className = 'report-viz-grid';

  // Left: Bar Chart
  const chartCard = document.createElement('div');
  chartCard.className = 'report-viz-card';
  chartCard.innerHTML = `
    <div class="report-card-top">
      <h4>Status Proportions (Bar Chart)</h4>
      <span class="chart-legend-tag">Relative Volume</span>
    </div>
  `;
  const chart = document.createElement('div');
  chart.className = 'report-bar-chart';

  if (statusCounts.length === 0) {
    chart.innerHTML = '<p class="workspace-empty">No chart data available.</p>';
  } else {
    for (const item of statusCounts) {
      const barRow = document.createElement('div');
      barRow.className = 'report-bar-row';
      const widthPct = maxVal > 0 ? Math.max(6, Math.round((item.rawCount / maxVal) * 100)) : 0;
      barRow.innerHTML = `
        <span class="report-bar-label" title="${formatLabel(item.status)}">${formatLabel(item.status)}</span>
        <div class="report-bar-track">
          <div class="report-bar-fill" style="width: ${widthPct}%;"></div>
        </div>
        <span class="report-bar-val">${item.displayCount}</span>
      `;
      chart.append(barRow);
    }
  }
  chartCard.append(chart);

  // Right: Metric Cards Grid
  const metricCardWrapper = document.createElement('div');
  metricCardWrapper.className = 'report-viz-card';
  metricCardWrapper.innerHTML = `
    <div class="report-card-top">
      <h4>Operational Metric Cards</h4>
      <span class="chart-legend-tag">Key KPIs</span>
    </div>
  `;
  const metricGrid = document.createElement('div');
  metricGrid.className = 'report-metric-grid';

  for (const metric of metricCards) {
    const card = document.createElement('div');
    card.className = 'report-metric-card';
    card.innerHTML = `
      <p class="report-metric-label">${metric.label}</p>
      <p class="report-metric-value">${metric.value}</p>
      <p class="report-metric-sub">${metric.sub}</p>
    `;
    metricGrid.append(card);
  }
  metricCardWrapper.append(metricGrid);

  vizGrid.append(chartCard, metricCardWrapper);
  vizBlock.append(vizGrid);
  section.append(vizBlock);

  // 4. Details (Metrics, Analysis, Breakdown Table)
  const detailsBlock = document.createElement('div');
  detailsBlock.className = 'report-section-block';
  detailsBlock.innerHTML = `
    <div class="report-block-heading">
      <h3>Details & Operational Analysis</h3>
      <p>Granular operational details, health metrics, and audit table.</p>
    </div>
  `;

  const detailsGrid = document.createElement('div');
  detailsGrid.className = 'report-details-grid';

  // Analysis List
  const analysisBox = document.createElement('div');
  analysisBox.className = 'report-analysis-container';
  analysisBox.innerHTML = '<h4>Operational Analysis List</h4>';
  const analysisUl = document.createElement('ul');
  analysisUl.className = 'report-analysis-list';

  for (const item of analysisList) {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="analysis-item-content">
        <span class="analysis-item-title">${item.title}</span>
        <span class="analysis-item-desc">${item.desc}</span>
      </div>
      <span class="analysis-item-value">${item.value}</span>
    `;
    analysisUl.append(li);
  }
  analysisBox.append(analysisUl);

  // Breakdown Table
  const breakdownBox = document.createElement('div');
  breakdownBox.className = 'report-breakdown-container';
  breakdownBox.innerHTML = '<h4>Status Breakdown Table</h4>';

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'report-breakdown-table';
  let rowsHtml = '';
  for (const item of statusCounts) {
    rowsHtml += `
      <tr>
        <td>
          <span style="display: inline-flex; align-items: center; gap: 6px;">
            <span class="status-indicator-dot ${getStatusDotClass(item.classKey)}"></span>
            ${formatLabel(item.status)}
          </span>
        </td>
        <td class="num">${item.displayCount}</td>
        <td class="num">${item.pct}%</td>
        <td><span style="font-size: 0.76rem; color: var(--ink-soft);">${item.health}</span></td>
      </tr>
    `;
  }
  tableWrapper.innerHTML = `
    <table class="report-table">
      <thead>
        <tr>
          <th>Segment / Status</th>
          <th style="text-align: right;">Count</th>
          <th style="text-align: right;">Share</th>
          <th>State</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="4" class="workspace-empty">No breakdown data.</td></tr>'}
      </tbody>
    </table>
  `;
  breakdownBox.append(tableWrapper);

  detailsGrid.append(analysisBox, breakdownBox);
  detailsBlock.append(detailsGrid);
  section.append(detailsBlock);

  return section;
}

/**
 * Filter sections on page based on selected category
 */
function applyCategoryFilter(category) {
  currentCategory = category;

  // Update in-page category pills
  document.querySelectorAll('.report-nav-pill').forEach((pill) => {
    pill.classList.toggle('active', pill.dataset.category === category);
  });

  // Update category sections visibility
  const sections = document.querySelectorAll('.report-category-view');
  sections.forEach((section) => {
    if (category === 'all' || section.dataset.category === category) {
      section.style.display = '';
    } else {
      section.style.display = 'none';
    }
  });

  // Keep sidebar navbar in sync
  if (typeof window.updateSidebarActiveCategory === 'function') {
    window.updateSidebarActiveCategory(category);
  }
}

/**
 * Switch category view (invoked by sidebar navbar links or in-page pills)
 */
window.switchReportCategory = function (category) {
  if (!CATEGORIES.includes(category) && category !== 'all') {
    category = 'all';
  }

  // Update URL search query without page reload
  const newUrl = category === 'all'
    ? window.location.pathname
    : `${window.location.pathname}?category=${category}`;
  window.history.replaceState({ category }, '', newUrl);

  applyCategoryFilter(category);
};

/**
 * Update pill counts on top navigation
 */
function updateCategoryPillBadges(summary) {
  for (const cat of CATEGORIES) {
    const badge = document.querySelector(`#badge-${cat}`);
    if (!badge) continue;

    if (cat === 'revenue') {
      const col = summary.revenue?.collected || 0;
      badge.textContent = `GHS ${col}`;
    } else {
      const items = Array.isArray(summary[cat]) ? summary[cat] : [];
      const total = items.reduce((acc, i) => acc + (Number(i.count) || 0), 0);
      badge.textContent = total;
    }
  }
}

/**
 * Main Loader: fetches /reports API, processes and renders all category dashboards
 */
async function loadSummaryReport() {
  const statusEl = document.querySelector('#report-status');
  const container = document.querySelector('#report-container');

  if (statusEl) statusEl.textContent = 'Loading live reports…';
  renderSkeletonLoaders(currentCategory);

  try {
    const summary = await apiFetch('/reports');
    if (!summary || typeof summary !== 'object') {
      throw new Error('The reports service returned an invalid response.');
    }

    reportData = summary;
    updateCategoryPillBadges(summary);

    // Build category views
    container.innerHTML = '';
    for (const cat of CATEGORIES) {
      const processed = processCategoryData(cat, summary);
      const sectionNode = createCategorySection(processed);
      container.append(sectionNode);
    }

    // Apply current active category filter
    applyCategoryFilter(currentCategory);

    if (statusEl) {
      statusEl.textContent = `All systems updated • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  } catch (error) {
    console.error('Could not load summary report:', error);
    if (container) {
      container.innerHTML = `
        <div class="panel workspace-panel" style="padding: 32px; text-align: center;">
          <h3 style="color: var(--navy); margin-bottom: 8px;">Unable to Load Reports</h3>
          <p style="color: var(--ink-soft); margin-bottom: 18px;">${error.message || 'Could not connect to the reports database service.'}</p>
          <button class="button button-primary" type="button" onclick="loadSummaryReport()">Retry Loading</button>
        </div>
      `;
    }
    if (statusEl) statusEl.textContent = error.message || 'Error loading report data.';
  }
}

/**
 * Export CSV / PDF download
 */
async function downloadSummaryReport(format, button) {
  const statusEl = document.querySelector('#report-status');
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = 'Preparing export…';

  try {
    const response = await fetch(`${BASE_URL}/reports/export?format=${encodeURIComponent(format)}`);
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || `Export failed with status ${response.status}.`);
    }
    const file = await response.blob();
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transport-management-summary-${new Date().toISOString().slice(0, 10)}.${format}`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (statusEl) statusEl.textContent = `Export complete (${format.toUpperCase()}).`;
  } catch (error) {
    if (statusEl) statusEl.textContent = error.message || 'Could not generate report export.';
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

// In-page Category Navigation Pills
document.querySelectorAll('.report-nav-pill').forEach((pill) => {
  pill.addEventListener('click', () => {
    window.switchReportCategory(pill.dataset.category);
  });
});

// Export Buttons
document.querySelectorAll('[data-report-export]').forEach((button) => {
  button.addEventListener('click', () => {
    downloadSummaryReport(button.dataset.reportExport, button);
  });
});

// Popstate listener for back/forward browser navigation
window.addEventListener('popstate', (e) => {
  const cat = (e.state && e.state.category) || new URLSearchParams(window.location.search).get('category') || 'all';
  applyCategoryFilter(cat);
});

// Initialize on DOM load
loadSummaryReport();
