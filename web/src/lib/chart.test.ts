import { describe, expect, it } from 'vitest';
import { DAY } from '../../test/fixtures.ts';
import { bandsShown, forecastSummary } from './chart.ts';

describe('forecastSummary', () => {
  it('names the cleanest and the most polluted hour with day, index and band', () => {
    expect(forecastSummary(DAY.hours)).toBe(
      'Cleanest hour: Sun 2 pm, AQI 150, Moderate. Most polluted hour: Sun 6 am, AQI 350, Very Poor.',
    );
  });

  it('finds a peak that comes after the first hour', () => {
    const rising = [
      { time: '2026-11-22T06:00', aqi: 90, band: 'satisfactory' },
      { time: '2026-11-22T07:00', aqi: 410, band: 'severe' },
    ] as const;
    expect(forecastSummary(rising)).toBe(
      'Cleanest hour: Sun 6 am, AQI 90, Satisfactory. Most polluted hour: Sun 7 am, AQI 410, Severe.',
    );
  });

  it('says so when the forecast has no hours', () => {
    expect(forecastSummary([])).toBe('No forecast hours are available.');
  });
});

describe('bandsShown', () => {
  it('lists only the bands in the chart, cleanest first', () => {
    expect(bandsShown(DAY.hours)).toEqual(['moderate', 'veryPoor']);
    expect(bandsShown([])).toEqual([]);
  });
});
