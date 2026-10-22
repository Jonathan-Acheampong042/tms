const express = require('express');
const db = require('../db');
const apiTable = require('../utils/apiTable');
const handleDbError = require('../utils/dbError');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    return res.json(await apiTable('billing.invoices', 'list'));
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const invoice = await apiTable('billing.invoices', 'get', req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });
    return res.json(invoice);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.post('/', async (req, res) => {
  try {
    let bookingId = req.body?.booking_id;

    // If no booking_id is provided, attach to an unbilled booking or create an on-demand booking record
    if (!bookingId) {
      const unbilled = await db.query(`
        SELECT b.id FROM operations.bookings b
        LEFT JOIN billing.invoices i ON b.id = i.booking_id
        WHERE i.id IS NULL
        ORDER BY b.created_at DESC
        LIMIT 1
      `);

      if (unbilled.rows.length > 0) {
        bookingId = unbilled.rows[0].id;
      } else {
        const userRes = await db.query(
          "SELECT id FROM accounts.users WHERE role IN ('customer', 'admin') ORDER BY role DESC LIMIT 1"
        );
        const userId = userRes.rows[0]?.id;
        if (!userId) {
          return res.status(400).json({ message: 'No customer or admin account found for billing.' });
        }

        const createdBooking = await db.query(`
          INSERT INTO operations.bookings (user_id, booking_type, pickup, dropoff, status)
          VALUES ($1, 'cargo', 'Terminal Depot', 'Customer Delivery', 'completed')
          RETURNING id
        `, [userId]);
        bookingId = createdBooking.rows[0]?.id;
      }
    }

    if (!bookingId) {
      return res.status(400).json({ message: 'Missing required field: booking_id' });
    }

    // Auto-generate invoice number if not provided
    let invoiceNumber = typeof req.body?.invoice_number === 'string' ? req.body.invoice_number.trim() : '';
    if (!invoiceNumber) {
      const year = new Date().getFullYear();
      const rand = Math.floor(1000 + Math.random() * 9000);
      invoiceNumber = `INV-${year}-${rand}`;
    }

    const payload = {
      booking_id: bookingId,
      invoice_number: invoiceNumber,
      amount: Number(req.body.amount),
      due_date: req.body.due_date,
      status: req.body.status || 'unpaid',
    };

    const newInvoice = await apiTable('billing.invoices', 'create', null, payload);
    return res.status(201).json(newInvoice);
  } catch (error) {
    return handleDbError(error, res);
  }
});

module.exports = router;
