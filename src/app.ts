import express, { Express } from 'express';
import { buildEchoResponse } from './echo';
import { bodyParsers } from './middleware/bodyParsers';

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
    res.json(buildEchoResponse(req));
  });

  return app;
};
