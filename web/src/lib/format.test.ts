import { describe, expect, it } from 'vitest';
import { formatCoordinates } from './format.ts';

describe('formatCoordinates', () => {
  it('names the hemisphere instead of using a minus sign', () => {
    expect(formatCoordinates(19.08, 72.88)).toBe('19.08° N, 72.88° E');
    expect(formatCoordinates(-33.87, -70.65)).toBe('33.87° S, 70.65° W');
  });
});
