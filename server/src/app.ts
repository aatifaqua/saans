/** Assembles the Hono app from injected dependencies, so tests run the real app offline. */
import { DISCLAIMER } from '@saans/core';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { compress } from 'hono/compress';
import { createGemini, type GeminiOptions, type GenerateFn } from './ai/gemini.ts';
import type { Config } from './config.ts';
import { onError } from './errors.ts';
import { clientKey, rateLimit } from './middleware/rateLimit.ts';
import { sameSiteJson } from './middleware/sameSite.ts';
import { securityHeaders } from './middleware/security.ts';
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
  /** Where the model chain reports each failed model; the entry point writes it to the log. */
  readonly onModelFailure?: (model: string, reason: string) => void;
}

const MAX_BODY_BYTES = 16 * 1024;
/**
 * A stalled model is dropped after 15 s so the chain reaches the next one; the whole chain stops
 * at 55 s, well inside Cloud Run's request timeout.
 */
const TIMINGS: Omit<GeminiOptions, 'models'> = { callTimeoutMs: 15_000, deadlineMs: 55_000 };

/** Builds the app: security and rate-limit middleware, the API routes and, when configured, the web app. */
export function createApp(deps: AppDeps): Hono {
  const { config, now } = deps;
  const gemini =
    deps.generate === null
      ? null
      : createGemini(deps.generate, {
          ...TIMINGS,
          models: config.models,
          ...(deps.onModelFailure === undefined ? {} : { onModelFailure: deps.onModelFailure }),
        });
  const keyOf = clientKey(config.trustProxy, deps.socketAddress);

  const app = new Hono();
  app.use(securityHeaders(config.trustProxy));
  app.use(compress());
  // Rejected cross-site or non-JSON posts are refused before they count against a visitor.
  app.use('/api/*', sameSiteJson());
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
