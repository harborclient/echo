import express, { Express } from 'express';
import { applyEchoCookies } from './cookies';
import { buildEchoResponse } from './echo';
import { bodyParsers } from './middleware/bodyParsers';
import { INVALID_REDIRECT_HEADER_ERROR, parseRedirectHeader } from './redirect';

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

  app.all(/.*/, (req, res) => {
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
