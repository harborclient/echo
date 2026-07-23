import express, { Express } from 'express';
import { applyEchoCookies } from './cookies';
import { buildEchoResponse } from './echo';
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
    const strictMode = parseStrictHeader(req.get('x-echo-strict'));
    if (strictMode === undefined) {
      return res.status(400).json(INVALID_STRICT_HEADER_ERROR);
    }

    if (strictMode === 'json' && !isJsonCompatibleContentType(req.get('content-type'))) {
      return res.status(415).json(UNSUPPORTED_MEDIA_TYPE_ERROR);
    }

    const delayResult = parseDelayHeader(req.get('x-echo-delay-ms'));
    if (!delayResult.ok) {
      return res.status(400).json(INVALID_DELAY_HEADER_ERROR);
    }

    await sleep(delayResult.delayMs);

    const redirectTo = req.get('x-redirect-to');
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
