import { request, type ClientRequest, type IncomingMessage } from 'node:http';

const TARGET = 'http://127.0.0.1:3001';
const LITERAL_TARGET = /^http:\/\/127\.0\.0\.1:3001(?=\/|\?|$)/;
const ROUTES = new Set(['/auth/login', '/auth/callback', '/auth/logout', '/auth/logout-all', '/api/review/session']);
const LOGOUT_ROUTES = new Set(['/auth/logout', '/auth/logout-all']);
const ALLOWED_HEADERS = new Set(['host', 'cookie', 'accept', 'origin', 'content-type']);
const MAX_REQUEST_BYTES = 2048;
const MAX_RESPONSE_BYTES = 64000;
const TIMEOUT_MS = 10_000;
const FAILURE = 'Private identity request unavailable.';

type SelectedHeaders = Record<string, string>;

function unavailable(): TypeError {
  return new TypeError(FAILURE);
}

function canonicalHost(value: string | undefined): value is string {
  if (!value || value.length > 255 || /[\r\n\x00-\x20\x7f]/.test(value)) return false;
  const ipv6 = /^\[[0-9A-Fa-f:.]+\](?::([0-9]{1,5}))?$/.exec(value);
  const name = /^([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*)(?::([0-9]{1,5}))?$/.exec(value);
  if (!ipv6 && !name) return false;
  const port = ipv6?.[1] || name?.[2];
  return !port || (Number(port) > 0 && Number(port) <= 65535);
}

function target(input: string): URL {
  if (typeof input !== 'string') throw unavailable();
  let url: URL;
  try { url = new URL(input); } catch { throw unavailable(); }
  if (!LITERAL_TARGET.test(input) || url.origin !== TARGET || url.username || url.password || url.hash || !ROUTES.has(url.pathname)) throw unavailable();
  return url;
}

function selectHeaders(input: HeadersInit | undefined): SelectedHeaders {
  let source: Headers;
  try { source = new Headers(input); } catch { throw unavailable(); }
  const headers: SelectedHeaders = {};
  for (const [name, value] of source) {
    if (!ALLOWED_HEADERS.has(name)) throw unavailable();
    headers[name] = value;
  }
  if (!canonicalHost(headers.host)) throw unavailable();
  return headers;
}

async function requestBody(body: RequestInit['body']): Promise<Buffer | undefined> {
  if (body === undefined || body === null) return undefined;
  let value: Buffer;
  if (typeof body === 'string') value = Buffer.from(body);
  else if (body instanceof URLSearchParams) value = Buffer.from(body.toString());
  else if (body instanceof ArrayBuffer) value = Buffer.from(body);
  else if (ArrayBuffer.isView(body)) value = Buffer.from(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
  else if (typeof Blob !== 'undefined' && body instanceof Blob) {
    if (body.size > MAX_REQUEST_BYTES) throw unavailable();
    value = Buffer.from(await body.arrayBuffer());
  } else throw unavailable();
  if (value.length > MAX_REQUEST_BYTES) throw unavailable();
  return value;
}

function responseHeaders(response: IncomingMessage): Headers {
  const headers = new Headers();
  for (let index = 0; index < response.rawHeaders.length; index += 2) {
    headers.append(response.rawHeaders[index], response.rawHeaders[index + 1]);
  }
  return headers;
}

function declaredResponseTooLarge(response: IncomingMessage): boolean {
  const value = response.headers['content-length'];
  const length = Array.isArray(value) ? value[0] : value;
  return typeof length === 'string' && /^\d+$/.test(length) && Number(length) > MAX_RESPONSE_BYTES;
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

function send(url: URL, method: 'GET' | 'POST', headers: SelectedHeaders, body: Buffer | undefined,
  signal: AbortSignal | null | undefined, redirect: RequestRedirect | undefined): Promise<Response> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let client: ClientRequest;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      callback();
    };
    const fail = () => finish(() => reject(unavailable()));
    const abort = () => {
      client.destroy();
      fail();
    };

    try {
      client = request({
        protocol: 'http:',
        hostname: '127.0.0.1',
        port: 3001,
        method,
        path: url.pathname + url.search,
        headers,
        agent: false,
      }, response => {
        const status = response.statusCode || 0;
        if (redirect === 'error' && isRedirect(status)) {
          response.destroy();
          fail();
          return;
        }
        if (declaredResponseTooLarge(response)) {
          response.destroy();
          fail();
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', chunk => {
          if (settled) return;
          const part = Buffer.from(chunk);
          size += part.length;
          if (size > MAX_RESPONSE_BYTES) {
            response.destroy();
            fail();
            return;
          }
          chunks.push(part);
        });
        response.once('error', fail);
        response.once('end', () => {
          if (settled) return;
          try {
            if (status < 200 || status > 599) throw unavailable();
            const emptyStatus = status === 204 || status === 205 || status === 304;
            const payload = emptyStatus ? null : Buffer.concat(chunks);
            const result = new Response(payload, { status, headers: responseHeaders(response) });
            finish(() => resolve(result));
          } catch { fail(); }
        });
      });
      client.once('error', fail);
      timer = setTimeout(abort, TIMEOUT_MS);
      if (signal?.aborted) {
        abort();
        return;
      }
      signal?.addEventListener('abort', abort, { once: true });
      if (!settled) client.end(body);
    } catch { fail(); }
  });
}

/**
 * Private, loopback-only transport for the isolated identity authority.
 * It deliberately never follows redirects and never exposes transport errors.
 */
export async function fetchPrivateIdentity(input: string, init: RequestInit = {}): Promise<Response> {
  try {
    if (!init || typeof init !== 'object' || init.signal?.aborted) throw unavailable();
    const url = target(input);
    if (init.method !== undefined && typeof init.method !== 'string') throw unavailable();
    const normalizedMethod = (init.method || 'GET').toUpperCase();
    if (normalizedMethod !== 'GET' && normalizedMethod !== 'POST') throw unavailable();
    const method = normalizedMethod as 'GET' | 'POST';
    if (method === 'POST' && !LOGOUT_ROUTES.has(url.pathname)) throw unavailable();
    if (method === 'GET' && init.body !== undefined && init.body !== null) throw unavailable();
    const headers = selectHeaders(init.headers);
    const body = await requestBody(init.body);
    return await send(url, method, headers, body, init.signal, init.redirect);
  } catch { throw unavailable(); }
}
