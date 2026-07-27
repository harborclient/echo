import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAllowedRedirectUrl, parseRedirectHeader } from './redirect';

describe('isAllowedRedirectUrl', () => {
  it('allows https://echo.harborclient.com with any path or query', () => {
    assert.equal(isAllowedRedirectUrl('https://echo.harborclient.com'), true);
    assert.equal(isAllowedRedirectUrl('https://echo.harborclient.com/anything?foo=bar'), true);
  });

  it('allows localhost and 127.0.0.1 over http or https with any port', () => {
    assert.equal(isAllowedRedirectUrl('http://localhost:3000/get'), true);
    assert.equal(isAllowedRedirectUrl('https://localhost/path'), true);
    assert.equal(isAllowedRedirectUrl('https://127.0.0.1:3000/health'), true);
    assert.equal(isAllowedRedirectUrl('http://127.0.0.1/'), true);
  });

  it('rejects external hosts and http on the production host', () => {
    assert.equal(isAllowedRedirectUrl('https://example.com'), false);
    assert.equal(isAllowedRedirectUrl('http://echo.harborclient.com/path'), false);
    assert.equal(isAllowedRedirectUrl('https://echo.harborclient.com.evil.com'), false);
    // userinfo before @ is the username; hostname is evil.com
    assert.equal(isAllowedRedirectUrl('https://echo.harborclient.com@evil.com'), false);
  });
});

describe('parseRedirectHeader', () => {
  it('parses bare allowed URLs as 302', () => {
    assert.deepEqual(parseRedirectHeader('https://echo.harborclient.com/anything'), {
      status: 302,
      url: 'https://echo.harborclient.com/anything',
    });
  });

  it('parses explicit 301 and 302 status prefixes', () => {
    assert.deepEqual(parseRedirectHeader('301 https://echo.harborclient.com/path'), {
      status: 301,
      url: 'https://echo.harborclient.com/path',
    });
    assert.deepEqual(parseRedirectHeader('302 http://localhost:3000/get'), {
      status: 302,
      url: 'http://localhost:3000/get',
    });
  });

  it('rejects malformed values', () => {
    assert.equal(parseRedirectHeader(''), null);
    assert.equal(parseRedirectHeader('   '), null);
    assert.equal(parseRedirectHeader('not-a-url'), null);
    assert.equal(parseRedirectHeader('303 https://echo.harborclient.com'), null);
  });

  it('rejects disallowed destinations', () => {
    assert.equal(parseRedirectHeader('https://example.com'), null);
    assert.equal(parseRedirectHeader('301 https://example.com/path'), null);
    assert.equal(parseRedirectHeader('http://echo.harborclient.com'), null);
  });
});
