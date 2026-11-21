import { describe, expect, it } from 'vitest';
import { householdNotes, householdThreshold, isVulnerable } from './household.ts';
import { ADULT, FAMILY } from './test-fixtures.ts';
import { COMMUTES } from './types.ts';

const joined = (notes: readonly { text: string }[]): string =>
  notes.map((note) => note.text).join(' ');

describe('householdThreshold', () => {
  it('lets healthy adults go out up to Moderate', () => {
    expect(householdThreshold(ADULT)).toBe('moderate');
    expect(isVulnerable(ADULT)).toBe(false);
  });

  it.each([
    { members: { ...ADULT.members, child: 1 } },
    { members: { ...ADULT.members, olderAdult: 1 } },
    { members: { ...ADULT.members, pregnant: 1 } },
    { sensitivities: ['heartOrLung'] as const },
  ])('lowers the threshold to Satisfactory for a vulnerable member (%o)', (change) => {
    expect(householdThreshold({ ...ADULT, ...change })).toBe('satisfactory');
    expect(isVulnerable({ ...ADULT, ...change })).toBe(true);
  });
});

describe('householdNotes', () => {
  it('explains every note with a reason', () => {
    const notes = householdNotes(FAMILY);
    expect(notes.length).toBeGreaterThan(0);
    for (const note of notes) expect(note.why.length).toBeGreaterThan(0);
  });

  it('covers children, asthma, the car commute and outdoor exercise', () => {
    const text = joined(householdNotes(FAMILY));
    expect(text).toMatch(/inhaler/i);
    expect(text).toMatch(/idl/i);
    expect(text).toMatch(/exercise/i);
    expect(text).toMatch(/school/i);
  });

  it('gives each travelling commute mode its own advice and none to staying home', () => {
    const texts = COMMUTES.map((commute) => joined(householdNotes({ ...ADULT, commute })));
    expect(new Set(texts).size).toBe(COMMUTES.length);
    expect(householdNotes({ ...ADULT, commute: 'none' })).toHaveLength(0);
  });

  it('adds older adult, pregnancy and heart or lung notes', () => {
    const notes = householdNotes({
      ...ADULT,
      members: { child: 0, adult: 1, olderAdult: 1, pregnant: 1 },
      sensitivities: ['heartOrLung'],
      commute: 'none',
    });
    expect(notes).toHaveLength(3);
  });
});
