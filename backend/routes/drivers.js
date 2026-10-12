const express = require('express');
const db = require('../db');
const handleDbError = require('../utils/dbError');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const admin = [authenticate, requireRole('admin')];

router.get('/', ...admin, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM fleet.driver_details ORDER BY last_name, first_name'
    );
    return res.json(rows);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.post('/', ...admin, async (req, res) => {
  const body = req.body || {};
  if (typeof body.password !== 'string' || body.password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  }
  try {
    const driver = await db.transaction(req.user.id, async (client) => {
      const userResult = await client.query(
        `SELECT accounts.register_user($1, $2, $3, $4, $5, $6, $7, $8, 'driver') AS user_id`,
        [
          body.username,
          body.email,
          body.password,
          body.first_name,
          body.last_name,
          body.middle_name ?? null,
          body.phone ?? null,
          body.address ?? null,
        ]
      );
      const userId = userResult.rows[0].user_id;
      const driverResult = await client.query(
        'SELECT fleet.register_driver($1, $2, $3) AS driver_id',
        [userId, body.license_number, body.license_expiry]
      );
      const result = await client.query(
        'SELECT * FROM fleet.driver_details WHERE id = $1',
        [driverResult.rows[0].driver_id]
      );
      return result.rows[0];
    });
    return res.status(201).json(driver);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.put('/:id/verify', ...admin, async (req, res) => {
  try {
    const { rows } = await db.transaction(req.user.id, (client) =>
      client.query(
        `UPDATE fleet.drivers SET license_verified = TRUE
         WHERE id = $1
         RETURNING *`,
        [req.params.id]
      )
    );
    if (!rows[0]) return res.status(404).json({ message: 'Driver not found.' });
    return res.json(rows[0]);
  } catch (error) {
    return handleDbError(error, res);
  }
});

module.exports = router;