import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, askQuestion, getAir, getPlan, searchPlaces } from './api.ts';
import { HOUSEHOLD, PLACE, PLAN } from '../../test/fixtures.ts';

function answer(body: unknown, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(Response.json(body, { status }))),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api', () => {
  it('searches places by encoded query', async () => {
    answer({ places: [{ name: 'Delhi', region: 'Delhi', lat: 28.65, lon: 77.23 }] });
    expect(await searchPlaces('New Delhi')).toHaveLength(1);
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('/api/places?q=New%20Delhi');
  });

  it('reads the air forecast', async () => {
    answer({ utcOffsetSeconds: 19_800, readings: [], disclaimer: 'd' });
    expect(await getAir(PLACE)).toEqual({ utcOffsetSeconds: 19_800, readings: [] });
  });

  it('posts the household and place for a plan', async () => {
    answer({ plan: PLAN, model: 'gemini-3.6-flash', disclaimer: 'd' });
    expect(await getPlan(HOUSEHOLD, PLACE)).toEqual({ plan: PLAN, model: 'gemini-3.6-flash' });
    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(typeof init?.body === 'string' ? JSON.parse(init.body) : null).toEqual({
      household: HOUSEHOLD,
      place: PLACE,
    });
  });

  it('posts a question with the plan', async () => {
    answer({ answer: 'Yes, at 3 PM.', model: 'm', disclaimer: 'd' });
    expect(await askQuestion(HOUSEHOLD, PLACE, PLAN, 'Park?')).toEqual({
      answer: 'Yes, at 3 PM.',
      model: 'm',
    });
  });

  it('surfaces the server message and status on failure', async () => {
    answer({ error: 'The AI assistant is unavailable right now. Please retry.' }, 503);
    await expect(getPlan(HOUSEHOLD, PLACE)).rejects.toEqual(
      new ApiError('The AI assistant is unavailable right now. Please retry.', 503),
    );
  });

  it('rejects a plan or answer that does not have the expected shape', async () => {
    answer({ plan: { ...PLAN, hacks: [{ id: 'notAHack', how: 'x' }] }, model: 'm' });
    await expect(getPlan(HOUSEHOLD, PLACE)).rejects.toBeInstanceOf(ApiError);
    answer({ plan: { ...PLAN, community: 'later' }, model: 'm' });
    await expect(getPlan(HOUSEHOLD, PLACE)).rejects.toBeInstanceOf(ApiError);
    answer({ plan: { ...PLAN, routine: 'soon' }, model: 'm' });
    await expect(getPlan(HOUSEHOLD, PLACE)).rejects.toBeInstanceOf(ApiError);
    answer({ answer: 42, model: 'm' });
    await expect(askQuestion(HOUSEHOLD, PLACE, PLAN, 'Q?')).rejects.toBeInstanceOf(ApiError);
    answer({ places: 'none' });
    await expect(searchPlaces('Delhi')).rejects.toBeInstanceOf(ApiError);
  });

  it('reports a network failure and an unexpected body plainly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('offline'))),
    );
    await expect(getAir(PLACE)).rejects.toMatchObject({ status: 0 });
    answer({ something: 'else' });
    await expect(getAir(PLACE)).rejects.toBeInstanceOf(ApiError);
    answer('not an object', 500);
    await expect(searchPlaces('x')).rejects.toMatchObject({ status: 500 });
  });
});
