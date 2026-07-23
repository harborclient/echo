import express, { Express, Request } from 'express';
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

/**
 * Resolves an echo control from the request header, falling back to the
 * same-named query param when the header is absent.
 */
const resolveEchoControl = (req: Request, name: string): string | undefined =>
  req.get(name) ?? getQueryParam(req.query, name);

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
