import { SignJWT } from 'jose';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/index.js';
import { generateCourseOutline } from '../src/services/ai.service.js';
import { resetKnownUsers } from '../src/services/user.service.js';
import { useTestDB } from './helpers/db.js';
import { makeOutline } from './helpers/fixtures.js';

vi.mock('../src/services/ai.service.js', () => ({
  generateCourseOutline: vi.fn(),
  generateLessonContent: vi.fn(),
}));

useTestDB();

// Same checks as production (issuer, audience, expiry, signature), but tokens are signed
// with a shared secret here instead of Auth0's private key, so no network is needed.
const ISSUER = 'https://test-tenant.example.com/';
const AUDIENCE = 'https://text-to-learn-api';
const SECRET = 'test-secret-that-is-at-least-32-bytes-long!';
const app = createApp({
  authConfig: { issuer: ISSUER, audience: AUDIENCE, secret: SECRET, tokenSigningAlg: 'HS256' },
});

const ALICE = 'auth0|alice';
const BOB = 'google-oauth2|bob';

async function token({
  sub = ALICE,
  issuer = ISSUER,
  audience = AUDIENCE,
  expiresIn = '1h',
  secret = SECRET,
} = {}) {
  return new SignJWT({ scope: 'openid profile email' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(secret));
}

// Supertest requests are thenables: returning one from an async function would send it.
// So build the header separately and attach it with .set().
const bearer = async (options) => ({ Authorization: `Bearer ${await token(options)}` });

let userinfo;
beforeEach(() => {
  resetKnownUsers();
  generateCourseOutline.mockResolvedValue(makeOutline());
  userinfo = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          sub: ALICE,
          email: 'Alice@Example.com',
          name: 'Alice',
          picture: 'https://example.com/a.png',
        }),
        { status: 200 },
      ),
  );
  vi.stubGlobal('fetch', userinfo);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requests without a valid token', () => {
  it('get 401 with a login message and a WWW-Authenticate header', async () => {
    const res = await request(app).get('/api/courses');

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Please log in to continue.');
    expect(res.headers['www-authenticate']).toMatch(/^Bearer/);
  });

  it.each([
    ['a malformed token', async () => 'not-a-jwt'],
    ['an expired token', () => token({ expiresIn: '-1m' })],
    ['a token for another API', () => token({ audience: 'https://some-other-api' })],
    ['a token from another issuer', () => token({ issuer: 'https://evil.example.com/' })],
    ['a token signed with the wrong key', () => token({ secret: 'x'.repeat(48) })],
  ])('reject %s', async (_, makeToken) => {
    const res = await request(app)
      .get('/api/courses')
      .set('Authorization', `Bearer ${await makeToken()}`);

    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/invalid or has expired/);
  });

  it('cannot use the dev-user header to act as someone else', async () => {
    const { body: course } = await request(app)
      .post('/api/courses/generate')
      .set(await bearer())
      .send({
        topic: "Alice's course",
      });

    const res = await request(app)
      .get(`/api/courses/${course.id}`)
      .set(await bearer({ sub: BOB }))
      .set('x-dev-user', ALICE);

    expect(res.status).toBe(404);
  });

  it('still reach the public health check', async () => {
    expect((await request(app).get('/api/health')).status).toBe(200);
  });
});

describe('requests with a valid token', () => {
  it('act as the user in the token', async () => {
    const created = await request(app)
      .post('/api/courses/generate')
      .set(await bearer())
      .send({
        topic: 'Photosynthesis',
      });

    expect(created.status).toBe(201);
    expect(created.body.creator).toBe(ALICE);

    const bobsList = await request(app)
      .get('/api/courses')
      .set(await bearer({ sub: BOB }));
    expect(bobsList.body).toEqual([]);
  });

  it('save the user with their Auth0 profile on first sign-in only', async () => {
    const accessToken = await token();

    await request(app).get('/api/courses').set('Authorization', `Bearer ${accessToken}`);
    await request(app).get('/api/courses').set('Authorization', `Bearer ${accessToken}`);

    expect(userinfo).toHaveBeenCalledTimes(1);
    const [url, init] = userinfo.mock.calls[0];
    expect(String(url)).toBe(`${ISSUER}userinfo`);
    expect(init.headers.authorization).toBe(`Bearer ${accessToken}`);

    const user = await User.findOne({ sub: ALICE });
    expect(user).toMatchObject({ email: 'alice@example.com', name: 'Alice' });
  });

  it('still saves the user when /userinfo is unavailable', async () => {
    userinfo.mockResolvedValueOnce(new Response('busy', { status: 429 }));

    const res = await request(app)
      .get('/api/courses')
      .set(await bearer());

    expect(res.status).toBe(200);
    expect(await User.findOne({ sub: ALICE })).toMatchObject({ sub: ALICE });
  });

  it('GET /api/users/me returns the profile', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set(await bearer());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ sub: ALICE, email: 'alice@example.com', name: 'Alice' });
  });
});
