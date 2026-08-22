/**
 * Lightweight HTTP helpers built on the global `fetch` (Node 18+).
 */

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export interface RequestOptions {
  timeout?: number;
  headers?: Record<string, string>;
  userAgent?: string;
}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

async function request(
  url: string,
  init: RequestInit,
  options: RequestOptions = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = options.timeout ?? 15000;
  const timer = setTimeout(() => controller.abort(), timeout);

  const headers: Record<string, string> = {
    'User-Agent': options.userAgent ?? DEFAULT_USER_AGENT,
    ...options.headers,
  };

  try {
    return await fetch(url, { ...init, headers, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new HttpError(`Request timed out after ${timeout}ms`, undefined, undefined);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function get(url: string, options: RequestOptions = {}): Promise<string> {
  const res = await request(url, { method: 'GET' }, options);
  const text = await res.text();
  if (!res.ok) {
    throw new HttpError(`HTTP ${res.status}: ${text.slice(0, 500)}`, res.status, text);
  }
  return text;
}

/** POST url-encoded form data. */
export async function postForm(
  url: string,
  params: Record<string, string>,
  options: RequestOptions = {},
): Promise<string> {
  const body = new URLSearchParams(params).toString();
  const res = await request(
    url,
    {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    },
    options,
  );
  const text = await res.text();
  if (!res.ok) {
    throw new HttpError(`HTTP ${res.status}: ${text.slice(0, 500)}`, res.status, text);
  }
  return text;
}

/** POST JSON, returns the parsed response. */
export async function postJson<T>(
  url: string,
  body: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const res = await request(
    url,
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    },
    options,
  );
  const text = await res.text();
  if (!res.ok) {
    throw new HttpError(`HTTP ${res.status}: ${text.slice(0, 500)}`, res.status, text);
  }
  return JSON.parse(text) as T;
}
