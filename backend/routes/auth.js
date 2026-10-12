
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const handleDbError = require('../utils/dbError');

const router = express.Router();
// Compared against when the user does not exist, so login takes the same time either way.
const DUMMY_HASH = bcrypt.hashSync('timing-guard-not-a-real-password', 10);
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
});
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many reset requests. Please try again later.' },
});

router.post('/register', async (req, res) => {
  const body = req.body || {};
  if (body.role && body.role !== 'customer') {
    return res.status(403).json({
      message: 'Public registration is limited to customer accounts.',
    });
  }
  const nameParts = String(body.full_name || '').trim().split(/\s+/).filter(Boolean);
  const firstName = body.first_name || nameParts[0];
  const lastName = body.last_name || nameParts.slice(1).join(' ');

  for (const field of ['username', 'email', 'password']) {
    if (typeof body[field] !== 'string' || !body[field].trim()) {
      return res.status(400).json({ message: `Missing required field: ${field}` });
    }
  }
  if (!firstName || !lastName) {
    return res.status(400).json({ message: 'First name and last name are required.' });
  }
  if (body.password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }

  try {
    const { rows } = await db.query(
      `SELECT accounts.register_user($1, $2, $3, $4, $5, $6, $7, $8, $9) AS id`,
      [
        body.username,
        body.email,
        body.password,
        firstName,
        lastName,
        body.middle_name || null,
        body.phone || null,
        body.address || null,
        'customer',
      ]
    );
    const result = await db.query(
      'SELECT * FROM accounts.user_profiles WHERE id = $1',
      [rows[0].id]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    if (typeof identifier !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Identifier and password are required.' });
    }
    const { rows } = await db.query(
      'SELECT * FROM accounts.get_user_for_login($1, $2)',
      [identifier, 'login']
    );
    const user = rows[0];
    // Always run one bcrypt comparison, so an unknown user takes as long as a wrong password.
    const passwordOk = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !passwordOk) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured.');
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );
    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.post('/request-reset', resetLimiter, async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(503).json({
      message: 'Password reset delivery is not configured.',
    });
  }
  try {
    const otp = String(crypto.randomInt(100000, 1000000));
    const { rows } = await db.query(
      'SELECT accounts.request_password_reset($1, $2) AS user_id',
      [req.body?.email, otp]
    );
    if (process.env.NODE_ENV !== 'production' && rows[0]?.user_id) {
      console.info(`Development password reset OTP: ${otp}`);
    }
    return res.json({
      message: 'If the account exists, password reset instructions have been sent.',
    });
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.post('/complete-reset', async (req, res) => {
  const { email, otp, new_password: newPassword } = req.body || {};
  if (typeof email !== 'string' || otp == null || typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({
      message: 'Email, code and a new password of at least 8 characters are required.',
    });
  }
  try {
    const { rows } = await db.query('SELECT * FROM accounts.get_active_reset($1)', [
      email,
    ]);
    if (!rows[0]) {
      return res.status(400).json({ message: 'Reset code is invalid or expired.' });
    }

    try {
      await db.query('SELECT accounts.complete_password_reset($1, $2, $3)', [
        rows[0].reset_user_id,
        String(otp),
        newPassword,
      ]);
    } catch (error) {
      if (error.code === 'P0001') {
        await db.query('SELECT accounts.record_failed_reset_attempt($1)', [
          rows[0].reset_user_id,
        ]);
      }
      throw error;
    }
    return res.json({ message: 'Password has been reset.' });
  } catch (error) {
    return handleDbError(error, res);
  }
});

module.exports = router;
