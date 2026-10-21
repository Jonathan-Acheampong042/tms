const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const handleDbError = require('../utils/dbError');

const router = express.Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
});

router.post('/login', loginLimiter, async (req, res) => {
  const { identifier, password } = req.body || {};

  try {
    const { rows } = await db.query(
      'SELECT * FROM accounts.authenticate_user($1, $2)',
      [identifier ?? null, password ?? null]
    );
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ message: 'Invalid username, email, or password.' });
    }
    return res.json(user);
  } catch (error) {
    return handleDbError(error, res);
  }
});

module.exports = router;
