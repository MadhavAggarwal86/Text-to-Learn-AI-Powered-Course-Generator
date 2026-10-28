import { afterEach, describe, expect, it, vi } from 'vitest';
import { isCheckableUrl, isLinkAlive, verifyResources } from '../src/services/linkCheck.service.js';

const respondWith = (status) => vi.fn(async () => new Response(null, { status }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isCheckableUrl', () => {
  it.each([
    ['https://react.dev/learn', true],
    ['http://example.com', false], // https only
    ['https://localhost/admin', false],
    ['https://127.0.0.1/', false],
    ['https://[::1]/', false],
    ['https://metadata.google.internal/', false],
    ['https://intranet/', false], // no dot: not a public hostname
    ['not a url', false],
  ])('%s -> %s', (url, expected) => {
    expect(isCheckableUrl(url)).toBe(expected);
  });
});

describe('isLinkAlive', () => {
  it.each([
    [200, true],
    [403, true], // bot protection: the page probably exists
    [405, true],
    [404, false],
    [410, false],
  ])('HTTP %i -> %s', async (status, expected) => {
    vi.stubGlobal('fetch', respondWith(status));

    expect(await isLinkAlive('https://example.com/page')).toBe(expected);
  });

  it('treats a host that does not resolve as dead', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );

    expect(await isLinkAlive('https://www.khanaccess.org')).toBe(false);
  });

  it('never makes a request for an uncheckable URL', async () => {
    const fetch = respondWith(200);
    vi.stubGlobal('fetch', fetch);

    expect(await isLinkAlive('https://localhost/secret')).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('verifyResources', () => {
  const resources = [
    { title: 'Real', url: 'https://react.dev/learn' },
    { title: 'Invented', url: 'https://react.dev/made-up-page' },
  ];

  it('drops dead links and keeps the rest', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => new Response(null, { status: url.includes('made-up') ? 404 : 200 })),
    );

    expect(await verifyResources(resources, 'React')).toEqual([resources[0]]);
  });

  it('falls back to a Wikipedia search when every link is dead', async () => {
    vi.stubGlobal('fetch', respondWith(404));

    expect(await verifyResources(resources, 'React hooks & state')).toEqual([
      {
        title: 'Wikipedia: React hooks & state',
        url: 'https://en.wikipedia.org/w/index.php?search=React%20hooks%20%26%20state',
      },
    ]);
  });
});
