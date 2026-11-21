import { candidateHacks, HACKS } from './hacks.ts';
import { householdNotes } from './household.ts';
import type { DayOutlook, Household } from './types.ts';

/**
 * The facts the model writes from, as one line of JSON: the household, today's computed air
 * windows, the household notes and the hacks it may pick. Every number comes from the forecast
 * maths, so the model only has to explain and order them, never invent them.
 */
export function groundingContext(household: Household, day: DayOutlook, place: string): string {
  return JSON.stringify({
    place,
    household,
    air: {
      nowAqi: day.now?.aqi ?? null,
      nowBand: day.now?.band ?? null,
      threshold: day.threshold,
      episode: day.episode,
      best: day.best,
      worst: day.worst,
    },
    notes: householdNotes(household),
    allowedHacks: candidateHacks(day, household).map((id) => ({ id, title: HACKS[id].title })),
  });
}
