'use strict';

const path = require('path');
const fs = require('fs');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const usersAdapter = new FileSync(path.join(DATA_DIR, 'users.json'));
const settingsAdapter = new FileSync(path.join(DATA_DIR, 'settings.json'));

const usersDb = low(usersAdapter);
const settingsDb = low(settingsAdapter);

// Default user DB structure
usersDb
  .defaults({ users: [] })
  .write();

// Default settings DB structure
settingsDb
  .defaults({
    tuya: {
      accessId: '',
      accessSecret: '',
      region: 'eu',
      userId: '',
      userCode: ''
    },
    app: {
      refreshInterval: 30,
      jwtSecret: require('crypto').randomBytes(32).toString('hex')
    }
  })
  .write();

// Seed admin user if no users exist
function seedAdmin() {
  const users = usersDb.get('users').value();
  if (!users || users.length === 0) {
    const hash = bcrypt.hashSync('admin', 10);
    usersDb
      .get('users')
      .push({
        id: require('crypto').randomUUID(),
        username: 'admin',
        password: hash,
        role: 'admin',
        createdAt: new Date().toISOString()
      })
      .write();
    console.log('Default admin user created (username: admin, password: admin)');
    console.log('Please change this password immediately via User Management!');
  }
}

seedAdmin();

module.exports = { usersDb, settingsDb };
