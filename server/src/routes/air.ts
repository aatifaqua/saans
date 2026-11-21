import { DISCLAIMER } from '@saans/core';
import { Hono } from 'hono';
import { z } from 'zod';
import { invalid } from '../errors.ts';
import type { AirSource } from '../openMeteo.ts';

const PlacesQuery = z.object({ q: z.string().trim().min(2).max(60) });
const AirQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

/** Forecasts change hourly, so browsers and Cloud Run's front end may reuse an answer briefly. */
const AIR_CACHE_CONTROL = 'public, max-age=300';

/** Place search and the hourly forecast. Both are thin, cached proxies of Open-Meteo. */
export function airRoutes(air: AirSource): Hono {
  const app = new Hono();

  app.get('/places', async (c) => {
    const query = PlacesQuery.safeParse(c.req.query());
    if (!query.success) throw invalid('Search for a city name of 2 to 60 characters.');
    return c.json({ places: await air.places(query.data.q), disclaimer: DISCLAIMER });
  });

  app.get('/air', async (c) => {
    const query = AirQuery.safeParse(c.req.query());
    if (!query.success) throw invalid('Latitude and longitude must be valid numbers.');
    const data = await air.air(query.data.lat, query.data.lon);
    c.header('Cache-Control', AIR_CACHE_CONTROL);
    return c.json({ ...data, disclaimer: DISCLAIMER });
  });

  return app;
}
