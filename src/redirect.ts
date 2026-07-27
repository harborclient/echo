export type RedirectTarget = { status: number; url: string };

const REDIRECT_STATUS_PATTERN = /^(301|302)\s+(\S+)$/;
const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

const ALLOWED_PRODUCTION_HOST = 'echo.harborclient.com';
const ALLOWED_LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Returns whether a redirect URL is on the allowlist:
 * - https://echo.harborclient.com (any path/query)
 * - http(s)://localhost or http(s)://127.0.0.1 (any port/path)
 */
export const isAllowedRedirectUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const protocol = parsed.protocol.toLowerCase();

    if (hostname === ALLOWED_PRODUCTION_HOST) {
      return protocol === 'https:';
    }

    if (ALLOWED_LOCAL_HOSTS.has(hostname)) {
      return protocol === 'http:' || protocol === 'https:';
    }

    return false;
  } catch {
    return false;
  }
};

/**
 * Parses an x-echo-redirect header value into a redirect status and URL.
 * Returns null when the value is malformed, the URL is invalid, or the
 * destination is not on the allowlist.
 */
export const parseRedirectHeader = (value: string): RedirectTarget | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const statusMatch = trimmed.match(REDIRECT_STATUS_PATTERN);
  if (statusMatch) {
    const url = statusMatch[2];
    if (!isValidUrl(url) || !isAllowedRedirectUrl(url)) {
      return null;
    }
    return { status: Number(statusMatch[1]), url };
  }

  if (
    ABSOLUTE_URL_PATTERN.test(trimmed) &&
    isValidUrl(trimmed) &&
    isAllowedRedirectUrl(trimmed)
  ) {
    return { status: 302, url: trimmed };
  }

  return null;
};

export const INVALID_REDIRECT_HEADER_ERROR = {
  error: 'Invalid x-echo-redirect header',
} as const;
