const express = require('express');
const apiTable = require('../utils/apiTable');
const handleDbError = require('../utils/dbError');

const router = express.Router();


router.get('/', async (req, res) => {
  try {
    return res.json(await apiTable(RESOURCE, 'list'));
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const route = await apiTable(RESOURCE, 'get', req.params.id);
    if (!route) return res.status(404).json({ message: 'Route not found.' });
    return res.json(route);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.post('/', async (req, res) => {
  try {
    return res.status(201).json(await apiTable(RESOURCE, 'create', null, req.body ?? {}));
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.put('/:id', update);
router.patch('/:id', update);

async function update(req, res) {
  try {
    const route = await apiTable(RESOURCE, 'update', req.params.id, req.body ?? {});
    if (!route) return res.status(404).json({ message: 'Route not found.' });
    return res.json(route);
  } catch (error) {
    return handleDbError(error, res);
  }
}

module.exports = router;
