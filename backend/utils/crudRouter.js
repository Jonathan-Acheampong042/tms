const express = require('express');
const crud = require('./crud');
const db = require('../db');
const handleDbError = require('./dbError');
const { authenticate, requireRole } = require('../middleware/auth');

function createCrudRouter({
  schema,
  table,
  readRoles = ['admin'],
  writeRoles = ['admin'],
  updateRoles = writeRoles,
  deleteRoles = writeRoles,
  allowDelete = true,
}) {
  const router = express.Router();
  const guard = (...roles) => [authenticate, requireRole(...roles)];
  const readGuard = guard(...readRoles);
  const writeGuard = guard(...writeRoles);

  router.get('/', ...readGuard, async (req, res) => {
    try {
      return res.json(await crud.findAll(schema, table));
    } catch (error) {
      return handleDbError(error, res);
    }
  });

  router.get('/:id', ...readGuard, async (req, res) => {
    try {
      const row = await crud.findById(schema, table, req.params.id);
      if (!row) return res.status(404).json({ message: 'Record not found.' });
      return res.json(row);
    } catch (error) {
      return handleDbError(error, res);
    }
  });

  router.post('/', ...writeGuard, async (req, res) => {
    try {
      const row = await db.transaction(req.user.id, (client) =>
        crud.insert(schema, table, req.body, client)
      );
      return res.status(201).json(row);
    } catch (error) {
      return handleDbError(error, res);
    }
  });

  const update = async (req, res) => {
    try {
      const row = await db.transaction(req.user.id, (client) =>
        crud.update(schema, table, req.params.id, req.body, client)
      );
      if (!row) return res.status(404).json({ message: 'Record not found.' });
      return res.json(row);
    } catch (error) {
      return handleDbError(error, res);
    }
  };
  router.put('/:id', ...guard(...updateRoles), update);
  router.patch('/:id', ...guard(...updateRoles), update);

  if (allowDelete) {
    router.delete('/:id', ...guard(...deleteRoles), async (req, res) => {
      try {
        const deleted = await db.transaction(req.user.id, (client) =>
          crud.remove(schema, table, req.params.id, client)
        );
        if (!deleted) return res.status(404).json({ message: 'Record not found.' });
        return res.status(204).send();
      } catch (error) {
        return handleDbError(error, res);
      }
    });
  }

  return router;
}

module.exports = createCrudRouter;
