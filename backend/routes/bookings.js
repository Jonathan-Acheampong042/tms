const express = require('express');
const apiTable = require('../utils/apiTable');
const handleDbError = require('../utils/dbError');

const router = express.Router();
router.get('/', async (req, res) => {
  try {
    return res.json(await apiTable('operations.bookings', 'list'));
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const booking = await apiTable('operations.bookings', 'get', req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    return res.json(booking);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.post('/', async (req, res) => {
  try {
    return res.status(201).json(
      await apiTable('operations.bookings', 'create', null, req.body ?? {})
    );
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.put('/:id', update);
router.patch('/:id', update);

async function update(req, res) {
  try {
    const booking = await apiTable('operations.bookings', 'update', req.params.id, req.body ?? {});
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    return res.json(booking);
  } catch (error) {
    return handleDbError(error, res);
  }
}

module.exports = router;
