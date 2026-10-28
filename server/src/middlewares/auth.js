import { auth } from 'express-oauth2-jwt-bearer';
import { env } from '../config/env.js';
import { ensureUser } from '../services/user.service.js';
import { devUser } from './devUser.js';

/** Auth0 settings from the environment, or null when Auth0 isn't configured (local dev). */
export function authConfigFromEnv() {
  if (!env.AUTH0_ISSUER) return null;
  return { issuerBaseURL: env.AUTH0_ISSUER, audience: env.AUTH0_AUDIENCE };
}

/**
 * Middlewares that identify the caller and set `req.user = { sub }`.
 *
 * - With Auth0: verify the `Authorization: Bearer <access token>` JWT (signature via
 *   Auth0's public keys, issuer, audience, expiry). Missing or invalid tokens get 401.
 * - Without Auth0 (only allowed outside production, see config/env.js): the dev user.
 *
 * `config` is passed to express-oauth2-jwt-bearer; tests use a shared secret instead of
 * Auth0's keys so they can sign their own tokens.
 */
export function createAuthenticate(config) {
  if (!config) return [devUser];

  return [
    auth(config),
    (req, res, next) => {
      req.user = { sub: req.auth.payload.sub };
      next();
    },
  ];
}

/** Saves a User record the first time someone signs in. Runs after the DB check. */
export function createSyncUser(config) {
  if (!config) return [];

  const issuer = config.issuerBaseURL ?? config.issuer;
  return [
    async (req, res, next) => {
      await ensureUser({ sub: req.user.sub, issuer, accessToken: req.auth.token });
      next();
    },
  ];
}
