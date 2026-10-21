const express = require('express');
const db = require('../db');
const apiTable = require('../utils/apiTable');
const handleDbError = require('../utils/dbError');

const router = express.Router();
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM fleet.api_fuel_records()');
    return res.json(rows.map((row) => row.api_fuel_records));
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM fleet.api_fuel_records($1::uuid)',
      [req.params.id]
    );
    const record = rows[0]?.api_fuel_records;
    if (!record) return res.status(404).json({ message: 'Fuel record not found.' });
    return res.json(record);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.post('/', async (req, res) => {
  try {
    return res.status(201).json(
      await apiTable('fleet.fuel_records', 'create', null, req.body ?? {})
    );
  } catch (error) {
    return handleDbError(error, res);
  }
});

module.exports = router;
