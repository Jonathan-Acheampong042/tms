require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
// Set CORS_ORIGIN (comma separated) to the frontend's address to restrict access.
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('TMS API is running. Visit /api/vehicles to view vehicles.');
});

app.get('/api/health', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ status: 'ok', time: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/route-templates', require('./routes/routeTemplates'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/fuel', require('./routes/fuel'));
app.use('/api/incidents', require('./routes/incidents'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/audit-logs', require('./routes/auditLogs'));
app.use('/api/reports', require('./routes/reports'));

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ message: 'Internal server error.' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));