/** The two AI routes: today's plan and a follow-up answer, both written live by Gemini. */
import {
  candidateHacks,
  DISCLAIMER,
  groundingContext,
  localHour,
  outlook,
  type HackId,
  type Household,
  type Place,
} from '@saans/core';
import { Hono } from 'hono';
import { askPrompt, ASK_SYSTEM, planPrompt, PLAN_SYSTEM } from '../ai/prompts.ts';
import { GeminiUnavailableError, type Gemini } from '../ai/gemini.ts';
import { readJson } from '../request.ts';
import type { AirSource } from '../openMeteo.ts';
import { AskRequestSchema, parsePlan, PLAN_JSON_SCHEMA, PlanRequestSchema } from '../schemas.ts';

const MAX_ANSWER_CHARS = 2000;
/** Plans stay close to the grounding; answers a little closer still. */
const PLAN_TEMPERATURE = 0.4;
const ASK_TEMPERATURE = 0.3;
/** Room for the full plan or answer plus the model's low thinking budget, so nothing is cut off. */
const PLAN_MAX_OUTPUT_TOKENS = 4096;
const ASK_MAX_OUTPUT_TOKENS = 1024;

interface Deps {
  readonly air: AirSource;
  readonly gemini: Gemini | null;
  readonly now: () => number;
}

/**
 * Grounds every model call on the live forecast: the server fetches the air itself (cached), so
 * the numbers the model sees cannot be supplied or altered by the client.
 */
async function ground(
  deps: Deps,
  household: Household,
  place: Place,
): Promise<{ context: string; allowed: readonly HackId[] }> {
  const air = await deps.air.air(place.lat, place.lon);
  const day = outlook(air.readings, household, localHour(deps.now(), air.utcOffsetSeconds));
  return {
    context: groundingContext(household, day, place.name),
    allowed: candidateHacks(day, household),
  };
}

function requireGemini(gemini: Gemini | null): Gemini {
  if (gemini === null) throw new GeminiUnavailableError('no API key configured');
  return gemini;
}

/** The two generative endpoints. Nothing is stored; every answer comes from Gemini on this request. */
export function aiRoutes(deps: Deps): Hono {
  const app = new Hono();

  app.post('/plan', async (c) => {
    const { household, place } = await readJson(c, PlanRequestSchema);
    const gemini = requireGemini(deps.gemini);
    const { context, allowed } = await ground(deps, household, place);
    const request = {
      system: PLAN_SYSTEM,
      prompt: planPrompt(context),
      temperature: PLAN_TEMPERATURE,
      maxOutputTokens: PLAN_MAX_OUTPUT_TOKENS,
      json: PLAN_JSON_SCHEMA,
    };
    const { value, model } = await gemini.run(request, (text) => parsePlan(text, allowed));
    // Each answer is for one household at one moment; nothing in between may keep it.
    c.header('Cache-Control', 'no-store');
    return c.json({ plan: value, model, disclaimer: DISCLAIMER });
  });

  app.post('/ask', async (c) => {
    const { household, place, plan, question } = await readJson(c, AskRequestSchema);
    const gemini = requireGemini(deps.gemini);
    const { context } = await ground(deps, household, place);
    const request = {
      system: ASK_SYSTEM,
      prompt: askPrompt(context, plan, question),
      temperature: ASK_TEMPERATURE,
      maxOutputTokens: ASK_MAX_OUTPUT_TOKENS,
    };
    const { value, model } = await gemini.run(request, (text) => {
      const answer = text.trim();
      return answer === '' ? null : answer.slice(0, MAX_ANSWER_CHARS);
    });
    c.header('Cache-Control', 'no-store');
    return c.json({ answer: value, model, disclaimer: DISCLAIMER });
  });

  return app;
}
