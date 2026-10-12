const express = require('express');
const crud = require('../utils/crud');
const handleDbError = require('../utils/dbError');

const router = express.Router();
const SCHEMA = 'fleet';
const TABLE = 'vehicles';

// The table's columns, defaults and constraints live in the database
// (database/02_fleet.sql). This file does not repeat them: utils/crud.js
// reads the column names from the database itself.

router.get('/', async (req, res) => {
  try {
    return res.json(await crud.findAll(SCHEMA, TABLE));
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const row = await crud.findById(SCHEMA, TABLE, req.params.id);
    if (!row) return res.status(404).json({ message: 'Vehicle not found.' });
    return res.json(row);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.post('/', async (req, res) => {
  try {
    return res.status(201).json(await crud.insert(SCHEMA, TABLE, req.body));
  } catch (error) {
    return handleDbError(error, res);
  }
});

// PATCH updates only the fields that are sent.
router.patch('/:id', async (req, res) => {
  try {
    const row = await crud.update(SCHEMA, TABLE, req.params.id, req.body);
    if (!row) return res.status(404).json({ message: 'Vehicle not found.' });
    return res.json(row);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await crud.remove(SCHEMA, TABLE, req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Vehicle not found.' });
    return res.status(204).send();
  } catch (error) {
    return handleDbError(error, res);
  }
});

module.exports = router;
