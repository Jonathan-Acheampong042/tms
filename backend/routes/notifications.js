const express = require('express');
const db = require('../db');
const handleDbError = require('../utils/dbError');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM monitoring.api_notifications($1, $2::uuid, NULL)',
      ['list', req.query.user_id ?? null]
    );
    return res.json(rows.map((row) => row.api_notifications));
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.put('/read-all', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM monitoring.api_notifications($1, $2::uuid, NULL)',
      ['read_all', req.body?.user_id ?? null]
    );
    return res.json({ updated: rows.length });
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM monitoring.api_notifications($1, $2::uuid, $3::uuid)',
      ['read', req.body?.user_id ?? null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Notification not found.' });
    return res.json(rows[0].api_notifications);
  } catch (error) {
    return handleDbError(error, res);
  }
});

module.exports = router;
