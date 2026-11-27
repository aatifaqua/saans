import { DISCLAIMER } from '@saans/core';
import type { MiddlewareHandler } from 'hono';

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
