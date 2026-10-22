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

router.patch('/:id', updateDriver);
router.put('/:id', updateDriver);

async function updateDriver(req, res) {
  try {
    const fields = [];
    const values = [req.params.id];
    let idx = 2;

    if (req.body.status) {
      fields.push(`status = $${idx++}`);
      values.push(req.body.status);
    }
    if (req.body.license_number) {
      fields.push(`license_number = $${idx++}`);
      values.push(req.body.license_number.trim());
    }
    if (req.body.license_expiry) {
      fields.push(`license_expiry = $${idx++}::date`);
      values.push(req.body.license_expiry);
    }
    if (req.body.license_verified !== undefined) {
      fields.push(`license_verified = $${idx++}::boolean`);
      values.push(Boolean(req.body.license_verified));
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No editable fields were provided.' });
    }

    const { rows } = await db.query(
      `UPDATE fleet.drivers SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    if (!rows[0]) return res.status(404).json({ message: 'Driver not found.' });
    return res.json(rows[0]);
  } catch (error) {
    return handleDbError(error, res);
  }
}

module.exports = router;
