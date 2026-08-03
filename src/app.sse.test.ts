import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { AddressInfo } from 'node:net';
import { createApp } from './app';
import { INVALID_DELAY_HEADER_ERROR } from './requestControls';
import {
  INVALID_SSE_COUNT_ERROR,
  INVALID_SSE_INTERVAL_ERROR,
  INVALID_SSE_KEEPALIVE_ERROR,
} from './sse';
import { EchoResponse } from './types';

interface HttpResult {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

/**
 * Issues an HTTP request against the local test server and collects the full body.
 */
const request = async (
  port: number,
  method: string,
  path: string,
  options: { headers?: Record<string, string>; body?: string } = {},
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
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
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
 * Parses SSE `data:` lines from a stream body into JSON objects.
 */
const parseEchoEvents = (body: string): EchoResponse[] => {
  const events: EchoResponse[] = [];
  const blocks = body.split('\n\n').filter((block) => block.trim().length > 0);

  for (const block of blocks) {
    if (block.startsWith(':')) {
      continue;
    }

    const dataLines = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trimStart());

    if (dataLines.length === 0) {
      continue;
    }

    events.push(JSON.parse(dataLines.join('\n')) as EchoResponse);
  }

  return events;
};

describe('SSE /sse endpoint', () => {
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

  it('streams a single echo event by default', async () => {
    const result = await request(port, 'GET', '/sse?hello=world');

    assert.equal(result.status, 200);
    assert.match(String(result.headers['content-type']), /text\/event-stream/);
    assert.equal(result.headers['cache-control'], 'no-cache, no-transform');
    assert.equal(result.headers['x-accel-buffering'], 'no');

    assert.match(result.body, /^id: 1\nevent: echo\ndata: /);
    const events = parseEchoEvents(result.body);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.args.hello, 'world');
    assert.match(events[0]?.url ?? '', /\/sse\?hello=world$/);
  });

  it('echoes a POST body inside the SSE payload', async () => {
    const result = await request(port, 'POST', '/sse', {
      headers: { 'content-type': 'application/json' },
      body: '{"foo":"bar"}',
    });

    assert.equal(result.status, 200);
    const events = parseEchoEvents(result.body);
    assert.equal(events.length, 1);
    assert.deepEqual(events[0]?.json, { foo: 'bar' });
    assert.equal(events[0]?.data, '{"foo":"bar"}');
  });

  it('emits multiple timed events when count and interval are set', async () => {
    const started = Date.now();
    const result = await request(port, 'GET', '/sse', {
      headers: {
        'x-echo-sse-count': '3',
        'x-echo-sse-interval-ms': '50',
      },
    });
    const elapsed = Date.now() - started;

    assert.equal(result.status, 200);
    assert.equal(parseEchoEvents(result.body).length, 3);
    assert.match(result.body, /id: 1[\s\S]*id: 2[\s\S]*id: 3/);
    assert.ok(elapsed >= 90, `expected ~100ms between three events, got ${elapsed}ms`);
  });

  it('emits keepalive comments when enabled', async () => {
    const result = await request(port, 'GET', '/sse', {
      headers: {
        'x-echo-sse-count': '2',
        'x-echo-sse-keepalive': 'true',
      },
    });

    assert.equal(result.status, 200);
    assert.match(result.body, /: keepalive\n\n/);
    assert.equal(parseEchoEvents(result.body).length, 2);
  });

  it('rejects invalid SSE control values with 400', async () => {
    const count = await request(port, 'GET', '/sse', {
      headers: { 'x-echo-sse-count': '0' },
    });
    assert.equal(count.status, 400);
    assert.deepEqual(JSON.parse(count.body), INVALID_SSE_COUNT_ERROR);

    const interval = await request(port, 'GET', '/sse', {
      headers: { 'x-echo-sse-interval-ms': '10001' },
    });
    assert.equal(interval.status, 400);
    assert.deepEqual(JSON.parse(interval.body), INVALID_SSE_INTERVAL_ERROR);

    const keepalive = await request(port, 'GET', '/sse', {
      headers: { 'x-echo-sse-keepalive': 'yes' },
    });
    assert.equal(keepalive.status, 400);
    assert.deepEqual(JSON.parse(keepalive.body), INVALID_SSE_KEEPALIVE_ERROR);

    const delay = await request(port, 'GET', '/sse', {
      headers: { 'x-echo-delay-ms': 'abc' },
    });
    assert.equal(delay.status, 400);
    assert.deepEqual(JSON.parse(delay.body), INVALID_DELAY_HEADER_ERROR);
  });

  it('supports SSE controls via query params', async () => {
    const result = await request(port, 'GET', '/sse?x-echo-sse-count=2&x-echo-sse-keepalive=1');

    assert.equal(result.status, 200);
    assert.equal(parseEchoEvents(result.body).length, 2);
    assert.match(result.body, /: keepalive\n\n/);
  });

  it('does not treat /sse as a JSON echo path', async () => {
    const result = await request(port, 'GET', '/sse');

    assert.equal(result.status, 200);
    assert.match(String(result.headers['content-type']), /text\/event-stream/);
    assert.doesNotMatch(String(result.headers['content-type']), /application\/json/);
  });
});
