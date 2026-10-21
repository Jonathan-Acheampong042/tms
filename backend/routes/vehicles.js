const express = require('express');
const db = require('../db');
const handleDbError = require('../utils/dbError');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM fleet.list_vehicles()');
    return res.json(rows);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM fleet.get_vehicle($1::uuid)',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Vehicle not found.' });
    }
    return res.json(rows[0]);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.post('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM fleet.create_vehicle($1::jsonb)',
      [JSON.stringify(req.body ?? {})]
    );
    return res.status(201).json(rows[0]);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM fleet.update_vehicle($1::uuid, $2::jsonb)',
      [req.params.id, JSON.stringify(req.body ?? {})]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Vehicle not found.' });
    }
    return res.json(rows[0]);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM fleet.delete_vehicle($1::uuid)',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Vehicle not found.' });
    }
    return res.status(204).send();
  } catch (error) {
    return handleDbError(error, res);
  }
});

module.exports = router;
