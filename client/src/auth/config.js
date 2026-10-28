// Auth0 settings (public by design: they identify the app, they are not secrets).
// When they are missing the app runs in local dev mode as a single user, matching the API,
// which does the same when its own Auth0 settings are missing (it refuses in production).
export const auth0Config = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN ?? '',
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID ?? '',
  audience: import.meta.env.VITE_AUTH0_AUDIENCE ?? '',
};

export const authEnabled = Boolean(
  auth0Config.domain && auth0Config.clientId && auth0Config.audience,
);
