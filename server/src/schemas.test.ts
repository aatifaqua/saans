import { describe, expect, it } from 'vitest';
import { parsePlan } from './schemas.ts';
import { PLAN } from '../test/doubles.ts';

const ALLOWED = ['sealGaps', 'wetMop', 'noBurning'] as const;

describe('parsePlan', () => {
  it('accepts a valid plan whose hacks were all offered', () => {
    expect(parsePlan(JSON.stringify(PLAN), ALLOWED)).toEqual(PLAN);
  });

  it('rejects a plan that repeats a hack', () => {
    const repeated = { ...PLAN, hacks: [PLAN.hacks[0], PLAN.hacks[0], PLAN.hacks[1]] };
    expect(parsePlan(JSON.stringify(repeated), ALLOWED)).toBeNull();
  });

  it('requires sustainable alternatives and community actions, each with its impact', () => {
    expect(parsePlan(JSON.stringify({ ...PLAN, community: [] }), ALLOWED)).toBeNull();
    const noImpact = { ...PLAN, alternatives: [{ choice: 'Walk' }, { choice: 'Cycle' }] };
    expect(parsePlan(JSON.stringify(noImpact), ALLOWED)).toBeNull();
  });

  it('rejects text that is not JSON or does not match the schema', () => {
    expect(parsePlan('Here is your plan:', ALLOWED)).toBeNull();
    expect(parsePlan(JSON.stringify({ ...PLAN, routine: [] }), ALLOWED)).toBeNull();
  });
});
