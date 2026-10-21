const express = require('express');
const db = require('../db');
const handleDbError = require('../utils/dbError');
const { sendCsv, sendPdf } = require('../utils/reportFiles');

const router = express.Router();

async function loadSummary() {
  const { rows } = await db.query('SELECT monitoring.api_summary() AS summary');
  return rows[0].summary;
}

function summaryRows(summary) {
  const rows = [];
  for (const section of ['fleet', 'trips', 'bookings', 'invoices', 'payments', 'drivers']) {
    for (const item of summary[section] ?? []) {
      rows.push({ section, item: item.status ?? item.item ?? 'unknown', value: item.count ?? item.value ?? 0 });
    }
  }
  if (summary.revenue) {
    rows.push({ section: 'revenue', item: 'Collected', value: summary.revenue.collected ?? 0 });
    rows.push({ section: 'revenue', item: 'Pending', value: summary.revenue.pending ?? 0 });
  }
  if (summary.fuel) {
    rows.push({ section: 'fuel', item: 'Total Litres', value: summary.fuel.total_litres ?? 0 });
    rows.push({ section: 'fuel', item: 'Total Cost', value: summary.fuel.total_cost ?? 0 });
  }
  return rows;
}

router.get('/', async (req, res) => {
  try {
    return res.json(await loadSummary());
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.get('/export', async (req, res) => {
  const format = String(req.query.format || '').toLowerCase();
  if (!['csv', 'pdf'].includes(format)) {
    return res.status(400).json({ message: 'Choose csv or pdf as the export format.' });
  }

  try {
    const summary = await loadSummary();
    const rows = summaryRows(summary);
    const columns = [
      { key: 'section', label: 'Section' },
      { key: 'item', label: 'Status / metric' },
      { key: 'value', label: 'Value' },
    ];
    const filename = `transport-management-summary-${new Date().toISOString().slice(0, 10)}.${format}`;
    if (format === 'csv') return sendCsv(res, filename, columns, rows);
    return sendPdf(res, {
      filename,
      title: 'Transport Management System - Summary',
      subtitle: `All-time summary generated ${new Date().toLocaleString()}`,
      columns,
      rows,
    });
  } catch (error) {
    return handleDbError(error, res);
  }
});

module.exports = router;
