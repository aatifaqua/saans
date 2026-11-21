import type { Household, HourReading } from './types.ts';

/** PM2.5 concentrations that land in the middle of each band on the Indian scale. */
export const PM25 = {
  good: 15,
  satisfactory: 45,
  moderate: 75,
  poor: 105,
  veryPoor: 185,
  severe: 300,
} as const;

/** Hourly readings from `start` (a local "YYYY-MM-DDTHH:00" time), one per PM2.5 value. */
export function series(start: string, pm25: readonly (number | null)[]): HourReading[] {
  const base = Date.parse(`${start}:00Z`);
  return pm25.map((value, index) => ({
    time: new Date(base + index * 3_600_000).toISOString().slice(0, 16),
    pm25: value,
    pm10: null,
  }));
}

/** One healthy adult who commutes by metro: the least restrictive household. */
export const ADULT: Household = {
  members: { child: 0, adult: 1, olderAdult: 0, pregnant: 0 },
  sensitivities: [],
  commute: 'publicTransport',
  outdoorExercise: false,
  hasPurifier: false,
};

/** Two adults, a child with asthma, a car commute and morning runs. */
export const FAMILY: Household = {
  members: { child: 1, adult: 2, olderAdult: 0, pregnant: 0 },
  sensitivities: ['asthma'],
  commute: 'car',
  outdoorExercise: true,
  hasPurifier: true,
};
