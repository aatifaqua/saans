/** Shared settings, fixtures and fakes for the server tests. */
import type { GenerateContentParameters } from '@google/genai';
import type { Household, Plan } from '@saans/core';
import type { GenerateFn } from '../src/ai/gemini.ts';
import type { AppDeps } from '../src/app.ts';
import type { Config } from '../src/config.ts';
import type { FetchFn } from '../src/openMeteo.ts';

/** The fixed clock for every test: 00:30 UTC, which is 06:00 in India. */
export const NOW = Date.parse('2026-11-22T00:30:00Z');

/** The configuration every test starts from: a key, two models, no static files. */
export const CONFIG: Config = {
  geminiApiKey: 'test-key',
  models: ['model-a', 'model-b'],
  port: 8080,
  staticDir: undefined,
  trustProxy: false,
  rateLimit: { perMinute: 60, aiPerMinute: 10 },
};

/** A family of four with a child who has asthma, commuting by car. */
export const HOUSEHOLD: Household = {
  members: { child: 1, adult: 2, olderAdult: 0, pregnant: 0 },
  sensitivities: ['asthma'],
  commute: 'car',
  outdoorExercise: false,
  hasPurifier: false,
};

/** Delhi, as the web app sends it. */
export const PLACE = { name: 'Delhi', lat: 28.61, lon: 77.21 };

/** A complete plan in the shape Gemini must return. */
export const PLAN: Plan = {
  summary: 'Severe smog all day: stay in and keep the air inside clean.',
  routine: [
    { time: '07:00', action: 'Short school run by car', why: 'Least bad hour' },
    { time: '12:00', action: 'Indoor play', why: 'Air is Very Poor' },
    { time: '18:00', action: 'Purifier on high in the bedroom', why: 'Evening peak' },
  ],
  alternatives: [
    {
      choice: 'Combine errands into one car trip',
      impact: 'Fewer cold starts and less exhaust on your street',
    },
    {
      choice: 'Switch off the engine at the school gate',
      impact: 'Less exhaust where children wait',
    },
  ],
  hacks: [
    {
      id: 'sealGaps',
      how: 'Roll a towel at the balcony door',
      impact: 'Less smoky air seeps in at night',
    },
    { id: 'wetMop', how: 'Mop the living room tonight', impact: 'Settled dust stays down' },
    {
      id: 'noBurning',
      how: 'Use the electric heater',
      impact: 'No smoke added indoors or outside',
    },
  ],
  community: [
    {
      action: 'Ask the school to hold assembly indoors on Very Poor days',
      impact: 'Every child avoids the morning peak',
    },
  ],
};

/** A smoggy 72-hour forecast starting at midnight India time, as Open-Meteo returns it. */
export function airPayload(): unknown {
  const time = Array.from({ length: 72 }, (_, hour) =>
    new Date(Date.parse('2026-11-22T00:00Z') + hour * 3_600_000).toISOString().slice(0, 16),
  );
  return {
    utc_offset_seconds: 19_800,
    hourly: { time, pm2_5: time.map(() => 200), pm10: time.map(() => null) },
  };
}

/** One Open-Meteo geocoding match for Delhi. */
export const GEOCODE = {
  results: [{ name: 'Delhi', admin1: 'Delhi', latitude: 28.65195, longitude: 77.23149 }],
};

/** A fetch fake that answers by host and records every URL it was asked for. */
export function fakeFetch(
  answers: { geocode?: unknown; air?: unknown; status?: number } = {},
): FetchFn & { urls: string[] } {
  const urls: string[] = [];
  const fn = (url: string): Promise<Response> => {
    urls.push(url);
    const body = url.includes('geocoding')
      ? (answers.geocode ?? GEOCODE)
      : (answers.air ?? airPayload());
    return Promise.resolve(Response.json(body, { status: answers.status ?? 200 }));
  };
  return Object.assign(fn, { urls });
}

/** A Gemini fake: each call takes the next scripted answer (text, or an error to throw). */
export function fakeGenerate(
  script: readonly (string | Error)[],
): GenerateFn & { calls: GenerateContentParameters[] } {
  const calls: GenerateContentParameters[] = [];
  const fn = (params: GenerateContentParameters): Promise<{ text: string }> => {
    const answer = script[calls.length] ?? new Error('script exhausted');
    calls.push(params);
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve({ text: answer });
  };
  return Object.assign(fn, { calls });
}

/** An error shaped like the SDK's ApiError, which carries the HTTP status. */
export function apiError(status: number): Error {
  return Object.assign(new Error(`status ${String(status)}`), { status });
}

/** App dependencies with every outside service faked; override any of them per test. */
export function deps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    config: CONFIG,
    fetch: fakeFetch(),
    generate: fakeGenerate([JSON.stringify(PLAN)]),
    now: () => NOW,
    socketAddress: () => '127.0.0.1',
    ...overrides,
  };
}
