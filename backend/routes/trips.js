const express = require('express');
const db = require('../db');
const apiTable = require('../utils/apiTable');
const handleDbError = require('../utils/dbError');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM operations.api_trips()');
    return res.json(rows.map((row) => row.api_trips));
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM operations.api_trips($1::uuid)',
      [req.params.id]
    );
    const trip = rows[0]?.api_trips;
    if (!trip) return res.status(404).json({ message: 'Trip not found.' });
    return res.json(trip);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.post('/', async (req, res) => {
  try {
    return res.status(201).json(
      await apiTable('operations.trips', 'create', null, req.body ?? {})
    );
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.put('/:id/status', updateStatus);
router.patch('/:id/status', updateStatus);

async function updateStatus(req, res) {
  try {
    const trip = await apiTable('operations.trips', 'update', req.params.id, {
      status: req.body?.status,
    });
    if (!trip) return res.status(404).json({ message: 'Trip not found.' });
    return res.json(trip);
  } catch (error) {
    return handleDbError(error, res);
  }
}

module.exports = router;
