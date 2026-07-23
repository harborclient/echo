import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { AddressInfo } from 'node:net';
import { createApp } from './app';
import {
  INVALID_DELAY_HEADER_ERROR,
  INVALID_STRICT_HEADER_ERROR,
  UNSUPPORTED_MEDIA_TYPE_ERROR,
} from './requestControls';

interface HttpResult {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
  json: unknown;
}

/**
 * Issues an HTTP request against the local test server.
 *
 * @param port - Listening port for the test server.
 * @param method - HTTP method.
 * @param path - Request path including query string.
 * @param options - Optional headers and body.
 * @returns Parsed status, headers, raw body, and JSON when applicable.
 */
const request = async (
  port: number,
  method: string,
  path: string,
  options: { headers?: Record<string, string>; body?: string | Buffer } = {},
): Promise<HttpResult> => {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        method,
        path,
        headers: options.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          let json: unknown = null;
          if (body) {
            try {
              json = JSON.parse(body);
            } catch {
              // Leave json as null when the body is not valid JSON.
            }
          }
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body,
            json,
          });
        });
      },
    );

    req.on('error', reject);

    if (options.body !== undefined) {
      req.write(options.body);
    }
    req.end();
  });
};

/**
 * Builds a multipart/form-data body with one text field and one file part.
 *
 * @param boundary - Multipart boundary token.
 * @returns Encoded body buffer and Content-Type header value.
 */
const buildMultipartBody = (boundary: string): { body: Buffer; contentType: string } => {
  const parts = [
    `--${boundary}\r\n` + 'Content-Disposition: form-data; name="note"\r\n' + '\r\n' + 'hello\r\n',
    `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="avatar"; filename="avatar.txt"\r\n' +
      'Content-Type: text/plain\r\n' +
      '\r\n' +
      'file-bytes\r\n',
    `--${boundary}--\r\n`,
  ];

  return {
    body: Buffer.from(parts.join(''), 'utf8'),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
};

describe('echo app quiz scenarios', () => {
  let server: http.Server;
  let port: number;

  before(async () => {
    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    port = (server.address() as AddressInfo).port;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  it('keeps /health unaffected by control headers', async () => {
    const result = await request(port, 'GET', '/health', {
      headers: {
        'x-echo-strict': 'json',
        'x-echo-delay-ms': '5000',
      },
    });

    assert.equal(result.status, 200);
    assert.deepEqual(result.json, { status: 'ok' });
  });

  it('returns 415 in strict JSON mode for mismatched Content-Type', async () => {
    const result = await request(port, 'POST', '/post', {
      headers: {
        'content-type': 'text/plain',
        'x-echo-strict': 'json',
      },
      body: '{"foo":"bar"}',
    });

    assert.equal(result.status, 415);
    assert.deepEqual(result.json, UNSUPPORTED_MEDIA_TYPE_ERROR);
  });

  it('echoes the body when strict JSON mode receives application/json', async () => {
    const result = await request(port, 'POST', '/post', {
      headers: {
        'content-type': 'application/json',
        'x-echo-strict': 'json',
      },
      body: '{"foo":"bar"}',
    });

    assert.equal(result.status, 200);
    assert.equal(typeof result.json, 'object');
    assert.ok(result.json && typeof result.json === 'object');
    const echo = result.json as { json: unknown; data: string };
    assert.deepEqual(echo.json, { foo: 'bar' });
    assert.equal(echo.data, '{"foo":"bar"}');
  });

  it('rejects unsupported x-echo-strict values with 400', async () => {
    const result = await request(port, 'POST', '/post', {
      headers: {
        'content-type': 'application/json',
        'x-echo-strict': 'xml',
      },
      body: '{}',
    });

    assert.equal(result.status, 400);
    assert.deepEqual(result.json, INVALID_STRICT_HEADER_ERROR);
  });

  it('rejects invalid and excessive x-echo-delay-ms values with 400', async () => {
    const invalid = await request(port, 'GET', '/get', {
      headers: { 'x-echo-delay-ms': '1.5' },
    });
    assert.equal(invalid.status, 400);
    assert.deepEqual(invalid.json, INVALID_DELAY_HEADER_ERROR);

    const excessive = await request(port, 'GET', '/get', {
      headers: { 'x-echo-delay-ms': '10001' },
    });
    assert.equal(excessive.status, 400);
    assert.deepEqual(excessive.json, INVALID_DELAY_HEADER_ERROR);
  });

  it('delays the response when x-echo-delay-ms is set', async () => {
    const started = Date.now();
    const result = await request(port, 'GET', '/get', {
      headers: { 'x-echo-delay-ms': '200' },
    });
    const elapsed = Date.now() - started;

    assert.equal(result.status, 200);
    assert.ok(elapsed >= 180, `expected at least ~200ms delay, got ${elapsed}ms`);
  });

  it('echoes multipart form fields and uploaded filenames', async () => {
    const boundary = '----HarborEchoBoundary7MA4YWxk';
    const { body, contentType } = buildMultipartBody(boundary);

    const result = await request(port, 'POST', '/upload', {
      headers: {
        'content-type': contentType,
        'content-length': String(body.length),
      },
      body,
    });

    assert.equal(result.status, 200);
    assert.ok(result.json && typeof result.json === 'object');
    const echo = result.json as {
      form: Record<string, string>;
      files: Record<string, string>;
    };
    assert.deepEqual(echo.form, { note: 'hello' });
    assert.deepEqual(echo.files, { avatar: 'avatar.txt' });
  });
});
