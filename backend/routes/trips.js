
const express = require('express');
const crud = require('../utils/crud');
const db = require('../db');
const handleDbError = require('../utils/dbError');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin', 'driver'));

router.get('/', async (req, res) => {
  try {
    const sql = `SELECT t.*, r.name AS route_name, r.origin, r.destination,
      v.plate_number, d.user_id AS driver_user_id
      FROM operations.trips t
      JOIN operations.routes r ON r.id = t.route_id
      JOIN fleet.vehicles v ON v.id = t.vehicle_id
      JOIN fleet.drivers d ON d.id = t.driver_id
      ${req.user.role === 'driver' ? 'WHERE d.user_id = $1' : ''}
      ORDER BY t.scheduled_start DESC`;
    const { rows } = await db.query(
      sql,
      req.user.role === 'driver' ? [req.user.id] : []
    );
    return res.json(rows);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const trip = await db.transaction(req.user.id, (client) =>
      crud.insert('operations', 'trips', req.body, client)
    );
    return res.status(201).json(trip);
  } catch (error) {
    return handleDbError(error, res);
  }
});

// Drivers may only move their own trip forward: scheduled -> in_progress -> completed.
// Admins may set any valid status (for example cancelled).
const DRIVER_ALLOWED_FROM = {
  in_progress: ['scheduled'],
  completed: ['in_progress'],
};

router.put('/:id/status', async (req, res) => {
  const status = req.body?.status;
  if (typeof status !== 'string') {
    return res.status(400).json({ message: 'A status is required.' });
  }
  try {
    let driverId = null;
    if (req.user.role === 'driver') {
      if (!DRIVER_ALLOWED_FROM[status]) {
        return res.status(403).json({ message: 'Drivers can only start or complete a trip.' });
      }
      const driver = await db.query('SELECT id FROM fleet.drivers WHERE user_id = $1', [req.user.id]);
      if (!driver.rows[0]) {
        return res.status(404).json({ message: 'Driver profile not found.' });
      }
      driverId = driver.rows[0].id;
    }

    const result = await db.transaction(req.user.id, async (client) => {
      if (driverId) {
        const current = await client.query(
          'SELECT status FROM operations.trips WHERE id = $1 AND driver_id = $2 FOR UPDATE',
          [req.params.id, driverId]
        );
        if (!current.rows[0]) return { notFound: true };
        if (!DRIVER_ALLOWED_FROM[status].includes(current.rows[0].status)) {
          return { badTransition: true };
        }
      }
      const { rows } = await client.query(
        'UPDATE operations.trips SET status = $1 WHERE id = $2 RETURNING *',
        [status, req.params.id]
      );
      return { row: rows[0] };
    });

    if (result.badTransition) {
      return res.status(409).json({ message: 'This trip cannot move to that status from its current status.' });
    }
    if (result.notFound || !result.row) {
      return res.status(404).json({ message: 'Trip not found.' });
    }
    return res.json(result.row);
  } catch (error) {
    return handleDbError(error, res);
  }
});

module.exports = router;
