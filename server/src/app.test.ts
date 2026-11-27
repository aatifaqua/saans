import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DISCLAIMER } from '@saans/core';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import {
  apiError,
  CONFIG,
  deps,
  fakeFetch,
  fakeGenerate,
  HOUSEHOLD,
  PLACE,
  PLAN,
} from '../test/doubles.ts';

const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('health and headers', () => {
  it('reports that live AI is configured', async () => {
    const res = await createApp(deps()).request('/api/health');
    expect(await res.json()).toEqual({ status: 'ok', ai: true });
  });

  it('reports that live AI is not configured when no key is set', async () => {
    const res = await createApp(deps({ generate: null })).request('/api/health');
    expect(await res.json()).toEqual({ status: 'ok', ai: false });
  });

  it('sends a strict content security policy and hardening headers', async () => {
    const res = await createApp(deps()).request('/api/health');
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).toContain("worker-src 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain('upgrade-insecure-requests');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('strict-transport-security')).toBe(
      'max-age=31536000; includeSubDomains',
    );
    expect(res.headers.get('cross-origin-opener-policy')).toBe('same-origin');
    expect(res.headers.get('cross-origin-resource-policy')).toBe('same-origin');
    const permissions = res.headers.get('permissions-policy') ?? '';
    expect(permissions).toContain('geolocation=(self)');
    expect(permissions).toContain('payment=()');
    expect(permissions).toContain('usb=()');
  });

  it('accepts only same-site JSON posts to the API', async () => {
    const generate = fakeGenerate([JSON.stringify(PLAN), JSON.stringify(PLAN)]);
    const app = createApp(deps({ generate }));
    const body = JSON.stringify({ household: HOUSEHOLD, place: PLACE });
    const text = await app.request('/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body,
    });
    expect(text.status).toBe(415);
    // Bytes, unlike a string, carry no automatic content type.
    const untyped = await app.request('/api/plan', {
      method: 'POST',
      body: new TextEncoder().encode(body),
    });
    expect(untyped.status).toBe(415);
    const direct = await app.request('/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'none' },
      body,
    });
    expect(direct.status).toBe(200);
    const crossSite = await app.request('/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' },
      body,
    });
    expect(crossSite.status).toBe(403);
    expect(await crossSite.json()).toMatchObject({ disclaimer: DISCLAIMER });
    const sameSite = await app.request('/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
      body,
    });
    expect(sameSite.status).toBe(200);
  });

  it('never lets a browser or proxy cache an AI answer', async () => {
    const res = await createApp(deps()).request(
      '/api/plan',
      post({ household: HOUSEHOLD, place: PLACE }),
    );
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('answers unknown API paths with a JSON 404', async () => {
    const res = await createApp(deps()).request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found.', disclaimer: DISCLAIMER });
  });

  it('limits each client to the configured requests per minute', async () => {
    const app = createApp(
      deps({ config: { ...CONFIG, rateLimit: { perMinute: 3, aiPerMinute: 1 } } }),
    );
    const statuses: number[] = [];
    for (let i = 0; i < 4; i += 1) statuses.push((await app.request('/api/health')).status);
    expect(statuses).toEqual([200, 200, 200, 429]);
    expect(await (await app.request('/api/health')).json()).toMatchObject({
      disclaimer: DISCLAIMER,
    });
  });
});

describe('GET /api/places', () => {
  it('searches Indian places only and caches by normalised query', async () => {
    const fetch = fakeFetch();
    const app = createApp(deps({ fetch }));
    const res = await app.request('/api/places?q=Delhi');
    expect(await res.json()).toEqual({
      places: [{ name: 'Delhi', region: 'Delhi', lat: 28.65, lon: 77.23 }],
      disclaimer: DISCLAIMER,
    });
    await app.request('/api/places?q=%20delhi%20');
    expect(fetch.urls).toHaveLength(1);
    expect(fetch.urls[0]).toContain('countryCode=IN');
  });

  it('leaves the region blank when Open-Meteo has none', async () => {
    const geocode = { results: [{ name: 'Gurugram', latitude: 28.46, longitude: 77.03 }] };
    const app = createApp(deps({ fetch: fakeFetch({ geocode }) }));
    expect(await (await app.request('/api/places?q=Guru')).json()).toEqual({
      places: [{ name: 'Gurugram', region: '', lat: 28.46, lon: 77.03 }],
      disclaimer: DISCLAIMER,
    });
  });

  it('returns an empty list when nothing in India matches', async () => {
    const app = createApp(deps({ fetch: fakeFetch({ geocode: {} }) }));
    expect(await (await app.request('/api/places?q=Atlantis')).json()).toMatchObject({
      places: [],
    });
  });

  it('rejects a one-letter query', async () => {
    expect((await createApp(deps()).request('/api/places?q=d')).status).toBe(400);
  });
});

