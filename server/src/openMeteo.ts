import type { HourReading } from '@saans/core';
import { z } from 'zod';
import { createCache } from './cache.ts';

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface Place {
  readonly name: string;
  readonly region: string;
  readonly lat: number;
  readonly lon: number;
}

export interface AirData {
  readonly utcOffsetSeconds: number;
  readonly readings: readonly HourReading[];
}

/** Open-Meteo failed or answered with something unexpected. */
export class UpstreamError extends Error {
  override readonly name = 'UpstreamError';
}

const GEOCODING = 'https://geocoding-api.open-meteo.com/v1/search';
const AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const TIMEOUT_MS = 8000;
/** Forecasts update hourly; places never move. */
const AIR_TTL_MS = 15 * 60_000;
const PLACE_TTL_MS = 24 * 60 * 60_000;
const MAX_ENTRIES = 500;

// Upstream data is untrusted input too: only the fields the app uses are read, and checked.
const GeocodeSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        admin1: z.string().optional(),
        latitude: z.number(),
        longitude: z.number(),
      }),
    )
    .optional(),
});

const reading = z.array(z.number().nullable());
const AirSchema = z.object({
  utc_offset_seconds: z.number(),
  hourly: z.object({ time: z.array(z.string()), pm2_5: reading, pm10: reading }),
});

/** Two decimals is about 1 km: close enough for city air, and it lets nearby users share a cache entry. */
export const round2 = (value: number): number => Math.round(value * 100) / 100;

async function getJson(fetchFn: FetchFn, url: string): Promise<unknown> {
  try {
    const res = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new UpstreamError(`Open-Meteo answered ${String(res.status)}`);
    return await res.json();
  } catch (error) {
    throw error instanceof UpstreamError ? error : new UpstreamError('Open-Meteo unreachable');
  }
}

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new UpstreamError('Open-Meteo sent an unexpected shape');
  return result.data;
}

/** Place search (India only) and hourly PM2.5 / PM10 forecasts, both cached. */
export function createAirSource(fetchFn: FetchFn, now: () => number) {
  const placeCache = createCache<readonly Place[]>({
    ttlMs: PLACE_TTL_MS,
    maxEntries: MAX_ENTRIES,
    now,
  });
  const airCache = createCache<AirData>({ ttlMs: AIR_TTL_MS, maxEntries: MAX_ENTRIES, now });

  const loadPlaces = async (query: string): Promise<readonly Place[]> => {
    const params = new URLSearchParams({
      name: query,
      count: '5',
      language: 'en',
      countryCode: 'IN',
    });
    const { results = [] } = parse(
      GeocodeSchema,
      await getJson(fetchFn, `${GEOCODING}?${params.toString()}`),
    );
    return results.map((r) => ({
      name: r.name,
      region: r.admin1 ?? '',
      lat: round2(r.latitude),
      lon: round2(r.longitude),
    }));
  };

  const loadAir = async (lat: number, lon: number): Promise<AirData> => {
    const query = `latitude=${String(lat)}&longitude=${String(lon)}&hourly=pm2_5,pm10&timezone=auto&forecast_days=3`;
    const body = parse(AirSchema, await getJson(fetchFn, `${AIR}?${query}`));
    const { time, pm2_5, pm10 } = body.hourly;
    return {
      utcOffsetSeconds: body.utc_offset_seconds,
      readings: time.map((hour, i) => ({
        time: hour,
        pm25: pm2_5[i] ?? null,
        pm10: pm10[i] ?? null,
      })),
    };
  };

  return {
    places(query: string): Promise<readonly Place[]> {
      const key = query.trim().toLowerCase();
      return placeCache.get(key, () => loadPlaces(key));
    },
    air(lat: number, lon: number): Promise<AirData> {
      const [rLat, rLon] = [round2(lat), round2(lon)];
      return airCache.get(`${String(rLat)},${String(rLon)}`, () => loadAir(rLat, rLon));
    },
  };
}

export type AirSource = ReturnType<typeof createAirSource>;
