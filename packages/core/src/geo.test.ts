import { describe, expect, it } from 'vitest';
import { round2 } from './geo.ts';

describe('round2', () => {
  it('rounds coordinates to two decimals', () => {
    expect(round2(28.61394)).toBe(28.61);
    expect(round2(77.20902)).toBe(77.21);
  });
});