describe('GET /api/air', () => {
  it('returns hourly readings with the offset and the disclaimer', async () => {
    const res = await createApp(deps()).request('/api/air?lat=28.6139&lon=77.209');
    const body = (await res.json()) as { utcOffsetSeconds: number; readings: unknown[] };
    expect(body).toMatchObject({ utcOffsetSeconds: 19_800, disclaimer: DISCLAIMER });
    expect(body.readings).toHaveLength(72);
    expect(res.headers.get('cache-control')).toContain('max-age=300');
  });

  it('coalesces concurrent requests for the same rounded spot into one upstream call', async () => {
    const fetch = fakeFetch();
    const app = createApp(deps({ fetch }));
    await Promise.all([
      app.request('/api/air?lat=28.611&lon=77.209'),
      app.request('/api/air?lat=28.614&lon=77.211'),
    ]);
    expect(fetch.urls).toHaveLength(1);
    expect(fetch.urls[0]).toContain('latitude=28.61&longitude=77.21');
  });

  it('turns an upstream failure into a 502 that still carries the disclaimer', async () => {
    const app = createApp(deps({ fetch: fakeFetch({ status: 500 }) }));
    const res = await app.request('/api/air?lat=28.6&lon=77.2');
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ disclaimer: DISCLAIMER });
  });

  it('answers 502 when Open-Meteo is unreachable or sends an unexpected shape', async () => {
    const offline = createApp(deps({ fetch: () => Promise.reject(new TypeError('fetch failed')) }));
    expect((await offline.request('/api/air?lat=28.6&lon=77.2')).status).toBe(502);
    const odd = createApp(deps({ fetch: fakeFetch({ air: { hourly: 'none' } }) }));
    expect((await odd.request('/api/air?lat=28.6&lon=77.2')).status).toBe(502);
  });

  it('fills short upstream series with gaps rather than failing', async () => {
    const air = {
      utc_offset_seconds: 0,
      hourly: { time: ['2026-11-22T00:00'], pm2_5: [], pm10: [] },
    };
    const res = await createApp(deps({ fetch: fakeFetch({ air }) })).request(
      '/api/air?lat=1&lon=1',
    );
    expect(await res.json()).toMatchObject({
      readings: [{ time: '2026-11-22T00:00', pm25: null, pm10: null }],
    });
  });

  it('rejects coordinates that are not numbers or out of range', async () => {
    const app = createApp(deps());
    expect((await app.request('/api/air?lat=abc&lon=77')).status).toBe(400);
    expect((await app.request('/api/air?lat=95&lon=77')).status).toBe(400);
  });
});

