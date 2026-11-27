import { outlook, type HourReading, type Household, type Place, type Plan } from '@saans/core';

export const HOUSEHOLD: Household = {
  members: { child: 1, adult: 2, olderAdult: 0, pregnant: 0 },
  sensitivities: ['asthma'],
  commute: 'car',
  outdoorExercise: false,
  hasPurifier: false,
};

export const PLACE: Place = { name: 'Delhi', lat: 28.65, lon: 77.23 };

export const PLAN: Plan = {
  summary: 'Very Poor air all day: keep outings short.',
  routine: [
    { time: '07:30', action: 'Quick school drop by car', why: 'Least bad hour' },
    { time: '13:00', action: 'Indoor play after lunch', why: 'Air is Very Poor' },
    { time: '19:00', action: 'Purifier on in the bedroom', why: 'Evening peak' },
  ],
  alternatives: [
    { choice: 'Metro instead of the car', impact: 'Less exhaust from your trip' },
    { choice: 'No idling at the gate', impact: 'Cleaner air where children wait' },
  ],
  hacks: [
    { id: 'sealGaps', how: 'Towel at the balcony door', impact: 'Less smoke seeps in' },
    { id: 'wetMop', how: 'Mop tonight', impact: 'Dust stays down' },
    { id: 'noBurning', how: 'Electric heater only', impact: 'No smoke added' },
  ],
  community: [
    {
      action: 'Start a no-idling pledge at the school gate',
      impact: 'Cleaner air for every child',
    },
  ],
};

/** 48 hours from 06:00 local: Very Poor, with a Moderate stretch from 14:00 to 16:59. */
export function readings(): HourReading[] {
  const base = Date.parse('2026-11-22T06:00Z');
  return Array.from({ length: 48 }, (_, hour) => ({
    time: new Date(base + hour * 3_600_000).toISOString().slice(0, 16),
    pm25: hour >= 8 && hour <= 10 ? 75 : 185,
    pm10: null,
  }));
}

export const DAY = outlook(readings(), HOUSEHOLD, '2026-11-22T06:00');
