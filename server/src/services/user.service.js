import { User } from '../models/index.js';

const USERINFO_TIMEOUT_MS = 5000;

// Users already saved since this process started; their requests skip the database.
const knownUsers = new Set();

/** Name/email/picture from Auth0's /userinfo endpoint, or {} if it can't be reached. */
async function fetchUserInfo(issuer, accessToken) {
  try {
    const res = await fetch(new URL('userinfo', issuer), {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(USERINFO_TIMEOUT_MS),
    });
    if (!res.ok) return {};
    const { email, name, picture } = await res.json();
    return { email, name, picture };
  } catch {
    return {};
  }
}

/**
 * Makes sure a User document exists for this Auth0 account. The profile is fetched once,
 * on the first request; access tokens only carry the user id (`sub`).
 */
export async function ensureUser({ sub, issuer, accessToken }) {
  if (knownUsers.has(sub)) return;

  if (!(await User.exists({ sub }))) {
    const profile = await fetchUserInfo(issuer, accessToken);
    // $setOnInsert: if two first requests race, the second changes nothing.
    await User.updateOne({ sub }, { $setOnInsert: { sub, ...profile } }, { upsert: true });
  }
  knownUsers.add(sub);
}

/** Test helper: forget which users have been seen. */
export function resetKnownUsers() {
  knownUsers.clear();
}
