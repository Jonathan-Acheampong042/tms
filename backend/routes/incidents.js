const express = require('express');
const crud = require('../utils/crud');
const db = require('../db');
const handleDbError = require('../utils/dbError');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin', 'driver'));

router.get('/', async (req, res) => {
  try {
    const sql = `SELECT i.* FROM operations.driver_incidents i
      ${req.user.role === 'driver' ? 'JOIN fleet.drivers d ON d.id = i.driver_id WHERE d.user_id = $1' : ''}
      ORDER BY i.incident_date DESC`;
    const { rows } = await db.query(
      sql,
      req.user.role === 'driver' ? [req.user.id] : []
    );
    return res.json(rows);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.post('/', async (req, res) => {
  try {
    const incident = await db.transaction(req.user.id, async (client) => {
      const body = { ...(req.body || {}) };
      if (req.user.role === 'driver') {
        const { rows } = await client.query(
          'SELECT id FROM fleet.drivers WHERE user_id = $1',
          [req.user.id]
        );
        if (!rows[0]) {
          const error = new Error('Driver profile not found.');
          error.code = 'P0002';
          throw error;
        }
        body.driver_id = rows[0].id;
      }
      return crud.insert('operations', 'driver_incidents', body, client);
    });
    return res.status(201).json(incident);
  } catch (error) {
    return handleDbError(error, res);
  }
});

module.exports = router;
