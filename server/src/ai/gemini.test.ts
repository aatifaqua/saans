import { describe, expect, it } from 'vitest';
import { apiError, fakeGenerate } from '../../test/doubles.ts';
import { createGemini, GeminiUnavailableError, type GenerateFn } from './gemini.ts';

const TIMINGS = { callTimeoutMs: 50, deadlineMs: 200 };
const REQUEST = { system: 'sys', prompt: 'hello', temperature: 0.4, maxOutputTokens: 100 };
const accept = (text: string): string | null => (text === 'ok' ? text : null);

describe('createGemini', () => {
  it('moves to the next model on a 429 or 5xx', async () => {
    const generate = fakeGenerate([apiError(429), 'ok']);
    const gemini = createGemini(generate, { models: ['a', 'b'], ...TIMINGS });
    expect(await gemini.run(REQUEST, accept)).toEqual({ value: 'ok', model: 'b' });
    expect(generate.calls.map((call) => call.model)).toEqual(['a', 'b']);
  });

  it('moves to the next model when the answer fails validation', async () => {
    const generate = fakeGenerate(['nope', 'ok']);
    const gemini = createGemini(generate, { models: ['a', 'b'], ...TIMINGS });
    expect(await gemini.run(REQUEST, accept)).toMatchObject({ model: 'b' });
  });

  it('moves on from a retired model (404), a rejected request (400) or a network error', async () => {
    const generate = fakeGenerate([
      apiError(404),
      apiError(400),
      new TypeError('fetch failed'),
      'ok',
    ]);
    const gemini = createGemini(generate, { models: ['a', 'b', 'c', 'd'], ...TIMINGS });
    expect(await gemini.run(REQUEST, accept)).toEqual({ value: 'ok', model: 'd' });
  });

  it('reports each failed model with a short reason before moving on', async () => {
    const failures: [string, string][] = [];
    const generate = fakeGenerate([apiError(503), 'nope', 'ok']);
    const gemini = createGemini(generate, {
      models: ['a', 'b', 'c'],
      ...TIMINGS,
      onModelFailure: (model, reason) => failures.push([model, reason]),
    });
    expect(await gemini.run(REQUEST, accept)).toMatchObject({ model: 'c' });
    expect(failures).toEqual([
      ['a', 'HTTP 503'],
      ['b', 'invalid answer'],
    ]);
  });

  it('fails only after every model has failed', async () => {
    const generate = fakeGenerate([apiError(503), apiError(404)]);
    const gemini = createGemini(generate, { models: ['a', 'b'], ...TIMINGS });
    await expect(gemini.run(REQUEST, accept)).rejects.toBeInstanceOf(GeminiUnavailableError);
    expect(generate.calls).toHaveLength(2);
  });

  it('gives up on a model that does not answer in time', async () => {
    let calls = 0;
    const generate: GenerateFn = () => {
      calls += 1;
      return calls === 1 ? new Promise(() => undefined) : Promise.resolve({ text: 'ok' });
    };
    const gemini = createGemini(generate, { models: ['slow', 'fast'], ...TIMINGS });
    expect(await gemini.run(REQUEST, accept)).toMatchObject({ model: 'fast' });
  });

  it('stops trying once the whole chain deadline has passed', async () => {
    const hang: GenerateFn = () => new Promise(() => undefined);
    const gemini = createGemini(hang, {
      models: ['a', 'b', 'c'],
      callTimeoutMs: 60,
      deadlineMs: 90,
    });
    const started = Date.now();
    await expect(gemini.run(REQUEST, accept)).rejects.toBeInstanceOf(GeminiUnavailableError);
    expect(Date.now() - started).toBeLessThan(170);
  });

  it('asks for JSON with the schema, safety settings and the system prompt', async () => {
    const generate = fakeGenerate(['ok']);
    const gemini = createGemini(generate, { models: ['a'], ...TIMINGS });
    await gemini.run({ ...REQUEST, json: { type: 'object' } }, accept);
    const config = generate.calls[0]?.config;
    expect(config).toMatchObject({
      systemInstruction: 'sys',
      responseMimeType: 'application/json',
      responseJsonSchema: { type: 'object' },
      temperature: 0.4,
    });
    expect(config?.safetySettings?.length).toBe(4);
  });

  it('treats an answer cut off by the token limit as a failure', async () => {
    let calls = 0;
    const generate: GenerateFn = () => {
      calls += 1;
      return Promise.resolve(
        calls === 1 ? { text: 'ok', candidates: [{ finishReason: 'MAX_TOKENS' }] } : { text: 'ok' },
      );
    };
    const gemini = createGemini(generate, { models: ['a', 'b'], ...TIMINGS });
    expect(await gemini.run(REQUEST, accept)).toMatchObject({ model: 'b' });
  });

  it('treats a response without text as a failed answer', async () => {
    const empty: GenerateFn = () => Promise.resolve({});
    const gemini = createGemini(empty, { models: ['a'], ...TIMINGS });
    await expect(gemini.run(REQUEST, accept)).rejects.toBeInstanceOf(GeminiUnavailableError);
  });
});
