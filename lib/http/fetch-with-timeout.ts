export const DEFAULT_FETCH_TIMEOUT_MS = 8000;

export interface FetchWithTimeoutOptions {
  /** Per-attempt budget. A hung request is aborted once it elapses. */
  timeoutMs?: number;
  /**
   * Extra attempts after the first one. Only set this for idempotent requests —
   * a retried POST can create duplicate Discord messages or threads.
   */
  retries?: number;
  retryDelayMs?: number;
  /** Used in the thrown error so a failure is identifiable in the logs. */
  label?: string;
}

export class FetchTimeoutError extends Error {
  constructor(label: string, timeoutMs: number, attempts: number) {
    super(`${label} timed out after ${timeoutMs}ms (${attempts} attempt${attempts > 1 ? 's' : ''})`);
    this.name = 'FetchTimeoutError';
  }
}

function isTimeoutLike(error: unknown): boolean {
  const names = new Set<string | undefined>();
  let current: unknown = error;

  for (let depth = 0; depth < 3 && current; depth += 1) {
    names.add((current as { name?: string }).name);
    current = (current as { cause?: unknown }).cause;
  }

  return names.has('TimeoutError') || names.has('AbortError');
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * `fetch` with a hard per-attempt deadline.
 *
 * Without this a stalled upstream (Google Sheets, Discord) holds the request
 * open until the serverless function's own `maxDuration` kills the whole
 * invocation, taking every later step down with it.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  {
    timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
    retries = 0,
    retryDelayMs = 250,
    label = 'Request',
  }: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const attempts = retries + 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await delay(retryDelayMs);
      }
    }
  }

  if (isTimeoutLike(lastError)) {
    throw new FetchTimeoutError(label, timeoutMs, attempts);
  }

  throw new Error(`${label} failed: ${toMessage(lastError)}`, { cause: lastError });
}
