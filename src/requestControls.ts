/**
 * Maximum allowed value for the `x-echo-delay-ms` header (10 seconds).
 */
export const MAX_DELAY_MS = 10_000;

/**
 * Error body returned when `x-echo-strict` has an unsupported value.
 */
export const INVALID_STRICT_HEADER_ERROR = {
  error: 'Invalid x-echo-strict header',
} as const;

/**
 * Error body returned when `x-echo-delay-ms` is malformed or out of range.
 */
export const INVALID_DELAY_HEADER_ERROR = {
  error: 'Invalid x-echo-delay-ms header',
} as const;

/**
 * Error body returned when strict JSON mode rejects the request Content-Type.
 */
export const UNSUPPORTED_MEDIA_TYPE_ERROR = {
  error: 'Unsupported Media Type',
} as const;

/**
 * Result of parsing an optional `x-echo-strict` header.
 */
export type StrictMode = 'json' | null;

/**
 * Result of parsing the `x-echo-delay-ms` header.
 * `ok: false` means the header was present but invalid.
 */
export type DelayParseResult = { ok: true; delayMs: number } | { ok: false };

/**
 * Parses an `x-echo-strict` header value.
 * Returns `'json'` for the supported mode, `null` when the header is absent,
 * and `undefined` when the value is present but unsupported.
 *
 * @param value - Raw header value, or `undefined` when the header is absent.
 * @returns Parsed strict mode, `null` when absent, or `undefined` when invalid.
 */
export const parseStrictHeader = (value: string | undefined): StrictMode | undefined => {
  if (value === undefined) {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (trimmed === 'json') {
    return 'json';
  }

  return undefined;
};

/**
 * Returns whether a Content-Type is acceptable under strict JSON mode.
 * Accepts `application/json` and `+json` subtypes (e.g. `application/ld+json`),
 * ignoring parameters such as `charset`.
 *
 * @param contentType - Raw Content-Type header value.
 * @returns `true` when the media type is JSON-compatible.
 */
export const isJsonCompatibleContentType = (contentType: string | undefined): boolean => {
  if (!contentType) {
    return false;
  }

  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return mediaType === 'application/json' || mediaType.endsWith('+json');
};

/**
 * Parses an `x-echo-delay-ms` header into an integer delay in milliseconds.
 * Absent headers resolve to `0`. Values must be whole numbers in `[0, MAX_DELAY_MS]`.
 *
 * @param value - Raw header value, or `undefined` when the header is absent.
 * @returns Parsed delay, or `{ ok: false }` when the value is invalid.
 */
export const parseDelayHeader = (value: string | undefined): DelayParseResult => {
  if (value === undefined) {
    return { ok: true, delayMs: 0 };
  }

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false };
  }

  const delayMs = Number(trimmed);
  if (!Number.isSafeInteger(delayMs) || delayMs < 0 || delayMs > MAX_DELAY_MS) {
    return { ok: false };
  }

  return { ok: true, delayMs };
};

/**
 * Sleeps for the given number of milliseconds.
 *
 * @param delayMs - Duration to wait; no-op when `0`.
 */
export const sleep = (delayMs: number): Promise<void> => {
  if (delayMs <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
};
