import { Response } from 'express';

/**
 * Parses a Cookie request header into a name/value map (duplicate names use last value).
 */
export const parseCookies = (
  header: string | string[] | undefined,
): Record<string, string> => {
  const cookies: Record<string, string> = {};

  if (header === undefined) {
    return cookies;
  }

  const raw = Array.isArray(header) ? header.join('; ') : header;

  for (const part of raw.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const name = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!name) {
      continue;
    }

    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }

  return cookies;
};

/**
 * Cookie names with these prefixes are silently rejected by spec-compliant
 * cookie jars (browsers, etc.) unless the Secure attribute is also set.
 * See RFC 6265bis section 4.1.3.
 */
const requiresSecureAttribute = (name: string): boolean =>
  name.startsWith('__Secure-') || name.startsWith('__Host-');

/**
 * Echoes parsed cookies back to the client via Set-Cookie response headers.
 */
export const applyEchoCookies = (res: Response, cookies: Record<string, string>): void => {
  for (const [name, value] of Object.entries(cookies)) {
    const attributes = requiresSecureAttribute(name) ? '; Path=/; Secure' : '; Path=/';
    res.append('Set-Cookie', `${name}=${value}${attributes}`);
  }
};
