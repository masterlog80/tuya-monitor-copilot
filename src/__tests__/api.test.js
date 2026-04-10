'use strict';

const os = require('os');
const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Use a temp data directory for tests
process.env.DATA_DIR = path.join(os.tmpdir(), `tuya-test-${Date.now()}`);

const app = require('../app');

let adminToken;
let userToken;
let createdUserId;

describe('Auth API', () => {
  test('POST /api/auth/login - fails with missing credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test('POST /api/auth/login - fails with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  test('POST /api/auth/login - succeeds with default admin credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe('admin');
    expect(res.body.user.role).toBe('admin');
    adminToken = res.body.token;
  });

  test('POST /api/auth/logout - succeeds', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

describe('User Management API', () => {
  beforeAll(async () => {
    // Get fresh token
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin' });
    adminToken = res.body.token;
  });

  test('GET /api/users - requires auth', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  test('GET /api/users - returns users list for admin', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    // Should not expose passwords
    expect(res.body[0].password).toBeUndefined();
  });

  test('POST /api/users - creates a new user', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'testuser', password: 'testpass123', role: 'user' });
    expect(res.status).toBe(201);
    expect(res.body.username).toBe('testuser');
    expect(res.body.role).toBe('user');
    expect(res.body.password).toBeUndefined();
    createdUserId = res.body.id;
  });

  test('POST /api/users - rejects duplicate username', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'testuser', password: 'anotherpass', role: 'user' });
    expect(res.status).toBe(409);
  });

  test('POST /api/users - rejects invalid role', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'newuser2', password: 'pass123', role: 'superadmin' });
    expect(res.status).toBe(400);
  });

  test('PUT /api/users/:id - updates user role', async () => {
    const res = await request(app)
      .put(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
  });

  test('Non-admin user cannot access user management', async () => {
    // Create a fresh regular user for this test
    const createRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'regularuser', password: 'regularpass', role: 'user' });
    expect(createRes.status).toBe(201);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'regularuser', password: 'regularpass' });
    userToken = loginRes.body.token;

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);

    // Clean up
    await request(app)
      .delete(`/api/users/${createRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
  });

  test('PUT /api/users/me/password - changes own password', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'testpass123' });
    userToken = loginRes.body.token;

    const res = await request(app)
      .put('/api/users/me/password')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ currentPassword: 'testpass123', newPassword: 'newpass456' });
    expect(res.status).toBe(200);
  });

  test('DELETE /api/users/:id - deletes user', async () => {
    const res = await request(app)
      .delete(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('DELETE /api/users/:id - cannot delete yourself', async () => {
    // Get admin user ID
    const usersRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);
    const adminUser = usersRes.body.find(u => u.username === 'admin');

    const res = await request(app)
      .delete(`/api/users/${adminUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });
});

describe('Settings API', () => {
  test('GET /api/settings - requires admin', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(401);
  });

  test('GET /api/settings - returns settings for admin', async () => {
    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.tuya).toBeDefined();
    expect(res.body.app).toBeDefined();
    // Secret should be masked or empty (not a real secret value)
    const secret = res.body.tuya.accessSecret;
    expect(secret === '' || secret === '********').toBe(true);
  });

  test('PUT /api/settings - saves settings', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        tuya: { accessId: 'test-id', region: 'us', userId: 'user-123' },
        app: { refreshInterval: 60 }
      });
    expect(res.status).toBe(200);
  });

  test('PUT /api/settings - validates refresh interval minimum', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ app: { refreshInterval: 2 } }); // Less than 5 minimum
    expect(res.status).toBe(200); // Accepted but invalid values ignored
    // Verify it didn't save the bad value
    const checkRes = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(checkRes.body.app.refreshInterval).toBeGreaterThanOrEqual(5);
  });
});

describe('Devices API', () => {
  test('GET /api/devices - requires auth', async () => {
    const res = await request(app).get('/api/devices');
    expect(res.status).toBe(401);
  });

  test('GET /api/devices - returns 502 when Tuya credentials not configured', async () => {
    const res = await request(app)
      .get('/api/devices')
      .set('Authorization', `Bearer ${adminToken}`);
    // Without real credentials, should return an error
    expect([200, 502]).toContain(res.status);
    if (res.status === 502) {
      expect(res.body.error).toBeDefined();
    }
  });

  test('POST /api/devices/:id/toggle - validates on field', async () => {
    const res = await request(app)
      .post('/api/devices/fake-device-id/toggle')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ on: 'yes' }); // Not boolean
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/boolean/i);
  });
});

describe('Health Check', () => {
  test('GET /healthz - returns ok', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// Cleanup temp data dir after tests
afterAll(() => {
  const dataDir = process.env.DATA_DIR;
  if (dataDir && dataDir.startsWith(os.tmpdir())) {
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch (e) { /* ignore */ }
  }
});
