import { describe, expect, it } from 'vitest';
import { ADULT, FAMILY, PM25, series } from './test-fixtures.ts';
import { localHour, outlook } from './windows.ts';

const { good, satisfactory, moderate, poor, veryPoor, severe } = PM25;
const MORNING = '2026-11-22T06:00';

const hoursBetween = (start: string, end: string): number =>
  (Date.parse(`${end}Z`) - Date.parse(`${start}Z`)) / 3_600_000;

describe('outlook', () => {
  it('starts at the current hour and keeps 48 hours for the strip', () => {
    const readings = series('2026-11-22T00:00', Array<number>(72).fill(poor));
    const result = outlook(readings, ADULT, '2026-11-22T05:00');
    expect(result.now?.time).toBe('2026-11-22T05:00');
    expect(result.hours).toHaveLength(48);
  });

  it('skips missing readings instead of producing NaN', () => {
    const readings = series(MORNING, [null, satisfactory, null, satisfactory]);
    const result = outlook(readings, ADULT, MORNING);
    expect(result.hours.map((hour) => hour.time)).toEqual(['2026-11-22T07:00', '2026-11-22T09:00']);
    expect(result.best.every((window) => Number.isFinite(window.meanAqi))).toBe(true);
    expect(result.best[0]?.end).toBe('2026-11-22T08:00');
    expect(result.now).toBeNull();
  });

  it('reports the dirtiest single hour of the next 24 as the peak', () => {
    const result = outlook(series(MORNING, [good, good, poor]), ADULT, MORNING);
    expect(result.peak).toMatchObject({ time: '2026-11-22T08:00', band: 'poor' });
    expect(outlook([], ADULT, MORNING).peak).toBeNull();
  });

  it('finds the cleanest waking windows within the threshold, best first', () => {
    const day = [poor, moderate, moderate, poor, good, good, good, poor];
    const result = outlook(series(MORNING, day), ADULT, MORNING);
    expect(result.best.map((window) => [window.start, window.end, window.band])).toEqual([
      ['2026-11-22T10:00', '2026-11-22T13:00', 'good'],
      ['2026-11-22T07:00', '2026-11-22T09:00', 'moderate'],
    ]);
    expect(result.best.every((window) => !window.leastBad)).toBe(true);
  });

  it('holds a vulnerable household to Satisfactory', () => {
    const result = outlook(series(MORNING, [moderate, moderate, satisfactory]), FAMILY, MORNING);
    expect(result.threshold).toBe('satisfactory');
    expect(result.best.map((window) => window.start)).toEqual(['2026-11-22T08:00']);
  });

  it('keeps at most three windows of at most three hours', () => {
    const day = [good, good, good, good, poor, good, poor, good, poor, good, poor];
    const result = outlook(series(MORNING, day), ADULT, MORNING);
    expect(result.best).toHaveLength(3);
    for (const window of result.best) {
      expect(hoursBetween(window.start, window.end)).toBeLessThanOrEqual(3);
    }
  });

  it('never proposes a window between 22:00 and 06:00', () => {
    const night = series('2026-11-22T22:00', Array<number>(8).fill(good));
    expect(outlook(night, ADULT, '2026-11-22T22:00').best).toEqual([]);
  });

  it('offers the single least bad waking hour when nothing is clean enough', () => {
    const smog = Array<number>(24).fill(severe);
    smog[10] = veryPoor;
    const result = outlook(series(MORNING, smog), ADULT, MORNING);
    expect(result.best).toHaveLength(1);
    expect(result.best[0]).toMatchObject({
      start: '2026-11-22T16:00',
      end: '2026-11-22T17:00',
      leastBad: true,
      band: 'veryPoor',
    });
    expect(result.episode).toBe(true);
  });

  it('marks the worst three hours and leaves the episode flag off on a moderate day', () => {
    const day = Array<number>(24).fill(moderate);
    day[3] = poor;
    day[4] = veryPoor;
    day[5] = poor;
    const result = outlook(series('2026-11-22T00:00', day), ADULT, '2026-11-22T00:00');
    expect(result.worst).toMatchObject({ start: '2026-11-22T03:00', end: '2026-11-22T06:00' });
    expect(result.episode).toBe(false);
  });

  it('handles an empty forecast', () => {
    expect(outlook([], ADULT, MORNING)).toMatchObject({
      now: null,
      hours: [],
      best: [],
      worst: null,
      episode: false,
    });
  });
});

describe('localHour', () => {
  it('floors to the hour in the offset of the place', () => {
    // 2026-11-21T19:47Z is 01:17 on the 22nd in India (UTC+5:30).
    expect(localHour(Date.parse('2026-11-21T19:47:00Z'), 19_800)).toBe('2026-11-22T01:00');
  });
});
