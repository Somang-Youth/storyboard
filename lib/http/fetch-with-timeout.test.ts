import { afterEach, expect, test, vi } from 'vitest';

import { FetchTimeoutError, fetchWithTimeout } from '@/lib/http/fetch-with-timeout';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function timeoutError(): Error {
  const error = new Error('The operation was aborted due to timeout');
  error.name = 'TimeoutError';
  return error;
}

test('passes an abort signal so a hung upstream cannot outlive the budget', async () => {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    return new Response('ok');
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  const response = await fetchWithTimeout('https://example.test');

  expect(response.status).toBe(200);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('reports a timeout with the caller label instead of a bare abort', async () => {
  globalThis.fetch = vi.fn(async () => {
    throw timeoutError();
  }) as unknown as typeof fetch;

  await expect(
    fetchWithTimeout('https://example.test', {}, { timeoutMs: 1234, label: 'Sheet options read' }),
  ).rejects.toThrow(/Sheet options read timed out after 1234ms/);

  await expect(
    fetchWithTimeout('https://example.test', {}, { label: 'Sheet options read' }),
  ).rejects.toBeInstanceOf(FetchTimeoutError);
});

test('detects a timeout wrapped as an error cause', async () => {
  globalThis.fetch = vi.fn(async () => {
    throw new TypeError('fetch failed', { cause: timeoutError() });
  }) as unknown as typeof fetch;

  await expect(fetchWithTimeout('https://example.test', {}, { label: 'Wrapped' })).rejects.toBeInstanceOf(
    FetchTimeoutError,
  );
});

test('retries only as many times as the caller opted into', async () => {
  const fetchMock = vi.fn(async () => {
    throw timeoutError();
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  await expect(
    fetchWithTimeout('https://example.test', {}, { retries: 2, retryDelayMs: 0, label: 'Read' }),
  ).rejects.toThrow(/3 attempts/);
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

test('does not retry by default, so writes stay single-shot', async () => {
  const fetchMock = vi.fn(async () => {
    throw timeoutError();
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  await expect(fetchWithTimeout('https://example.test')).rejects.toBeInstanceOf(FetchTimeoutError);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('returns the first successful attempt after a transient failure', async () => {
  let calls = 0;
  globalThis.fetch = vi.fn(async () => {
    calls += 1;
    if (calls === 1) throw timeoutError();
    return new Response('recovered');
  }) as unknown as typeof fetch;

  const response = await fetchWithTimeout('https://example.test', {}, { retries: 1, retryDelayMs: 0 });

  expect(await response.text()).toBe('recovered');
  expect(calls).toBe(2);
});

test('surfaces non-timeout network failures with the label attached', async () => {
  globalThis.fetch = vi.fn(async () => {
    throw new Error('ECONNREFUSED');
  }) as unknown as typeof fetch;

  await expect(fetchWithTimeout('https://example.test', {}, { label: 'Discord call' })).rejects.toThrow(
    'Discord call failed: ECONNREFUSED',
  );
});
