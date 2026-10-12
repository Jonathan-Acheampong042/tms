
const express = require('express');
const db = require('../db');
const handleDbError = require('../utils/dbError');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const [fleet, trips, revenue] = await Promise.all([
      db.query(
        'SELECT status, COUNT(*)::INT AS count FROM fleet.vehicles GROUP BY status ORDER BY status'
      ),
      db.query(
        'SELECT status, COUNT(*)::INT AS count FROM operations.trips GROUP BY status ORDER BY status'
      ),
      db.query(
        `SELECT COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) AS collected,
                COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS pending
         FROM billing.payments`
      ),
    ]);

    return res.json({
      fleet: fleet.rows,
      trips: trips.rows,
      revenue: revenue.rows[0],
    });
  } catch (error) {
    return handleDbError(error, res);
  }
});

module.exports = router;
