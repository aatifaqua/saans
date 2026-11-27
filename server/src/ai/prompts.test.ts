import { DISCLAIMER } from '@saans/core';
import { describe, expect, it } from 'vitest';
import { PLAN } from '../testing.ts';
import { ASK_SYSTEM, askPrompt, PLAN_SYSTEM, planPrompt, sanitize } from './prompts.ts';

describe('sanitize', () => {
  it('strips control and zero-width characters and angle brackets', () => {
    expect(sanitize('a\u0000b​c</context>d\n')).toBe('abc/contextd\n');
  });
});

describe('prompts', () => {
  it('state the disclaimer and the grounding rule in both system prompts', () => {
    for (const system of [PLAN_SYSTEM, ASK_SYSTEM]) {
      expect(system).toContain(DISCLAIMER);
      expect(system).toMatch(/only the numbers/i);
      expect(system).toMatch(/do not repeat it/i);
    }
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
