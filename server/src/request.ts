import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { z } from 'zod';

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
