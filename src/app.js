'use strict';

const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Rate limit login attempts: max 10 per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' }
});

// General API rate limit: 200 req per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' }
});

// Static rate limit: 300 req per minute per IP (prevents rapid filesystem access)
const staticLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/auth/login', loginLimiter);
app.use('/api', apiLimiter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/devices', require('./routes/devices'));

// Health check
app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

// SPA fallback - serve index.html for all non-API routes
app.get('*', staticLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Tuya Monitor running on http://localhost:${PORT}`);
});

module.exports = app;
