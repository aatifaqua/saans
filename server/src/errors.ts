import { DISCLAIMER } from '@saans/core';
import type { Context, ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { z } from 'zod';
import { GeminiUnavailableError } from './ai/gemini.ts';
import { UpstreamError } from './openMeteo.ts';

/** A 400 with a short message the user can act on. */
export const invalid = (message: string): HTTPException => new HTTPException(400, { message });

/** Parses the JSON body against `schema`; anything malformed or unexpected is a 400. */
export async function readJson<T>(c: Context, schema: z.ZodType<T>): Promise<T> {
  const body: unknown = await c.req.json().catch(() => {
    throw invalid('The request body must be JSON.');
  });
  const result = schema.safeParse(body);
  if (!result.success) throw invalid('The request is missing fields or has invalid values.');
  return result.data;
}

/**
 * Maps failures to short, generic messages. Every error body carries the disclaimer, and only
 * the error's name is logged: never a request body, a stack trace in the response, or the key.
 */
export const onError: ErrorHandler = (error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ error: error.message, disclaimer: DISCLAIMER }, error.status);
  }
  if (error instanceof UpstreamError) {
    return c.json(
      { error: 'Live air data is unavailable right now. Please retry.', disclaimer: DISCLAIMER },
      502,
    );
  }
  if (error instanceof GeminiUnavailableError) {
    return c.json(
      { error: 'The AI assistant is unavailable right now. Please retry.', disclaimer: DISCLAIMER },
      503,
    );
  }
  console.error(JSON.stringify({ event: 'error', name: error.name, path: c.req.path }));
  return c.json({ error: 'Something went wrong.', disclaimer: DISCLAIMER }, 500);
};
