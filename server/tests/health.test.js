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
    // Mongoose would otherwise buffer for 10 s. Allow a slow, busy CI machine some slack.
    expect(Date.now() - startedAt).toBeLessThan(3000);
  });
});

describe('CORS', () => {
  it('allows the configured client origin', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('lets browsers cache the preflight answer', async () => {
    const res = await request(app)
      .options('/api/courses')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-max-age']).toBe('600');
    expect(res.headers['access-control-allow-headers']).toMatch(/authorization/i);
  });

  it('refuses other websites with 403, not a server error', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('Origin not allowed: https://evil.example.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
