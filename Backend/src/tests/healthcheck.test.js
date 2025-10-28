process.env.NODE_ENV = 'test';
process.env.TEST_DB_STORAGE = ':memory:';
process.env.DB_LOGGING = 'false';
process.env.API_SKIP_ROUTES = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../app');
const { sequelize } = require('../models');

test.before(async () => {
  await sequelize.sync({ force: true });
});

test.after(async () => {
  await sequelize.close();
});

test('service health endpoint reports database connectivity', async () => {
  const response = await request(app).get('/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.checks?.database, 'up');
  assert.ok(typeof response.body.uptime === 'number');
  assert.ok(typeof response.body.latencyMs === 'number');
  assert.ok(response.body.timestamp);
});

test('versioned health endpoint remains in sync', async () => {
  const response = await request(app).get('/api/v1/health');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.checks, { database: 'up' });
});
