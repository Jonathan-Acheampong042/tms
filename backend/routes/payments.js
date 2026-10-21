const express = require('express');
const apiTable = require('../utils/apiTable');
const handleDbError = require('../utils/dbError');

const router = express.Router();
router.get('/', async (req, res) => {
  try {
    return res.json(await apiTable('billing.payments', 'list'));
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const payment = await apiTable('billing.payments', 'get', req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found.' });
    return res.json(payment);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.post('/', async (req, res) => {
  try {
    return res.status(201).json(
      await apiTable('billing.payments', 'create', null, req.body ?? {})
    );
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.put('/:id', update);
router.patch('/:id', update);

async function update(req, res) {
  try {
    const payment = await apiTable('billing.payments', 'update', req.params.id, req.body ?? {});
    if (!payment) return res.status(404).json({ message: 'Payment not found.' });
    return res.json(payment);
  } catch (error) {
    return handleDbError(error, res);
  }
}

module.exports = router;
