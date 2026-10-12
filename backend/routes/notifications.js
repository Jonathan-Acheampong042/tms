
const express = require('express');
const db = require('../db');
const handleDbError = require('../utils/dbError');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, type, message, created_at, is_read
       FROM monitoring.notifications
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json(rows);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.put('/read-all', async (req, res) => {
  try {
    const { rowCount } = await db.transaction(req.user.id, (client) =>
      client.query(
        'UPDATE monitoring.notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
        [req.user.id]
      )
    );
    return res.json({ updated: rowCount });
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { rows } = await db.transaction(req.user.id, (client) =>
      client.query(
        `UPDATE monitoring.notifications SET is_read = TRUE
         WHERE id = $1 AND user_id = $2
         RETURNING id, type, message, created_at, is_read`,
        [req.params.id, req.user.id]
      )
    );
    if (!rows[0]) {
      return res.status(404).json({ message: 'Notification not found.' });
    }
    return res.json(rows[0]);
  } catch (error) {
    return handleDbError(error, res);
  }
});

module.exports = router;
