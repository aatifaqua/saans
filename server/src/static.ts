import { serveStatic } from '@hono/node-server/serve-static';
import type { Context, Hono, MiddlewareHandler } from 'hono';

// Vite names built assets by content hash, so they can be cached for a year; the page is
// revalidated on every visit so a new deploy is picked up at once.
const ASSETS = '/assets/';
const IMMUTABLE = 'public, max-age=31536000, immutable';

const isApi = (c: Context): boolean => c.req.path.startsWith('/api/');

function withCacheControl(serve: MiddlewareHandler): MiddlewareHandler {
  return async (c, next) => {
    const res = await serve(c, next);
    if (res instanceof Response) {
      res.headers.set('Cache-Control', c.req.path.startsWith(ASSETS) ? IMMUTABLE : 'no-cache');
    }
    return res;
  };
}

/** Serves the built web app, with index.html for any non-API, non-asset path (client routing). */
export function mountStatic(app: Hono, root: string): void {
  const files = withCacheControl(serveStatic({ root }));
  const page = withCacheControl(serveStatic({ root, path: 'index.html' }));
  app.get('*', async (c, next) => (isApi(c) ? next() : files(c, next)));
  app.get('*', async (c, next) =>
    isApi(c) || c.req.path.startsWith(ASSETS) ? next() : page(c, next),
  );
}
