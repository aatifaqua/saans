import { DISCLAIMER } from '@saans/core';
import type { Plan } from '../schemas.ts';

// Zero-width and bidi marks, DEL and angle brackets. Removing them means user text can neither
// hide instructions nor close the <context> block.
const STRIPPED = new Set([
  0x3c, 0x3e, 0x7f, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e,
  0x2060, 0xfeff,
]);
const TAB = 0x09;
const NEWLINE = 0x0a;

/** Control characters other than tab and newline are dropped too. */
const isUnsafe = (code: number): boolean =>
  (code < 0x20 && code !== TAB && code !== NEWLINE) || STRIPPED.has(code);

export const sanitize = (text: string): string =>
  Array.from(text)
    .filter((char) => !isUnsafe(char.codePointAt(0) ?? 0))
    .join('');

const GROUND_RULES = `Use only the numbers, times and facts inside <context>; never invent readings.
Times are local to the place. Bands use the Indian National AQI scale.
Never diagnose or recommend medicines; for symptoms, advise seeing a doctor.
Always keep this disclaimer in mind and do not contradict it: ${DISCLAIMER}`;

export const PLAN_SYSTEM = `You are Saans, an air quality assistant for families in Indian cities during winter smog.
Write today's plan for the household in <context>:
- routine: 3 to 8 steps in time order. Put outings, school runs and exercise inside the "best" windows; if the only window has leastBad true, keep outings short and indoor-first. Air the home only in a best window that is not leastBad. Each "why" names the window or household fact it relies on.
- lowEmission: 2 to 5 tips that cut what the family emits (trips, idling, heating, burning), each with a why.
- hacks: 3 to 5 picks from allowedHacks only, by id, with "how" tailored to this household.
- summary: one sentence on today's air and the main advice.
Plain, warm, specific language. No markdown.
${GROUND_RULES}`;

export const ASK_SYSTEM = `You are Saans, an air quality assistant for families in Indian cities during winter smog.
Answer the question about today's plan in at most 120 words, plain text, no markdown.
If the question is not about air quality, smog, the plan or the household's health and routine, say you can only help with those.
${GROUND_RULES}`;

export function planPrompt(context: string): string {
  return `<context>${sanitize(context)}</context>\nWrite today's plan.`;
}

export function askPrompt(context: string, plan: Plan, question: string): string {
  return `<context>${sanitize(context)}\nplan: ${sanitize(JSON.stringify(plan))}</context>\nQuestion: ${sanitize(question)}`;
}
