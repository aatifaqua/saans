/** Zod schemas for everything that enters the API or comes back from the model. */
import {
  COMMUTES,
  HACK_IDS,
  MAX_MEMBER_COUNT,
  SENSITIVITIES,
  type HackId,
  type Plan,
} from '@saans/core';
import { z } from 'zod';

const count = z.number().int().min(0).max(MAX_MEMBER_COUNT);

/** Strict objects: an unknown field is a 400, never silently passed to the model. */
export const HouseholdSchema = z.strictObject({
  members: z
    .strictObject({ child: count, adult: count, olderAdult: count, pregnant: count })
    .refine((m) => m.child + m.adult + m.olderAdult + m.pregnant >= 1, 'At least one person'),
  sensitivities: z.array(z.enum(SENSITIVITIES)).max(SENSITIVITIES.length),
  commute: z.enum(COMMUTES),
  outdoorExercise: z.boolean(),
  hasPurifier: z.boolean(),
});

/** A place as the client sends it: a display name and coordinates. */
export const PlaceSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

const line = z.string().trim().min(1).max(400);

/** The plan Gemini must return; the same schema checks a plan sent back with a question. */
export const PlanSchema: z.ZodType<Plan> = z.strictObject({
  summary: line,
  routine: z
    .array(z.strictObject({ time: z.string().trim().min(1).max(40), action: line, why: line }))
    .min(3)
    .max(8),
  alternatives: z
    .array(z.strictObject({ choice: line, impact: line }))
    .min(2)
    .max(5),
  hacks: z
    .array(z.strictObject({ id: z.enum(HACK_IDS), how: line, impact: line }))
    .min(3)
    .max(5),
  community: z
    .array(z.strictObject({ action: line, impact: line }))
    .min(1)
    .max(3),
});

/** Body of POST /api/plan. */
export const PlanRequestSchema = z.strictObject({ household: HouseholdSchema, place: PlaceSchema });

/** Body of POST /api/ask: the plan on screen comes back so the answer can refer to it. */
export const AskRequestSchema = z.strictObject({
  household: HouseholdSchema,
  place: PlaceSchema,
  plan: PlanSchema,
  question: z.string().trim().min(1).max(500),
});

/** The plan schema as JSON Schema for Gemini's structured output, built once at startup. */
export const PLAN_JSON_SCHEMA: object = Object.fromEntries(
  Object.entries(z.toJSONSchema(PlanSchema)).filter(([key]) => key !== '$schema'),
);

/**
 * Accepts a model answer only if it is valid JSON matching the schema and every hack is one the
 * household was offered today, with no repeats. Anything else returns null (try the next model).
 */
export function parsePlan(text: string, allowed: readonly HackId[]): Plan | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const result = PlanSchema.safeParse(json);
  if (!result.success) return null;
  const ids = result.data.hacks.map((hack) => hack.id);
  const valid = ids.every((id) => allowed.includes(id)) && new Set(ids).size === ids.length;
  return valid ? result.data : null;
}
