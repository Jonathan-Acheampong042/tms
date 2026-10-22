const express = require('express');
const db = require('../db');
const handleDbError = require('../utils/dbError');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    let query;
    let params;
    if (req.query.user_id) {
      query = 'SELECT * FROM monitoring.api_notifications($1, $2::uuid, NULL)';
      params = ['list', req.query.user_id];
    } else {
      query = 'SELECT to_jsonb(n) AS api_notifications FROM monitoring.notifications AS n ORDER BY n.created_at DESC';
      params = [];
    }
    const { rows } = await db.query(query, params);
    return res.json(rows.map((row) => row.api_notifications));
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.post('/', async (req, res) => {
  try {
    const { target = 'all', type = 'announcement', message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Announcement message is required.' });
    }

    let userQuery = 'SELECT id FROM accounts.users WHERE is_active = TRUE';
    const params = [];

    if (target === 'drivers') {
      userQuery += ' AND role = $1';
      params.push('driver');
    } else if (target === 'customers') {
      userQuery += ' AND role = $1';
      params.push('customer');
    } else if (target === 'admins') {
      userQuery += ' AND role = $1';
      params.push('admin');
    } else if (req.body.user_id) {
      userQuery += ' AND id = $1';
      params.push(req.body.user_id);
    }

    const { rows: users } = await db.query(userQuery, params);
    if (users.length === 0) {
      return res.status(404).json({ message: 'No target recipients found.' });
    }

    const insertValues = users.map((u, i) => `($${i * 3 + 1}::uuid, $${i * 3 + 2}, $${i * 3 + 3})`).join(', ');
    const insertParams = [];
    users.forEach(u => {
      insertParams.push(u.id, type, message.trim());
    });

    await db.query(
      `INSERT INTO monitoring.notifications (user_id, type, message) VALUES ${insertValues}`,
      insertParams
    );

    return res.status(201).json({
      message: 'Announcement broadcast successfully.',
      recipientsCount: users.length,
    });
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.put('/read-all', async (req, res) => {
  try {
    let query;
    let params;
    if (req.body?.user_id) {
      query = 'SELECT * FROM monitoring.api_notifications($1, $2::uuid, NULL)';
      params = ['read_all', req.body.user_id];
    } else {
      query = 'UPDATE monitoring.notifications SET is_read = TRUE WHERE is_read = FALSE RETURNING to_jsonb(notifications) AS api_notifications';
      params = [];
    }
    const { rows } = await db.query(query, params);
    return res.json({ updated: rows.length });
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'UPDATE monitoring.notifications SET is_read = TRUE WHERE id = $1 RETURNING to_jsonb(notifications) AS api_notifications',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Notification not found.' });
    return res.json(rows[0].api_notifications);
  } catch (error) {
    return handleDbError(error, res);
  }
});

module.exports = router;
