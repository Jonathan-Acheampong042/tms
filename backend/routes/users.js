const express = require('express');
const db = require('../db');
const handleDbError = require('../utils/dbError');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM accounts.user_profiles ORDER BY created_at DESC'
    );
    return res.json(rows);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM accounts.user_profiles WHERE id = $1',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'User not found.' });
    return res.json(rows[0]);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.post('/', async (req, res) => {
  const role = req.body && typeof req.body === 'object' ? req.body.role : null;
  if (!['customer', 'driver', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Choose a valid account role.' });
  }

  const createAccountFunctions = {
    customer: 'accounts.create_customer',
    driver: 'fleet.create_driver',
    admin: 'accounts.create_admin',
  };
  const createAccountFunction = createAccountFunctions[role];

  try {
    const { rows } = await db.query(
      `SELECT * FROM ${createAccountFunction}($1::jsonb)`,
      [JSON.stringify(req.body ?? {})]
    );
    const user = rows[0];
    return res.status(201).json(user);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.put('/:id/profile', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM accounts.update_user_profile_json($1::uuid, $2::jsonb)',
      [req.params.id, JSON.stringify(req.body ?? {})]
    );
    if (!rows[0]) return res.status(404).json({ message: 'User not found.' });
    return res.json(rows[0]);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('SELECT accounts.deactivate_user($1)', [req.params.id]);
    return res.status(204).send();
  } catch (error) {
    return handleDbError(error, res);
  }
});

module.exports = router;
