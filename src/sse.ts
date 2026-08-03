/**
 * Maximum number of SSE echo events a single `/sse` request may emit.
 */
export const MAX_SSE_COUNT = 100;

/**
 * Maximum allowed value for `x-echo-sse-interval-ms` (10 seconds).
 */
export const MAX_SSE_INTERVAL_MS = 10_000;

/**
 * Error body returned when `x-echo-sse-count` is malformed or out of range.
 */
export const INVALID_SSE_COUNT_ERROR = {
  error: 'Invalid x-echo-sse-count header',
} as const;

/**
 * Error body returned when `x-echo-sse-interval-ms` is malformed or out of range.
 */
export const INVALID_SSE_INTERVAL_ERROR = {
  error: 'Invalid x-echo-sse-interval-ms header',
} as const;

/**
 * Error body returned when `x-echo-sse-keepalive` has an unsupported value.
 */
export const INVALID_SSE_KEEPALIVE_ERROR = {
  error: 'Invalid x-echo-sse-keepalive header',
} as const;

/**
 * Result of parsing `x-echo-sse-count`.
 * `ok: false` means the header was present but invalid.
 */
export type SseCountParseResult = { ok: true; count: number } | { ok: false };

/**
 * Result of parsing `x-echo-sse-interval-ms`.
 * `ok: false` means the header was present but invalid.
 */
export type SseIntervalParseResult = { ok: true; intervalMs: number } | { ok: false };

/**
 * Result of parsing `x-echo-sse-keepalive`.
 * `ok: false` means the header was present but invalid.
 */
export type SseKeepaliveParseResult = { ok: true; enabled: boolean } | { ok: false };

/**
 * Parses an `x-echo-sse-count` header into an integer event count.
 * Absent headers resolve to `1`. Values must be whole numbers in `[1, MAX_SSE_COUNT]`.
 *
 * @param value - Raw header value, or `undefined` when the header is absent.
 * @returns Parsed count, or `{ ok: false }` when the value is invalid.
 */
export const parseSseCountHeader = (value: string | undefined): SseCountParseResult => {
  if (value === undefined) {
    return { ok: true, count: 1 };
  }

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false };
  }

  const count = Number(trimmed);
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_SSE_COUNT) {
    return { ok: false };
  }

  return { ok: true, count };
};

/**
 * Parses an `x-echo-sse-interval-ms` header into an integer delay between events.
 * Absent headers resolve to `0`. Values must be whole numbers in `[0, MAX_SSE_INTERVAL_MS]`.
 *
 * @param value - Raw header value, or `undefined` when the header is absent.
 * @returns Parsed interval, or `{ ok: false }` when the value is invalid.
 */
export const parseSseIntervalHeader = (value: string | undefined): SseIntervalParseResult => {
  if (value === undefined) {
    return { ok: true, intervalMs: 0 };
  }

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false };
  }

  const intervalMs = Number(trimmed);
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 0 || intervalMs > MAX_SSE_INTERVAL_MS) {
    return { ok: false };
  }

  return { ok: true, intervalMs };
};

/**
 * Parses an `x-echo-sse-keepalive` header.
 * Absent headers disable keepalives. Accepts `1` / `true` (case-insensitive).
 *
 * @param value - Raw header value, or `undefined` when the header is absent.
 * @returns Parsed flag, or `{ ok: false }` when the value is invalid.
 */
export const parseSseKeepaliveHeader = (value: string | undefined): SseKeepaliveParseResult => {
  if (value === undefined) {
    return { ok: true, enabled: false };
  }

  const trimmed = value.trim().toLowerCase();
  if (trimmed === '1' || trimmed === 'true') {
    return { ok: true, enabled: true };
  }

  return { ok: false };
};

/**
 * Formats a single Server-Sent Event block.
 *
 * @param options - Optional event name / id and the payload string (may be multiline).
 * @returns Wire-format SSE frame ending with a blank line.
 */
export const formatSseEvent = (options: {
  event?: string;
  id?: string | number;
  data: string;
}): string => {
  let frame = '';

  if (options.id !== undefined) {
    frame += `id: ${options.id}\n`;
  }

  if (options.event !== undefined) {
    frame += `event: ${options.event}\n`;
  }

  for (const line of options.data.split('\n')) {
    frame += `data: ${line}\n`;
  }

  frame += '\n';
  return frame;
};

/**
 * Formats an SSE comment used as a keepalive / heartbeat.
 *
 * @param comment - Comment text (defaults to `keepalive`).
 * @returns Wire-format SSE comment ending with a blank line.
 */
export const formatSseComment = (comment = 'keepalive'): string => `: ${comment}\n\n`;
