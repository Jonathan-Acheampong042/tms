const express = require('express');
const apiTable = require('../utils/apiTable');
const handleDbError = require('../utils/dbError');

const router = express.Router();
router.get('/', async (req, res) => {
  try {
    return res.json(await apiTable('fleet.maintenance_records', 'list'));
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const record = await apiTable('fleet.maintenance_records', 'get', req.params.id);
    if (!record) return res.status(404).json({ message: 'Maintenance record not found.' });
    return res.json(record);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.post('/', async (req, res) => {
  try {
    return res.status(201).json(
      await apiTable('fleet.maintenance_records', 'create', null, req.body ?? {})
    );
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.put('/:id', update);
router.patch('/:id', update);

async function update(req, res) {
  try {
    const record = await apiTable('fleet.maintenance_records', 'update', req.params.id, req.body ?? {});
    if (!record) return res.status(404).json({ message: 'Maintenance record not found.' });
    return res.json(record);
  } catch (error) {
    return handleDbError(error, res);
  }
}

module.exports = router;
