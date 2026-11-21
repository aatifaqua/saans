import { describe, expect, it } from 'vitest';
import { candidateHacks, HACKS } from './hacks.ts';
import { ADULT, FAMILY, PM25, series } from './test-fixtures.ts';
import { HACK_IDS } from './types.ts';
import { outlook } from './windows.ts';

const MORNING = '2026-11-22T06:00';
const smoggy = outlook(series(MORNING, Array<number>(24).fill(PM25.severe)), ADULT, MORNING);
const clean = outlook(series(MORNING, Array<number>(24).fill(PM25.good)), ADULT, MORNING);

describe('HACKS', () => {
  it('has a title and a source for every id', () => {
    for (const id of HACK_IDS) {
      expect(HACKS[id].title.length).toBeGreaterThan(0);
      expect(HACKS[id].source.length).toBeGreaterThan(0);
    }
  });
});

describe('candidateHacks', () => {
  it('suggests sizing a purifier only to households without one', () => {
    expect(candidateHacks(smoggy, ADULT)).toContain('purifierSizing');
    expect(candidateHacks(smoggy, ADULT)).not.toContain('purifierRunTimes');
    expect(candidateHacks(smoggy, FAMILY)).toContain('purifierRunTimes');
    expect(candidateHacks(smoggy, FAMILY)).not.toContain('purifierSizing');
  });

  it('suggests airing the home only when a genuinely clean window exists', () => {
    expect(candidateHacks(clean, ADULT)).toContain('ventilateCleanHour');
    expect(candidateHacks(smoggy, ADULT)).not.toContain('ventilateCleanHour');
  });

  it('adds car, clean room and mask hacks for a smoggy day with a vulnerable family', () => {
    expect(candidateHacks(smoggy, FAMILY)).toEqual(
      expect.arrayContaining(['carRecirculate', 'cleanRoom', 'wellFittedMask']),
    );
  });

  it('leaves out sealing and masks on a clean day', () => {
    expect(candidateHacks(clean, ADULT)).not.toContain('sealGaps');
    expect(candidateHacks(clean, ADULT)).not.toContain('wellFittedMask');
  });

  it('always returns between 5 and 10 ids', () => {
    for (const day of [smoggy, clean]) {
      for (const household of [ADULT, FAMILY]) {
        const ids = candidateHacks(day, household);
        expect(ids.length).toBeGreaterThanOrEqual(5);
        expect(ids.length).toBeLessThanOrEqual(10);
      }
    }
  });
});
