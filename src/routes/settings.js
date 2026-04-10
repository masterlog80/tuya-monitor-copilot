'use strict';

const express = require('express');
const { settingsDb } = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const SECRET_MASK = '********';

// GET /api/settings - get current settings (admin only)
router.get('/', requireAdmin, (req, res) => {
  const tuya = settingsDb.get('tuya').value();
  const app = settingsDb.get('app').value();
  // Mask the secret
  res.json({
    tuya: {
      accessId: tuya.accessId,
      accessSecret: tuya.accessSecret ? SECRET_MASK : '',
      region: tuya.region,
      userId: tuya.userId,
      userCode: tuya.userCode || ''
    },
    app: {
      refreshInterval: app.refreshInterval
    }
  });
});

// PUT /api/settings - update settings (admin only)
router.put('/', requireAdmin, (req, res) => {
  const { tuya, app } = req.body;

  if (tuya) {
    const current = settingsDb.get('tuya').value();
    const updates = {
      accessId: tuya.accessId !== undefined ? tuya.accessId : current.accessId,
      region: tuya.region !== undefined ? tuya.region : current.region,
      userId: tuya.userId !== undefined ? tuya.userId : current.userId,
      userCode: tuya.userCode !== undefined ? tuya.userCode : (current.userCode || '')
    };
    // Only update secret if a real value is provided (not masked)
    if (tuya.accessSecret && tuya.accessSecret !== SECRET_MASK) {
      updates.accessSecret = tuya.accessSecret;
    }
    settingsDb.set('tuya', { ...current, ...updates }).write();
  }

  if (app) {
    const currentApp = settingsDb.get('app').value();
    const appUpdates = {};
    if (app.refreshInterval !== undefined) {
      const val = parseInt(app.refreshInterval, 10);
      if (!isNaN(val) && val >= 5) {
        appUpdates.refreshInterval = val;
      }
    }
    settingsDb.set('app', { ...currentApp, ...appUpdates }).write();
  }

  res.json({ message: 'Settings saved' });
});

module.exports = router;
