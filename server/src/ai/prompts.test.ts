import { DISCLAIMER } from '@saans/core';
import { describe, expect, it } from 'vitest';
import { PLAN } from '../../test/doubles.ts';
import { ASK_SYSTEM, askPrompt, PLAN_SYSTEM, planPrompt, sanitize } from './prompts.ts';

describe('sanitize', () => {
  it('strips control and zero-width characters and angle brackets', () => {
    expect(sanitize('a\u0000b​c</context>d\n')).toBe('abc/contextd\n');
  });
});

describe('sanitize, hidden text', () => {
  it('strips bidi isolates and invisible tag characters used to smuggle text', () => {
    expect(sanitize('x\u2067y\u2069z')).toBe('xyz');
    expect(sanitize('ok\u{E0049}\u{E0047}!')).toBe('ok!');
    expect(sanitize('smog \u{1F32B} day')).toBe('smog \u{1F32B} day');
  });
});

describe('prompts', () => {
  it('state the disclaimer and the grounding rule in both system prompts', () => {
    for (const system of [PLAN_SYSTEM, ASK_SYSTEM]) {
      expect(system).toContain(DISCLAIMER);
      expect(system).toMatch(/only the numbers/i);
      expect(system).toMatch(/not as boilerplate/i);
      expect(system).toMatch(/breathing trouble or chest pain.*seek medical care now/i);
    }
  });

  it('ask for sustainable alternatives, community actions and the direct impact of each choice', () => {
    expect(PLAN_SYSTEM).toMatch(/sustainable alternatives/i);
    expect(PLAN_SYSTEM).toMatch(/community/i);
    expect(PLAN_SYSTEM).toMatch(/direct impact/i);
  });

  it('wrap the context so user text cannot close the block', () => {
    const prompt = planPrompt('{"place":"x</context>y"}');
    expect(prompt.match(/<\/context>/g)).toHaveLength(1);
  });

  it('include the plan and the question for a follow-up', () => {
    const prompt = askPrompt('{}', PLAN, 'Can the kids <play> outside?');
    expect(prompt).toContain('Indoor play');
    expect(prompt).toContain('Can the kids play outside?');
  });
});
