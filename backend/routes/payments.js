
const express = require('express');
const crud = require('../utils/crud');
const db = require('../db');
const handleDbError = require('../utils/dbError');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin', 'customer'));

router.get('/', async (req, res) => {
  try {
    const sql = req.user.role === 'admin'
      ? 'SELECT * FROM billing.payments ORDER BY created_at DESC'
      : `SELECT p.* FROM billing.payments p
         JOIN billing.invoices i ON i.id = p.invoice_id
         JOIN operations.bookings b ON b.id = i.booking_id
         WHERE b.user_id = $1 ORDER BY p.created_at DESC`;
    const { rows } = await db.query(
      sql,
      req.user.role === 'admin' ? [] : [req.user.id]
    );
    return res.json(rows);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.post('/', async (req, res) => {
  try {
    const body = { ...(req.body || {}) };
    const payment = await db.transaction(req.user.id, async (client) => {
      if (req.user.role === 'customer') {
        const ownership = await client.query(
          `SELECT i.id FROM billing.invoices i
           JOIN operations.bookings b ON b.id = i.booking_id
           WHERE i.id = $1 AND b.user_id = $2`,
          [body.invoice_id, req.user.id]
        );
        if (!ownership.rows[0]) {
          const error = new Error('Invoice not found.');
          error.code = 'P0002';
          throw error;
        }
        body.status = 'pending';
      }
      return crud.insert('billing', 'payments', body, client);
    });
    return res.status(201).json(payment);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const payment = await db.transaction(req.user.id, (client) =>
      crud.update('billing', 'payments', req.params.id, req.body, client)
    );
    if (!payment) return res.status(404).json({ message: 'Payment not found.' });
    return res.json(payment);
  } catch (error) {
    return handleDbError(error, res);
  }
});

module.exports = router;
