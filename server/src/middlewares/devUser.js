// TEMPORARY until Auth0 (Phase 6): every request acts as a fixed local user so the API
// can be built and tested end to end. Phase 6 replaces this with token verification that
// sets the same `req.user = { sub }`, so controllers do not change.
//
// The `x-dev-user` header lets tests (and you, with curl) act as a different user to
// check that one user's courses are invisible to another.

export const DEV_USER_SUB = 'dev|local-user';

export function devUser(req, res, next) {
  req.user = { sub: req.get('x-dev-user') || DEV_USER_SUB };
  next();
}
