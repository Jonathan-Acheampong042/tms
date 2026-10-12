const jwt = require('jsonwebtoken');
const db = require('../db');

async function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured.');
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!payload || typeof payload !== 'object' || !payload.id || !payload.role) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    const { rows } = await db.query(
      'SELECT id, role FROM accounts.users WHERE id = $1 AND is_active = TRUE',
      [payload.id]
    );
    if (!rows[0] || rows[0].role !== payload.role) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    req.user = { id: rows[0].id, role: rows[0].role };
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }
    return next(error);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You are not authorized to perform this action.' });
    }
    return next();
  };
}

module.exports = { authenticate, requireRole };