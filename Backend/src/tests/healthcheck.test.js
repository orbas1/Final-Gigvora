process.env.NODE_ENV = 'test';
process.env.TEST_DB_STORAGE = ':memory:';
process.env.DB_LOGGING = 'false';
process.env.API_SKIP_ROUTES = 'true';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { createApp } = require('../app');
const { sequelize } = require('../models');
const packageInfo = require('../../package.json');

const app = createApp();

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

test('root endpoint provides service metadata', async () => {
  const response = await request(app).get('/');

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.name, 'Gigvora API');
  assert.equal(response.body.version, packageInfo.version);
  assert.equal(response.body.environment, process.env.NODE_ENV);
  assert.ok(response.body.message.includes('Gigvora API'));
  assert.equal(response.body.links.health, '/health');
  assert.equal(response.body.links.versionedHealth, '/api/v1/health');
  assert.ok('docs' in response.body.links);
});

test('serves built frontend when available', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gigvora-frontend-'));
  const indexHtml = '<!doctype html><html><head><title>Gigvora</title></head><body><div id="root"></div></body></html>';
  fs.writeFileSync(path.join(tmpDir, 'index.html'), indexHtml);

  process.env.FRONTEND_DIST_PATH = tmpDir;
  const appWithFrontend = createApp();

  const rootResponse = await request(appWithFrontend).get('/');
  assert.equal(rootResponse.status, 200);
  assert.match(rootResponse.text, /<!doctype html>/i);
  assert.equal(rootResponse.headers['content-type'], 'text/html; charset=utf-8');

  const metadataResponse = await request(appWithFrontend).get('/api');
  assert.equal(metadataResponse.status, 200);
  assert.equal(metadataResponse.body.name, 'Gigvora API');
  assert.equal(metadataResponse.body.version, packageInfo.version);

  delete process.env.FRONTEND_DIST_PATH;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
