import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('GET /api/health', () => {
  it('reports the API status', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('database');
  });
});

describe('unknown routes', () => {
  it('return a JSON 404', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/Route not found/);
  });
});

describe('without a database connection', () => {
  // This file never connects Mongoose, so it doubles as the "database down" case.
  it('course routes fail fast with 503 instead of hanging', async () => {
    const startedAt = Date.now();
    const res = await request(app).get('/api/courses');

    expect(res.status).toBe(503);
    expect(res.body.error.message).toMatch(/database is not available/);
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });
});

describe('CORS', () => {
  it('allows the configured client origin', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
