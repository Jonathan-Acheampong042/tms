const express = require('express');
const db = require('../db');
const handleDbError = require('../utils/dbError');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM monitoring.api_audit_logs($1, $2)',
      [req.query.limit ?? null, req.query.offset ?? null]
    );
    return res.json(rows.map((row) => row.api_audit_logs));
  } catch (error) {
    return handleDbError(error, res);
  }
});

module.exports = router;
