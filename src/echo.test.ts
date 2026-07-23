import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getQueryParam, normalizeQuery } from './echo';

describe('getQueryParam', () => {
  it('returns undefined when the key is absent', () => {
    assert.equal(getQueryParam({}, 'x-echo-delay-ms'), undefined);
  });

  it('returns a string value', () => {
    assert.equal(getQueryParam({ 'x-echo-delay-ms': '4000' }, 'x-echo-delay-ms'), '4000');
  });

  it('uses the last value when the key is duplicated', () => {
    assert.equal(getQueryParam({ 'x-echo-strict': ['xml', 'json'] }, 'x-echo-strict'), 'json');
  });

  it('returns undefined when an array has no trailing string', () => {
    assert.equal(getQueryParam({ nested: [{ a: '1' }] }, 'nested'), undefined);
  });

  it('stringifies nested object values', () => {
    assert.equal(getQueryParam({ nested: { a: '1' } }, 'nested'), '[object Object]');
  });
});

describe('normalizeQuery', () => {
  it('flattens string params and prefers the last duplicate', () => {
    assert.deepEqual(
      normalizeQuery({
        a: '1',
        b: ['first', 'last'],
      }),
      { a: '1', b: 'last' },
    );
  });
});
