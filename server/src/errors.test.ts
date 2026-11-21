import { DISCLAIMER } from '@saans/core';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { onError } from './errors.ts';

describe('onError', () => {
  it('hides unexpected errors behind a generic 500 with the disclaimer', async () => {
    const app = new Hono();
    app.get('/', () => {
      throw new Error('secret detail');
    });
    app.onError(onError);
    const res = await app.request('/');
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain('secret detail');
    expect(JSON.parse(text)).toEqual({ error: 'Something went wrong.', disclaimer: DISCLAIMER });
  });
});
