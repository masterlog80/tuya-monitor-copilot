'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const tuya = require('../tuya');
const { settingsDb } = require('../db');

const router = express.Router();

// GET /api/devices - list all devices
router.get('/', requireAuth, async (req, res) => {
  try {
    const devices = await tuya.getDevices();
    res.json(devices || []);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/devices/:id - get device details + status
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [device, status] = await Promise.all([
      tuya.getDevice(req.params.id),
      tuya.getDeviceStatus(req.params.id)
    ]);
    res.json({ ...device, status });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/devices/:id/status - get device status
router.get('/:id/status', requireAuth, async (req, res) => {
  try {
    const status = await tuya.getDeviceStatus(req.params.id);
    res.json(status);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// POST /api/devices/:id/toggle - toggle device on/off
router.post('/:id/toggle', requireAuth, async (req, res) => {
  try {
    const { on } = req.body;
    if (typeof on !== 'boolean') {
      return res.status(400).json({ error: '"on" field (boolean) required' });
    }
    const result = await tuya.toggleDevice(req.params.id, on);
    res.json({ success: true, result });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// POST /api/devices/:id/commands - send custom commands
router.post('/:id/commands', requireAuth, async (req, res) => {
  try {
    const { commands } = req.body;
    if (!Array.isArray(commands) || commands.length === 0) {
      return res.status(400).json({ error: 'commands array required' });
    }
    const result = await tuya.sendDeviceCommand(req.params.id, commands);
    res.json({ success: true, result });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/devices/config/refresh-interval - get refresh interval from settings
router.get('/config/refresh-interval', requireAuth, (req, res) => {
  const interval = settingsDb.get('app.refreshInterval').value() || 30;
  res.json({ refreshInterval: interval });
});

module.exports = router;
