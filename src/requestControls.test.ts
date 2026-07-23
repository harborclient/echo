import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_DELAY_MS,
  isJsonCompatibleContentType,
  parseDelayHeader,
  parseStrictHeader,
} from './requestControls';

describe('parseStrictHeader', () => {
  it('returns null when the header is absent', () => {
    assert.equal(parseStrictHeader(undefined), null);
  });

  it('accepts json case-insensitively with surrounding whitespace', () => {
    assert.equal(parseStrictHeader(' json '), 'json');
    assert.equal(parseStrictHeader('JSON'), 'json');
  });

  it('rejects unsupported values', () => {
    assert.equal(parseStrictHeader('xml'), undefined);
    assert.equal(parseStrictHeader(''), undefined);
  });
});

describe('isJsonCompatibleContentType', () => {
  it('accepts application/json with optional parameters', () => {
    assert.equal(isJsonCompatibleContentType('application/json'), true);
    assert.equal(isJsonCompatibleContentType('application/json; charset=utf-8'), true);
  });

  it('accepts +json structured subtypes', () => {
    assert.equal(isJsonCompatibleContentType('application/ld+json'), true);
  });

  it('rejects non-JSON media types and missing values', () => {
    assert.equal(isJsonCompatibleContentType('text/plain'), false);
    assert.equal(isJsonCompatibleContentType('multipart/form-data'), false);
    assert.equal(isJsonCompatibleContentType(undefined), false);
    assert.equal(isJsonCompatibleContentType(''), false);
  });
});

describe('parseDelayHeader', () => {
  it('defaults to zero when the header is absent', () => {
    assert.deepEqual(parseDelayHeader(undefined), { ok: true, delayMs: 0 });
  });

  it('accepts integer delays within the allowed range', () => {
    assert.deepEqual(parseDelayHeader('0'), { ok: true, delayMs: 0 });
    assert.deepEqual(parseDelayHeader('5000'), { ok: true, delayMs: 5000 });
    assert.deepEqual(parseDelayHeader(String(MAX_DELAY_MS)), {
      ok: true,
      delayMs: MAX_DELAY_MS,
    });
  });

  it('rejects malformed, fractional, negative, and excessive values', () => {
    assert.deepEqual(parseDelayHeader(''), { ok: false });
    assert.deepEqual(parseDelayHeader('1.5'), { ok: false });
    assert.deepEqual(parseDelayHeader('-1'), { ok: false });
    assert.deepEqual(parseDelayHeader('10001'), { ok: false });
    assert.deepEqual(parseDelayHeader('abc'), { ok: false });
  });
});
