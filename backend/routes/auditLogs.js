const express = require('express');
const db = require('../db');
const handleDbError = require('../utils/dbError');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const { rows } = await db.query(
      `SELECT id, user_id, action, table_name, record_id, created_at
       FROM monitoring.audit_logs
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return res.json(rows);
  } catch (error) {
    return handleDbError(error, res);
  }
});

module.exports = router;
