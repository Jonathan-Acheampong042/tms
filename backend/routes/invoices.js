
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
      ? 'SELECT * FROM billing.invoices ORDER BY issued_date DESC'
      : `SELECT i.* FROM billing.invoices i
         JOIN operations.bookings b ON b.id = i.booking_id
         WHERE b.user_id = $1 ORDER BY i.issued_date DESC`;
    const { rows } = await db.query(
      sql,
      req.user.role === 'admin' ? [] : [req.user.id]
    );
    return res.json(rows);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const invoice = await db.transaction(req.user.id, (client) =>
      crud.insert('billing', 'invoices', req.body, client)
    );
    return res.status(201).json(invoice);
  } catch (error) {
    return handleDbError(error, res);
  }
});

module.exports = router;
