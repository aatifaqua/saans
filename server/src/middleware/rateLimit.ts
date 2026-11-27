import { DISCLAIMER } from '@saans/core';
import type { Context, MiddlewareHandler } from 'hono';

/** Counters reset every minute. */
const WINDOW_MS = 60_000;
/** Above this many tracked clients, expired counters are swept. */
const DEFAULT_MAX_CLIENTS = 10_000;

/**
 * The client address used for rate limiting. Behind Cloud Run the front end appends the real
 * address as the last X-Forwarded-For entry; earlier entries come from the client and can be
 * forged, so only the last one is trusted, and only when TRUST_PROXY is set.
 */
export function clientKey(
  trustProxy: boolean,
  socket: (c: Context) => string | undefined,
): (c: Context) => string {
  return (c) => {
    const forwarded = trustProxy ? c.req.header('x-forwarded-for')?.split(',').at(-1)?.trim() : '';
    return forwarded !== undefined && forwarded !== '' ? forwarded : (socket(c) ?? 'unknown');
  };
}

/**
 * Fixed one-minute window per client. Expired counters are swept only when the map grows past
 * `maxClients` (10,000 by default), so a request normally costs one map lookup.
 */
export function rateLimit(options: {
  perMinute: number;
  now: () => number;
  keyOf: (c: Context) => string;
  maxClients?: number;
}): MiddlewareHandler {
  const maxClients = options.maxClients ?? DEFAULT_MAX_CLIENTS;
  const counters = new Map<string, { count: number; resetAt: number }>();
  return async (c, next) => {
    const time = options.now();
    if (counters.size > maxClients) {
      for (const [key, counter] of counters) if (counter.resetAt <= time) counters.delete(key);
    }
    const key = options.keyOf(c);
    const counter = counters.get(key);
    const current =
      counter === undefined || counter.resetAt <= time
        ? { count: 0, resetAt: time + WINDOW_MS }
        : counter;
    current.count += 1;
    counters.set(key, current);
    if (current.count > options.perMinute) {
      c.header('Retry-After', String(Math.ceil((current.resetAt - time) / 1000)));
      return c.json(
        { error: 'Too many requests. Please wait a minute.', disclaimer: DISCLAIMER },
        429,
      );
    }
    return next();
  };
}
