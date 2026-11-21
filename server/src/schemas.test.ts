import { describe, expect, it } from 'vitest';
import { parsePlan } from './schemas.ts';
import { PLAN } from './testing.ts';

const ALLOWED = ['sealGaps', 'wetMop', 'noBurning'] as const;

describe('parsePlan', () => {
  it('accepts a valid plan whose hacks were all offered', () => {
    expect(parsePlan(JSON.stringify(PLAN), ALLOWED)).toEqual(PLAN);
  });

  it('rejects a plan that repeats a hack', () => {
    const repeated = { ...PLAN, hacks: [PLAN.hacks[0], PLAN.hacks[0], PLAN.hacks[1]] };
    expect(parsePlan(JSON.stringify(repeated), ALLOWED)).toBeNull();
  });

  it('rejects text that is not JSON or does not match the schema', () => {
    expect(parsePlan('Here is your plan:', ALLOWED)).toBeNull();
    expect(parsePlan(JSON.stringify({ ...PLAN, routine: [] }), ALLOWED)).toBeNull();
  });
});
