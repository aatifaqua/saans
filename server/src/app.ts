import { DISCLAIMER } from '@saans/core';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { compress } from 'hono/compress';
import { createGemini, type GeminiOptions, type GenerateFn } from './ai/gemini.ts';
import type { Config } from './config.ts';
import { onError } from './errors.ts';
import { clientKey, rateLimit, securityHeaders } from './middleware.ts';
import { createAirSource, type FetchFn } from './openMeteo.ts';
import { aiRoutes } from './routes/ai.ts';
import { airRoutes } from './routes/air.ts';
import { mountStatic } from './static.ts';

/** Everything the app needs from the outside world, injected so tests run offline with fakes. */
export interface AppDeps {
  readonly config: Config;
  readonly fetch: FetchFn;
  /** The Gemini SDK call; null when no key is configured, which makes the AI routes answer 503. */
  readonly generate: GenerateFn | null;
  readonly now: () => number;
  readonly socketAddress: (c: Context) => string | undefined;
}

const MAX_BODY_BYTES = 16 * 1024;
/**
 * A stalled model is dropped after 15 s so the chain reaches the next one; the whole chain stops
 * at 55 s, well inside Cloud Run's request timeout.
 */
const TIMINGS: Omit<GeminiOptions, 'models'> = { callTimeoutMs: 15_000, deadlineMs: 55_000 };

export function createApp(deps: AppDeps): Hono {
  const { config } = deps;
  const { now } = deps;
  const gemini =
    deps.generate === null
      ? null
      : createGemini(deps.generate, { ...TIMINGS, models: config.models });
  const keyOf = clientKey(config.trustProxy, deps.socketAddress);

  const app = new Hono();
  app.use(securityHeaders());
  app.use(compress());
  app.use('/api/*', rateLimit({ perMinute: config.rateLimit.perMinute, now, keyOf }));
  const aiLimit = rateLimit({ perMinute: config.rateLimit.aiPerMinute, now, keyOf });
  app.use('/api/plan', aiLimit);
  app.use('/api/ask', aiLimit);
  app.use(
    '/api/*',
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json({ error: 'The request is too large.', disclaimer: DISCLAIMER }, 413),
    }),
  );

  app.get('/api/health', (c) => c.json({ status: 'ok', ai: gemini !== null }));
  // One air source, so the forecast fetched for the page is reused when grounding the model.
  const air = createAirSource(deps.fetch, now);
  app.route('/api', airRoutes(air));
  app.route('/api', aiRoutes({ air, gemini, now }));

  if (config.staticDir !== undefined) mountStatic(app, config.staticDir);
  app.notFound((c) => c.json({ error: 'Not found.', disclaimer: DISCLAIMER }, 404));
  app.onError(onError);
  return app;
}
