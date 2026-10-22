const express = require('express');
const db = require('../db');
const apiTable = require('../utils/apiTable');
const handleDbError = require('../utils/dbError');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM operations.api_trips()');
    return res.json(rows.map((row) => row.api_trips));
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM operations.api_trips($1::uuid)',
      [req.params.id]
    );
    const trip = rows[0]?.api_trips;
    if (!trip) return res.status(404).json({ message: 'Trip not found.' });
    return res.json(trip);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.post('/', async (req, res) => {
  try {
    let routeId = req.body?.route_id;

    // If route_id is not provided, resolve or create route from origin & destination
    if (!routeId && req.body?.origin && req.body?.destination) {
      const origin = String(req.body.origin).trim();
      const destination = String(req.body.destination).trim();

      const existing = await db.query(
        'SELECT id FROM operations.routes WHERE LOWER(origin) = LOWER($1) AND LOWER(destination) = LOWER($2) LIMIT 1',
        [origin, destination]
      );

      if (existing.rows.length > 0) {
        routeId = existing.rows[0].id;
      } else {
        const routeName = req.body.route_name?.trim() || `${origin} → ${destination} Route`;
        const created = await db.query(
          'INSERT INTO operations.routes (name, origin, destination) VALUES ($1, $2, $3) RETURNING id',
          [routeName, origin, destination]
        );
        routeId = created.rows[0]?.id;
      }
    }

    // Fallback if still no routeId: use the first existing route template
    if (!routeId) {
      const fallback = await db.query('SELECT id FROM operations.routes LIMIT 1');
      routeId = fallback.rows[0]?.id;
    }

    if (!routeId) {
      return res.status(400).json({ message: 'A route is required to schedule a trip.' });
    }

    const payload = {
      route_id: routeId,
      vehicle_id: req.body.vehicle_id,
      driver_id: req.body.driver_id,
      scheduled_start: req.body.scheduled_start,
      scheduled_end: req.body.scheduled_end,
      status: req.body.status || 'scheduled',
      location: req.body.location || null,
    };

    const newTrip = await apiTable('operations.trips', 'create', null, payload);
    return res.status(201).json(newTrip);
  } catch (error) {
    return handleDbError(error, res);
  }
});

router.put('/:id/status', updateStatus);
router.patch('/:id/status', updateStatus);
router.patch('/:id', updateTrip);
router.put('/:id', updateTrip);

async function updateTrip(req, res) {
  try {
    const fields = {};
    if (req.body.vehicle_id) fields.vehicle_id = req.body.vehicle_id;
    if (req.body.driver_id) fields.driver_id = req.body.driver_id;
    if (req.body.scheduled_start) fields.scheduled_start = req.body.scheduled_start;
    if (req.body.scheduled_end) fields.scheduled_end = req.body.scheduled_end;
    if (req.body.status) fields.status = req.body.status;

    const trip = await apiTable('operations.trips', 'update', req.params.id, fields);
    if (!trip) return res.status(404).json({ message: 'Trip not found.' });
    return res.json(trip);
  } catch (error) {
    return handleDbError(error, res);
  }
}

async function updateStatus(req, res) {
  try {
    const trip = await apiTable('operations.trips', 'update', req.params.id, {
      status: req.body?.status,
    });
    if (!trip) return res.status(404).json({ message: 'Trip not found.' });
    return res.json(trip);
  } catch (error) {
    return handleDbError(error, res);
  }
}

module.exports = router;
