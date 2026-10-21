const express = require('express');
const db = require('../db');
const handleDbError = require('../utils/dbError');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM fleet.driver_details ORDER BY last_name, first_name'
    );
    return res.json(rows);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM fleet.driver_details WHERE id = $1',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Driver not found.' });
    return res.json(rows[0]);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.post('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM fleet.create_driver($1::jsonb)',
      [JSON.stringify(req.body ?? {})]
    );
    const driver = rows[0];
    return res.status(201).json(driver);
  } catch (error) {
    return handleDbError(error, res);
  }
});

module.exports = router;
