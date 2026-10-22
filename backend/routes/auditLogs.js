const express = require('express');
const db = require('../db');
const handleDbError = require('../utils/dbError');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    const { rows } = await db.query(`
      SELECT 
        a.id,
        a.user_id,
        u.username,
        u.email,
        u.role,
        COALESCE(u.first_name, '') AS first_name,
        COALESCE(u.last_name, '') AS last_name,
        a.action,
        a.table_name,
        a.record_id,
        a.created_at,
        v.plate_number,
        drv_user.first_name  AS driver_first_name,
        drv_user.last_name   AS driver_last_name,
        r.name               AS route_name,
        inv.invoice_number
      FROM monitoring.audit_logs a
      LEFT JOIN accounts.users u ON a.user_id = u.id
      LEFT JOIN fleet.vehicles v
        ON a.table_name = 'vehicles' AND v.id = a.record_id
      LEFT JOIN fleet.drivers drv
        ON a.table_name = 'drivers' AND drv.id = a.record_id
      LEFT JOIN accounts.users drv_user
        ON drv.user_id = drv_user.id
      LEFT JOIN operations.trips t
        ON a.table_name = 'trips' AND t.id = a.record_id
      LEFT JOIN operations.routes r
        ON t.route_id = r.id
      LEFT JOIN billing.invoices inv
        ON a.table_name = 'invoices' AND inv.id = a.record_id
      ORDER BY a.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    return res.json(rows);
  } catch (error) {
    return handleDbError(error, res);
  }
});

module.exports = router;