describe('POST /api/plan', () => {
  it('returns the model plan, the model name and the disclaimer', async () => {
    const generate = fakeGenerate([JSON.stringify(PLAN)]);
    const res = await createApp(deps({ generate })).request(
      '/api/plan',
      post({ household: HOUSEHOLD, place: PLACE }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ plan: PLAN, model: 'model-a', disclaimer: DISCLAIMER });
    const prompt = JSON.stringify(generate.calls[0]);
    expect(prompt).toContain('\\"place\\":\\"Delhi\\"');
    expect(prompt).toContain(DISCLAIMER);
  });

  it('moves to the next model when a hack is outside the allowed list', async () => {
    const forbidden = {
      ...PLAN,
      hacks: [{ id: 'ventilateCleanHour', how: 'x' }, ...PLAN.hacks.slice(1)],
    };
    const generate = fakeGenerate([JSON.stringify(forbidden), JSON.stringify(PLAN)]);
    const res = await createApp(deps({ generate })).request(
      '/api/plan',
      post({ household: HOUSEHOLD, place: PLACE }),
    );
    expect(await res.json()).toMatchObject({ model: 'model-b' });
  });

  it('answers 503 with no plan when every model fails', async () => {
    const generate = fakeGenerate([apiError(503), 'not json']);
    const res = await createApp(deps({ generate })).request(
      '/api/plan',
      post({ household: HOUSEHOLD, place: PLACE }),
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty('plan');
    expect(body).toMatchObject({ disclaimer: DISCLAIMER });
  });

  it('answers 503 when no key is configured', async () => {
    const res = await createApp(deps({ generate: null })).request(
      '/api/plan',
      post({ household: HOUSEHOLD, place: PLACE }),
    );
    expect(res.status).toBe(503);
  });

  it('rejects unknown household fields and malformed JSON', async () => {
    const app = createApp(deps());
    const extra = { household: { ...HOUSEHOLD, pets: 2 }, place: PLACE };
    expect((await app.request('/api/plan', post(extra))).status).toBe(400);
    const broken = { ...post({}), body: '{"household":' };
    expect((await app.request('/api/plan', broken)).status).toBe(400);
  });

  it('rejects bodies over 16 kB', async () => {
    const huge = { household: HOUSEHOLD, place: { ...PLACE, name: 'x'.repeat(20_000) } };
    const res = await createApp(deps()).request('/api/plan', post(huge));
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ disclaimer: DISCLAIMER });
  });

  it('applies the tighter AI rate limit', async () => {
    const config = { ...CONFIG, rateLimit: { perMinute: 60, aiPerMinute: 1 } };
    const generate = fakeGenerate([JSON.stringify(PLAN), JSON.stringify(PLAN)]);
    const app = createApp(deps({ config, generate }));
    const body = { household: HOUSEHOLD, place: PLACE };
    expect((await app.request('/api/plan', post(body))).status).toBe(200);
    expect((await app.request('/api/plan', post(body))).status).toBe(429);
  });
});

describe('POST /api/ask', () => {
  const ask = {
    household: HOUSEHOLD,
    place: PLACE,
    plan: PLAN,
    question: 'Can we go to the park?',
  };

  it('answers a question grounded on the plan', async () => {
    const generate = fakeGenerate(['Not today; the air is Very Poor.']);
    const res = await createApp(deps({ generate })).request('/api/ask', post(ask));
    expect(await res.json()).toEqual({
      answer: 'Not today; the air is Very Poor.',
      model: 'model-a',
      disclaimer: DISCLAIMER,
    });
    expect(JSON.stringify(generate.calls[0])).toContain('Indoor play');
  });

  it('rejects a question over 500 characters', async () => {
    const res = await createApp(deps()).request(
      '/api/ask',
      post({ ...ask, question: 'a'.repeat(501) }),
    );
    expect(res.status).toBe(400);
  });

  it('treats an empty answer as a model failure', async () => {
    const generate = fakeGenerate(['  ', '']);
    const res = await createApp(deps({ generate })).request('/api/ask', post(ask));
    expect(res.status).toBe(503);
  });
});

describe('static web app', () => {
  const root = mkdtempSync(join(tmpdir(), 'saans-static-'));
  mkdirSync(join(root, 'assets'));
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>Saans</title>');
  writeFileSync(join(root, 'assets', 'app-1.js'), 'export {};');
  const app = createApp(deps({ config: { ...CONFIG, staticDir: root } }));

  it('serves hashed assets as immutable and the page as revalidated', async () => {
    expect((await app.request('/assets/app-1.js')).headers.get('cache-control')).toContain(
      'immutable',
    );
    expect((await app.request('/')).headers.get('cache-control')).toBe('no-cache');
  });

  it('serves the page for any other path but never for missing assets or the API', async () => {
    expect(await (await app.request('/anything')).text()).toContain('<title>Saans</title>');
    expect((await app.request('/assets/missing.js')).status).toBe(404);
    expect((await app.request('/api/missing')).status).toBe(404);
  });
});
