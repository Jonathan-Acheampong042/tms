const express = require('express');
const db = require('../db');
const handleDbError = require('../utils/dbError');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/me', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM accounts.user_profiles WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'User not found.' });
    return res.json(rows[0]);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.put('/profile', authenticate, async (req, res) => {
  const body = req.body || {};
  try {
    await db.transaction(req.user.id, (client) =>
      client.query(
        'SELECT accounts.update_user_profile($1, $2, $3, $4, $5, $6)',
        [
          req.user.id,
          body.first_name ?? null,
          body.middle_name ?? null,
          body.last_name ?? null,
          body.phone ?? null,
          body.address ?? null,
        ]
      )
    );
    const { rows } = await db.query(
      'SELECT * FROM accounts.user_profiles WHERE id = $1',
      [req.user.id]
    );
    return res.json(rows[0]);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ message: 'You cannot deactivate your own account.' });
  }
  try {
    await db.transaction(req.user.id, (client) =>
      client.query('SELECT accounts.deactivate_user($1)', [req.params.id])
    );
    return res.status(204).send();
  } catch (error) {
    return handleDbError(error, res);
  }
});

module.exports = router;