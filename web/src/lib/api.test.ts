import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, askQuestion, getAir, getPlan, searchPlaces } from './api.ts';
import { HOUSEHOLD, PLACE, PLAN, stubFetch } from '../../test/fixtures.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api', () => {
  it('searches places by encoded query', async () => {
    stubFetch({ places: [{ name: 'Delhi', region: 'Delhi', lat: 28.65, lon: 77.23 }] });
    expect(await searchPlaces('New Delhi')).toHaveLength(1);
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('/api/places?q=New%20Delhi');
  });

  it('drops forecast readings that are not well-formed', async () => {
    const good = { time: '2026-11-22T06:00', pm25: 80, pm10: null };
    stubFetch({ utcOffsetSeconds: 0, readings: [good, { time: 7 }, null, { ...good, pm25: 'x' }] });
    expect(await getAir(PLACE)).toEqual({ utcOffsetSeconds: 0, readings: [good] });
  });

  it('reads the air forecast', async () => {
    stubFetch({ utcOffsetSeconds: 19_800, readings: [], disclaimer: 'd' });
    expect(await getAir(PLACE)).toEqual({ utcOffsetSeconds: 19_800, readings: [] });
  });

  it('posts the household and place for a plan', async () => {
    stubFetch({ plan: PLAN, model: 'gemini-3.6-flash', disclaimer: 'd' });
    expect(await getPlan(HOUSEHOLD, PLACE)).toEqual({ plan: PLAN, model: 'gemini-3.6-flash' });
    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(typeof init?.body === 'string' ? JSON.parse(init.body) : null).toEqual({
      household: HOUSEHOLD,
      place: PLACE,
    });
  });

  it('posts a question with the plan', async () => {
    stubFetch({ answer: 'Yes, at 3 PM.', model: 'm', disclaimer: 'd' });
    expect(await askQuestion(HOUSEHOLD, PLACE, PLAN, 'Park?')).toEqual({
      answer: 'Yes, at 3 PM.',
      model: 'm',
    });
  });

  it('surfaces the server message and status on failure', async () => {
    stubFetch({ error: 'The AI assistant is unavailable right now. Please retry.' }, 503);
    await expect(getPlan(HOUSEHOLD, PLACE)).rejects.toEqual(
      new ApiError('The AI assistant is unavailable right now. Please retry.', 503),
    );
  });

  it('rejects a plan or answer that does not have the expected shape', async () => {
    stubFetch({ plan: { ...PLAN, hacks: [{ id: 'notAHack', how: 'x' }] }, model: 'm' });
    await expect(getPlan(HOUSEHOLD, PLACE)).rejects.toBeInstanceOf(ApiError);
    stubFetch({ plan: { ...PLAN, community: 'later' }, model: 'm' });
    await expect(getPlan(HOUSEHOLD, PLACE)).rejects.toBeInstanceOf(ApiError);
    stubFetch({ plan: { ...PLAN, routine: 'soon' }, model: 'm' });
    await expect(getPlan(HOUSEHOLD, PLACE)).rejects.toBeInstanceOf(ApiError);
    stubFetch({ answer: 42, model: 'm' });
    await expect(askQuestion(HOUSEHOLD, PLACE, PLAN, 'Q?')).rejects.toBeInstanceOf(ApiError);
    stubFetch({ places: 'none' });
    await expect(searchPlaces('Delhi')).rejects.toBeInstanceOf(ApiError);
  });

  it('uses a plain message when an error page is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('<h1>Bad gateway</h1>', { status: 502 }))),
    );
    await expect(getAir(PLACE)).rejects.toEqual(new ApiError('Something went wrong.', 502));
  });

  it('reports a network failure and an unexpected body plainly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('offline'))),
    );
    await expect(getAir(PLACE)).rejects.toMatchObject({ status: 0 });
    stubFetch({ something: 'else' });
    await expect(getAir(PLACE)).rejects.toBeInstanceOf(ApiError);
    stubFetch('not an object', 500);
    await expect(searchPlaces('x')).rejects.toMatchObject({ status: 500 });
  });
});
