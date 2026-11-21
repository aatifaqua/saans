import { BANDS, type Band } from './types.ts';

type Segment = readonly [concLow: number, concHigh: number, indexLow: number, indexHigh: number];

/**
 * CPCB National AQI breakpoints (µg/m³ to index). The last segment's upper concentration is the
 * commonly used cap, so anything above it reads 500. Hoisted so scoring an hour allocates nothing.
 */
const BREAKPOINTS: Readonly<Record<'pm25' | 'pm10', readonly Segment[]>> = {
  pm25: [
    [0, 30, 0, 50],
    [30, 60, 50, 100],
    [60, 90, 100, 200],
    [90, 120, 200, 300],
    [120, 250, 300, 400],
    [250, 380, 400, 500],
  ],
  pm10: [
    [0, 50, 0, 50],
    [50, 100, 50, 100],
    [100, 250, 100, 200],
    [250, 350, 200, 300],
    [350, 430, 300, 400],
    [430, 510, 400, 500],
  ],
};

const MAX_INDEX = 500;

/** Upper index of each band; anything above the last is Severe. */
const BAND_TOPS: readonly (readonly [top: number, band: Band])[] = [
  [50, 'good'],
  [100, 'satisfactory'],
  [200, 'moderate'],
  [300, 'poor'],
  [400, 'veryPoor'],
];

/** Linear interpolation inside the breakpoint segment that holds `concentration`. */
export function subIndex(pollutant: 'pm25' | 'pm10', concentration: number): number {
  const value = Math.max(0, concentration);
  for (const [concLow, concHigh, indexLow, indexHigh] of BREAKPOINTS[pollutant]) {
    if (value <= concHigh) {
      return indexLow + ((indexHigh - indexLow) * (value - concLow)) / (concHigh - concLow);
    }
  }
  return MAX_INDEX;
}

/**
 * The National AQI from PM2.5 and PM10: the higher sub-index, rounded. The official index uses
 * 24-hour averages; applying the same breakpoints to hourly values is what lets the app compare
 * hours within a day.
 */
export function naqi(pm25: number | null, pm10: number | null): number | null {
  if (pm25 === null && pm10 === null) return null;
  const fine = pm25 === null ? 0 : subIndex('pm25', pm25);
  const coarse = pm10 === null ? 0 : subIndex('pm10', pm10);
  return Math.round(Math.max(fine, coarse));
}

export function bandOf(aqi: number): Band {
  for (const [top, band] of BAND_TOPS) if (aqi <= top) return band;
  return 'severe';
}

/** Position of a band from cleanest (0) to worst (5), for "is this worse than" checks. */
export function bandRank(band: Band): number {
  return BANDS.indexOf(band);
}
