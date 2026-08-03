import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_SSE_COUNT,
  MAX_SSE_INTERVAL_MS,
  formatSseComment,
  formatSseEvent,
  parseSseCountHeader,
  parseSseIntervalHeader,
  parseSseKeepaliveHeader,
} from './sse';

describe('parseSseCountHeader', () => {
  it('defaults to one when the header is absent', () => {
    assert.deepEqual(parseSseCountHeader(undefined), { ok: true, count: 1 });
  });

  it('accepts integer counts within the allowed range', () => {
    assert.deepEqual(parseSseCountHeader('1'), { ok: true, count: 1 });
    assert.deepEqual(parseSseCountHeader('10'), { ok: true, count: 10 });
    assert.deepEqual(parseSseCountHeader(String(MAX_SSE_COUNT)), {
      ok: true,
      count: MAX_SSE_COUNT,
    });
  });

  it('rejects zero, malformed, and excessive values', () => {
    assert.deepEqual(parseSseCountHeader('0'), { ok: false });
    assert.deepEqual(parseSseCountHeader(''), { ok: false });
    assert.deepEqual(parseSseCountHeader('1.5'), { ok: false });
    assert.deepEqual(parseSseCountHeader(String(MAX_SSE_COUNT + 1)), { ok: false });
  });
});

describe('parseSseIntervalHeader', () => {
  it('defaults to zero when the header is absent', () => {
    assert.deepEqual(parseSseIntervalHeader(undefined), { ok: true, intervalMs: 0 });
  });

  it('accepts integer intervals within the allowed range', () => {
    assert.deepEqual(parseSseIntervalHeader('0'), { ok: true, intervalMs: 0 });
    assert.deepEqual(parseSseIntervalHeader('250'), { ok: true, intervalMs: 250 });
    assert.deepEqual(parseSseIntervalHeader(String(MAX_SSE_INTERVAL_MS)), {
      ok: true,
      intervalMs: MAX_SSE_INTERVAL_MS,
    });
  });

  it('rejects malformed and excessive values', () => {
    assert.deepEqual(parseSseIntervalHeader(''), { ok: false });
    assert.deepEqual(parseSseIntervalHeader('1.5'), { ok: false });
    assert.deepEqual(parseSseIntervalHeader(String(MAX_SSE_INTERVAL_MS + 1)), { ok: false });
  });
});

describe('parseSseKeepaliveHeader', () => {
  it('defaults to disabled when the header is absent', () => {
    assert.deepEqual(parseSseKeepaliveHeader(undefined), { ok: true, enabled: false });
  });

  it('accepts 1 and true case-insensitively', () => {
    assert.deepEqual(parseSseKeepaliveHeader('1'), { ok: true, enabled: true });
    assert.deepEqual(parseSseKeepaliveHeader('true'), { ok: true, enabled: true });
    assert.deepEqual(parseSseKeepaliveHeader(' TRUE '), { ok: true, enabled: true });
  });

  it('rejects unsupported values', () => {
    assert.deepEqual(parseSseKeepaliveHeader('0'), { ok: false });
    assert.deepEqual(parseSseKeepaliveHeader('yes'), { ok: false });
    assert.deepEqual(parseSseKeepaliveHeader(''), { ok: false });
  });
});

describe('formatSseEvent', () => {
  it('formats id, event, and single-line data', () => {
    assert.equal(
      formatSseEvent({ id: 1, event: 'echo', data: '{"ok":true}' }),
      'id: 1\nevent: echo\ndata: {"ok":true}\n\n',
    );
  });

  it('splits multiline data across data: lines', () => {
    assert.equal(formatSseEvent({ data: 'line1\nline2' }), 'data: line1\ndata: line2\n\n');
  });
});

describe('formatSseComment', () => {
  it('formats a keepalive comment by default', () => {
    assert.equal(formatSseComment(), ': keepalive\n\n');
  });
});
