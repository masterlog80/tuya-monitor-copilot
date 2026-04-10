'use strict';

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { usersDb } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/users - list all users (admin only)
router.get('/', requireAdmin, (req, res) => {
  const users = usersDb
    .get('users')
    .map(u => ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt }))
    .value();
  res.json(users);
});

// POST /api/users - create a user (admin only)
router.post('/', requireAdmin, (req, res) => {
  const { username, password, role = 'user' } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or user' });
  }

  const exists = usersDb.get('users').find({ username }).value();
  if (exists) {
    return res.status(409).json({ error: 'Username already exists' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const newUser = {
    id: crypto.randomUUID(),
    username,
    password: hash,
    role,
    createdAt: new Date().toISOString()
  };
  usersDb.get('users').push(newUser).write();

  res.status(201).json({ id: newUser.id, username, role, createdAt: newUser.createdAt });
});

// PUT /api/users/:id - update a user (admin only)
router.put('/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { password, role } = req.body;

  const user = usersDb.get('users').find({ id }).value();
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const updates = {};
  if (password) updates.password = bcrypt.hashSync(password, 10);
  if (role) {
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Role must be admin or user' });
    }
    updates.role = role;
  }

  usersDb.get('users').find({ id }).assign(updates).write();
  const updated = usersDb.get('users').find({ id }).value();
  res.json({ id: updated.id, username: updated.username, role: updated.role, createdAt: updated.createdAt });
});

// DELETE /api/users/:id - delete a user (admin only)
router.delete('/:id', requireAdmin, (req, res) => {
  const { id } = req.params;

  // Prevent deleting yourself
  if (req.user.id === id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  const user = usersDb.get('users').find({ id }).value();
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  usersDb.get('users').remove({ id }).write();
  res.json({ message: 'User deleted' });
});

// PUT /api/users/me/password - change own password (any authenticated user)
router.put('/me/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password required' });
  }

  const user = usersDb.get('users').find({ id: req.user.id }).value();
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const valid = bcrypt.compareSync(currentPassword, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  usersDb.get('users').find({ id: req.user.id }).assign({
    password: bcrypt.hashSync(newPassword, 10)
  }).write();

  res.json({ message: 'Password updated successfully' });
});

module.exports = router;
