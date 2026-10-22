const express = require('express');
const db = require('../db');
const handleDbError = require('../utils/dbError');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        di.id,
        di.driver_id,
        di.trip_id,
        di.description,
        di.incident_date,
        di.severity,
        u.first_name,
        u.last_name,
        d.license_number
      FROM operations.driver_incidents di
      LEFT JOIN fleet.drivers d ON di.driver_id = d.id
      LEFT JOIN accounts.users u ON d.user_id = u.id
      ORDER BY di.incident_date DESC, di.id DESC
    `);
    return res.json(rows);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        di.id,
        di.driver_id,
        di.trip_id,
        di.description,
        di.incident_date,
        di.severity,
        u.first_name,
        u.last_name,
        d.license_number
      FROM operations.driver_incidents di
      LEFT JOIN fleet.drivers d ON di.driver_id = d.id
      LEFT JOIN accounts.users u ON d.user_id = u.id
      WHERE di.id = $1::uuid
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Incident not found.' });
    return res.json(rows[0]);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.post('/', async (req, res) => {
  try {
    const { driver_id, description, incident_date, severity = 'low', trip_id = null } = req.body;
    if (!driver_id || !description || !incident_date) {
      return res.status(400).json({ message: 'Driver, description, and incident date are required.' });
    }

    const { rows } = await db.query(`
      INSERT INTO operations.driver_incidents (driver_id, trip_id, description, incident_date, severity)
      VALUES ($1::uuid, $2, $3, $4::date, $5)
      RETURNING *
    `, [driver_id, trip_id || null, description.trim(), incident_date, severity]);

    return res.status(201).json(rows[0]);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.patch('/:id', updateIncident);
router.put('/:id', updateIncident);

async function updateIncident(req, res) {
  try {
    const { driver_id, description, incident_date, severity } = req.body;
    const fields = [];
    const values = [req.params.id];
    let idx = 2;

    if (driver_id) {
      fields.push(`driver_id = $${idx++}::uuid`);
      values.push(driver_id);
    }
    if (description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(description.trim());
    }
    if (incident_date) {
      fields.push(`incident_date = $${idx++}::date`);
      values.push(incident_date);
    }
    if (severity) {
      fields.push(`severity = $${idx++}`);
      values.push(severity);
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No editable fields were provided.' });
    }

    const { rows } = await db.query(`
      UPDATE operations.driver_incidents
      SET ${fields.join(', ')}
      WHERE id = $1::uuid
      RETURNING *
    `, values);

    if (!rows[0]) return res.status(404).json({ message: 'Incident not found.' });
    return res.json(rows[0]);
  } catch (error) {
    return handleDbError(error, res);
  }
}

module.exports = router;
