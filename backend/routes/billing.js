const express = require('express');
const db = require('../db');
const handleDbError = require('../utils/dbError');
const { sendCsv, sendPdf } = require('../utils/reportFiles');

const router = express.Router();
const statuses = {
  invoices: new Set(['unpaid', 'paid', 'overdue']),
  payments: new Set(['pending', 'completed', 'failed']),
};
const exportsConfig = {
  invoices: {
    functionName: 'billing.list_invoice_page',
    maxRows: { csv: 10000, pdf: 500 },
    columns: [
      ['Invoice number', 'invoice_number'],
      ['Amount', 'amount'],
      ['Issued date', 'issued_date'],
      ['Due date', 'due_date'],
      ['Status', 'status'],
    ],
  },
  payments: {
    functionName: 'billing.list_payment_page',
    maxRows: { csv: 10000, pdf: 500 },
    columns: [
      ['Invoice', 'invoice_number'],
      ['Amount', 'amount'],
      ['Method', 'method'],
      ['Status', 'status'],
      ['Date', 'created_at'],
    ],
  },
};

function parseFilters(resource, req, res, isExport = false) {
  const maxPageSize = isExport ? 10000 : 100;
  const pageSize = Number(req.query.pageSize ?? (isExport ? 10000 : 25));
  const page = Number(req.query.page ?? 1);
  const status = req.query.status ? String(req.query.status) : null;
  const from = req.query.from ? String(req.query.from) : null;
  const to = req.query.to ? String(req.query.to) : null;
  const search = req.query.search ? String(req.query.search).trim() : null;

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > maxPageSize) {
    res.status(400).json({ message: `pageSize must be between 1 and ${maxPageSize}.` });
    return null;
  }
  if (!Number.isInteger(page) || page < 1 || (page - 1) * pageSize > 2147483647) {
    res.status(400).json({ message: 'page must be a positive integer.' });
    return null;
  }
  if (status && !statuses[resource].has(status)) {
    res.status(400).json({ message: 'Choose a valid status filter.' });
    return null;
  }
  for (const [label, date] of [['from', from], ['to', to]]) {
    if (date && !isValidDate(date)) {
      res.status(400).json({ message: `${label} must be a date in YYYY-MM-DD format.` });
      return null;
    }
  }
  if (search && search.length > 100) {
    res.status(400).json({ message: 'Search must be 100 characters or fewer.' });
    return null;
  }
  if (from && to && from > to) {
    res.status(400).json({ message: 'The start date must be on or before the end date.' });
    return null;
  }

  return {
    pageSize,
    page,
    status,
    from,
    to,
    search,
    offset: (page - 1) * pageSize,
  };
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

async function queryPage(resource, filters) {
  const { functionName } = exportsConfig[resource];
  const { rows } = await db.query(
    `SELECT * FROM ${functionName}($1, $2, $3, $4::date, $5::date, $6)`,
    [
      filters.pageSize,
      filters.offset,
      filters.status,
      filters.from,
      filters.to,
      filters.search,
    ]
  );
  return {
    items: rows[0]?.items ?? [],
    total: Number(rows[0]?.total_count ?? 0),
  };
}

function formatDate(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString();
}

for (const resource of Object.keys(exportsConfig)) {
  router.get(`/${resource}`, async (req, res) => {
    const filters = parseFilters(resource, req, res);
    if (!filters) return;

    try {
      const result = await queryPage(resource, filters);
      return res.json({
        ...result,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: Math.ceil(result.total / filters.pageSize),
      });
    } catch (error) {
      return handleDbError(error, res);
    }
  });

  router.get(`/${resource}/export`, async (req, res) => {
    const format = String(req.query.format || '').toLowerCase();
    const config = exportsConfig[resource];
    if (!['csv', 'pdf'].includes(format)) {
      return res.status(400).json({ message: 'Choose csv or pdf as the export format.' });
    }
    const filters = parseFilters(resource, req, res, true);
    if (!filters) return;
    filters.pageSize = config.maxRows[format];
    filters.offset = 0;

    try {
      const result = await queryPage(resource, filters);
      if (result.total > config.maxRows[format]) {
        return res.status(413).json({
          message: `This ${format.toUpperCase()} export is limited to ${config.maxRows[format]} records. Narrow the filters and try again.`,
        });
      }
      const columns = config.columns.map(([label, key]) => ({ label, key }));
      const rows = result.items.map((item) => Object.fromEntries(
        columns.map(({ key }) => [
          key,
          key.includes('date') || key === 'created_at' || key === 'issued_date'
            ? formatDate(item[key])
            : item[key],
        ])
      ));
      const filename = `${resource}-${new Date().toISOString().slice(0, 10)}.${format}`;
      if (format === 'csv') return sendCsv(res, filename, columns, rows);
      return sendPdf(res, {
        filename,
        title: `Transport Management System - ${resource}`,
        subtitle: `Generated ${new Date().toLocaleString()} | ${rows.length} records`,
        columns,
        rows,
      });
    } catch (error) {
      return handleDbError(error, res);
    }
  });
}

module.exports = router;
