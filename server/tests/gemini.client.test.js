import { describe, expect, it } from 'vitest';
import { classifyError, GeminiError } from '../src/services/gemini.client.js';

const httpError = (status, message = 'error') => Object.assign(new Error(message), { status });

describe('classifyError', () => {
  it.each([
    [httpError(429), 'rate_limited', true],
    [httpError(503), 'unavailable', true],
    [httpError(500), 'unavailable', true],
    [new TypeError('fetch failed'), 'unavailable', true],
    [httpError(400, 'API key not valid. Please pass a valid API key.'), 'config', false],
    [httpError(404, 'models/gemini-x is not found'), 'config', false],
    [httpError(400, 'Request contains an invalid argument.'), 'request', false],
  ])('%s -> %s', (err, kind, transient) => {
    const classified = classifyError(err);

    expect(classified).toBeInstanceOf(GeminiError);
    expect(classified.kind).toBe(kind);
    expect(classified.transient).toBe(transient);
  });

  it('reports an aborted request as a timeout', () => {
    expect(classifyError(new Error('This operation was aborted'), { timedOut: true }).kind).toBe(
      'timeout',
    );
  });
});
