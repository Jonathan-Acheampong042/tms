const express = require('express');
const apiTable = require('../utils/apiTable');
const handleDbError = require('../utils/dbError');

const router = express.Router();
router.get('/', async (req, res) => {
  try {
    return res.json(await apiTable('operations.driver_incidents', 'list'));
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const incident = await apiTable('operations.driver_incidents', 'get', req.params.id);
    if (!incident) return res.status(404).json({ message: 'Incident not found.' });
    return res.json(incident);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.post('/', async (req, res) => {
  try {
    return res.status(201).json(
      await apiTable('operations.driver_incidents', 'create', null, req.body ?? {})
    );
  } catch (error) {
    return handleDbError(error, res);
  }
});

module.exports = router;
