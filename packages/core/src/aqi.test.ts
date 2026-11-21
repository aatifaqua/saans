import { describe, expect, it } from 'vitest';
import { bandOf, naqi, subIndex } from './aqi.ts';

describe('subIndex', () => {
  it('interpolates linearly inside a breakpoint segment', () => {
    expect(subIndex('pm25', 45)).toBe(75);
    expect(subIndex('pm10', 300)).toBe(250);
  });

  it('caps at 500 above the last breakpoint', () => {
    expect(subIndex('pm25', 900)).toBe(500);
  });

  it('treats negative sensor noise as zero', () => {
    expect(subIndex('pm25', -3)).toBe(0);
  });
});

describe('naqi', () => {
  it('takes the higher sub-index, rounded', () => {
    expect(naqi(229.1, null)).toBe(384);
    expect(naqi(20, 300)).toBe(250);
  });

  it('works from PM10 alone when PM2.5 is missing', () => {
    expect(naqi(null, 300)).toBe(250);
  });

  it('returns null when neither pollutant was measured', () => {
    expect(naqi(null, null)).toBeNull();
  });

  it('caps at 500', () => {
    expect(naqi(500, 0)).toBe(500);
  });
});

describe('bandOf', () => {
  it('uses the published band edges', () => {
    expect(bandOf(50)).toBe('good');
    expect(bandOf(51)).toBe('satisfactory');
    expect(bandOf(200)).toBe('moderate');
    expect(bandOf(201)).toBe('poor');
    expect(bandOf(384)).toBe('veryPoor');
    expect(bandOf(401)).toBe('severe');
  });
});
