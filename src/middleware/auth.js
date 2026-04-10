'use strict';

const jwt = require('jsonwebtoken');
const { settingsDb } = require('../db');

function getJwtSecret() {
  return settingsDb.get('app.jwtSecret').value();
}

function requireAuth(req, res, next) {
  const token =
    req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin role required' });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
