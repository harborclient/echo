export type RedirectTarget = { status: number; url: string };

const REDIRECT_STATUS_PATTERN = /^(301|302)\s+(\S+)$/;
const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Parses an x-redirect-to header value into a redirect status and URL.
 * Returns null when the value is malformed or the URL is invalid.
 */
export const parseRedirectHeader = (value: string): RedirectTarget | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const statusMatch = trimmed.match(REDIRECT_STATUS_PATTERN);
  if (statusMatch) {
    const url = statusMatch[2];
    if (!isValidUrl(url)) {
      return null;
    }
    return { status: Number(statusMatch[1]), url };
  }

  if (ABSOLUTE_URL_PATTERN.test(trimmed) && isValidUrl(trimmed)) {
    return { status: 302, url: trimmed };
  }

  return null;
};

export const INVALID_REDIRECT_HEADER_ERROR = {
  error: 'Invalid x-redirect-to header',
} as const;
