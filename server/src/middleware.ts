import { DISCLAIMER } from '@saans/core';
import type { Context, MiddlewareHandler } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

/**
 * One strict policy for the page and the API, every header stated rather than left to library
 * defaults: everything from this origin only, no inline script or style (the built app ships one
 * CSS file), no workers, frames or plugins, HTTPS only, and geolocation for this origin only.
 */
export const securityHeaders = (behindHttps: boolean): MiddlewareHandler =>
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      manifestSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      workerSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      // Only behind Cloud Run's HTTPS front end; a plain-HTTP local run would break otherwise.
      ...(behindHttps ? { upgradeInsecureRequests: [] } : {}),
    },
    strictTransportSecurity: behindHttps ? 'max-age=31536000; includeSubDomains' : false,
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    crossOriginOpenerPolicy: 'same-origin',
    crossOriginResourcePolicy: 'same-origin',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: {
      geolocation: ['self'],
      camera: [],
      microphone: [],
      payment: [],
      usb: [],
      serial: [],
      hid: [],
      bluetooth: [],
      accelerometer: [],
      gyroscope: [],
      magnetometer: [],
      displayCapture: [],
      browsingTopics: [],
    },
  });

/**
 * API posts must be JSON sent by this site. A browser marks every request with Sec-Fetch-Site,
 * so a page on another site cannot spend this app's Gemini quota through a visitor's browser;
 * clients that send no such header (curl, tests) still need a JSON body.
 */
export const sameSiteJson = (): MiddlewareHandler => async (c, next) => {
  if (c.req.method !== 'POST') return next();
  const site = c.req.header('sec-fetch-site');
  if (site !== undefined && site !== 'same-origin' && site !== 'none') {
    return c.json({ error: 'Requests must come from this site.', disclaimer: DISCLAIMER }, 403);
  }
  // Media types are case-insensitive.
  if (!(c.req.header('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return c.json({ error: 'Send the request as JSON.', disclaimer: DISCLAIMER }, 415);
  }
  return next();
};

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
  const maxClients = options.maxClients ?? 10_000;
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
        ? { count: 0, resetAt: time + 60_000 }
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
