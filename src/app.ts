import express, { Express, Request, Response } from 'express';
import { applyEchoCookies } from './cookies';
import { buildEchoResponse, getQueryParam } from './echo';
import { bodyParsers } from './middleware/bodyParsers';
import { INVALID_REDIRECT_HEADER_ERROR, parseRedirectHeader } from './redirect';
import {
  INVALID_DELAY_HEADER_ERROR,
  INVALID_STRICT_HEADER_ERROR,
  UNSUPPORTED_MEDIA_TYPE_ERROR,
  isJsonCompatibleContentType,
  parseDelayHeader,
  parseStrictHeader,
  sleep,
} from './requestControls';
import {
  INVALID_SSE_COUNT_ERROR,
  INVALID_SSE_INTERVAL_ERROR,
  INVALID_SSE_KEEPALIVE_ERROR,
  formatSseComment,
  formatSseEvent,
  parseSseCountHeader,
  parseSseIntervalHeader,
  parseSseKeepaliveHeader,
} from './sse';

/**
 * Resolves an echo control from the request header, falling back to the
 * same-named query param when the header is absent.
 */
const resolveEchoControl = (req: Request, name: string): string | undefined =>
  req.get(name) ?? getQueryParam(req.query, name);

/**
 * Opens an SSE response and streams one or more echo events.
 * Honors delay / count / interval / keepalive controls. Ignores redirects.
 */
const handleSse = async (req: Request, res: Response): Promise<void> => {
  const delayResult = parseDelayHeader(resolveEchoControl(req, 'x-echo-delay-ms'));
  if (!delayResult.ok) {
    res.status(400).json(INVALID_DELAY_HEADER_ERROR);
    return;
  }

  const countResult = parseSseCountHeader(resolveEchoControl(req, 'x-echo-sse-count'));
  if (!countResult.ok) {
    res.status(400).json(INVALID_SSE_COUNT_ERROR);
    return;
  }

  const intervalResult = parseSseIntervalHeader(resolveEchoControl(req, 'x-echo-sse-interval-ms'));
  if (!intervalResult.ok) {
    res.status(400).json(INVALID_SSE_INTERVAL_ERROR);
    return;
  }

  const keepaliveResult = parseSseKeepaliveHeader(resolveEchoControl(req, 'x-echo-sse-keepalive'));
  if (!keepaliveResult.ok) {
    res.status(400).json(INVALID_SSE_KEEPALIVE_ERROR);
    return;
  }

  await sleep(delayResult.delayMs);

  const echo = buildEchoResponse(req);
  applyEchoCookies(res, echo.cookies);

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const payload = JSON.stringify(echo);

  for (let index = 1; index <= countResult.count; index += 1) {
    if (res.writableEnded) {
      return;
    }

    res.write(
      formatSseEvent({
        id: index,
        event: 'echo',
        data: payload,
      }),
    );

    if (index < countResult.count) {
      if (keepaliveResult.enabled) {
        res.write(formatSseComment());
      }
      await sleep(intervalResult.intervalMs);
    }
  }

  if (keepaliveResult.enabled && !res.writableEnded) {
    res.write(formatSseComment());
  }

  res.end();
};

/**
 * Creates and configures the Express application.
 */
export const createApp = (): Express => {
  const app = express();

  app.set('trust proxy', 1);
  app.use(bodyParsers);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Named route before the catch-all so /sse is not swallowed as a JSON echo.
  app.all('/sse', (req, res) => {
    void handleSse(req, res);
  });

  app.all(/.*/, async (req, res) => {
    const strictMode = parseStrictHeader(resolveEchoControl(req, 'x-echo-strict'));
    if (strictMode === undefined) {
      return res.status(400).json(INVALID_STRICT_HEADER_ERROR);
    }

    if (strictMode === 'json' && !isJsonCompatibleContentType(req.get('content-type'))) {
      return res.status(415).json(UNSUPPORTED_MEDIA_TYPE_ERROR);
    }

    const delayResult = parseDelayHeader(resolveEchoControl(req, 'x-echo-delay-ms'));
    if (!delayResult.ok) {
      return res.status(400).json(INVALID_DELAY_HEADER_ERROR);
    }

    await sleep(delayResult.delayMs);

    const redirectTo = resolveEchoControl(req, 'x-echo-redirect');
    if (redirectTo !== undefined) {
      const target = parseRedirectHeader(redirectTo);
      if (!target) {
        return res.status(400).json(INVALID_REDIRECT_HEADER_ERROR);
      }
      return res.redirect(target.status, target.url);
    }

    const echo = buildEchoResponse(req);
    applyEchoCookies(res, echo.cookies);
    res.json(echo);
  });

  return app;
};
