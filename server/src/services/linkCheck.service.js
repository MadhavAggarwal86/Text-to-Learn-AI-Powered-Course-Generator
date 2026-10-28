// AI models sometimes invent plausible-looking URLs. Before a lesson is saved, each resource
// gets a quick HEAD request and links that clearly don't exist are dropped.

const CHECK_TIMEOUT_MS = 4000;
const DEAD_STATUSES = new Set([404, 410]);

/** Only public https hosts are checked, so AI output can't make the server probe its own network. */
export function isCheckableUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const host = url.hostname;
  const isIpLiteral = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':');
  return (
    url.protocol === 'https:' &&
    host.includes('.') &&
    !isIpLiteral &&
    host !== 'localhost' &&
    !host.endsWith('.localhost') &&
    !host.endsWith('.local') &&
    !host.endsWith('.internal')
  );
}

/**
 * true  → the link works (or the site only blocks bots, e.g. 403: probably real).
 * false → the host doesn't resolve / refuses connections, or the page is 404/410.
 * A timeout counts as alive: slow sites shouldn't lose their links.
 */
export async function isLinkAlive(url) {
  if (!isCheckableUrl(url)) return false;

  const signal = AbortSignal.timeout(CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal,
      headers: { 'user-agent': 'Text-to-Learn link checker' },
    });
    return !DEAD_STATUSES.has(res.status);
  } catch {
    return signal.aborted;
  }
}

/** Keeps the resources whose links work; falls back to a Wikipedia search if none do. */
export async function verifyResources(resources, fallbackTopic) {
  const alive = await Promise.all(resources.map((resource) => isLinkAlive(resource.url)));
  const kept = resources.filter((_, i) => alive[i]);
  if (kept.length) return kept;

  return [
    {
      title: `Wikipedia: ${fallbackTopic}`,
      url: `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(fallbackTopic)}`,
    },
  ];
}
