
const express = require('express');
const crud = require('../utils/crud');
const db = require('../db');
const handleDbError = require('../utils/dbError');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin', 'customer'));

router.get('/', async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? 'SELECT * FROM operations.bookings ORDER BY created_at DESC'
      : 'SELECT * FROM operations.bookings WHERE user_id = $1 ORDER BY created_at DESC';
    const { rows } = await db.query(
      query,
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
    if (req.user.role === 'customer') {
      body.user_id = req.user.id;
      body.status = 'pending';
      delete body.trip_id; // only an admin allocates a booking to a trip
    }
    const booking = await db.transaction(req.user.id, (client) =>
      crud.insert('operations', 'bookings', body, client)
    );
    return res.status(201).json(booking);
  } catch (error) {
    return handleDbError(error, res);
  }
});

const updateBooking = async (req, res) => {
  try {
    const booking = await db.transaction(req.user.id, (client) =>
      crud.update('operations', 'bookings', req.params.id, req.body, client)
    );
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    return res.json(booking);
  } catch (error) {
    return handleDbError(error, res);
  }
};

router.put('/:id', requireRole('admin'), updateBooking);
router.patch('/:id', requireRole('admin'), updateBooking);

module.exports = router;
