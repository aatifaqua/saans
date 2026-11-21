import { bandRank } from './aqi.ts';
import { isVulnerable } from './household.ts';
import { HACK_IDS, type DayOutlook, type HackId, type Household } from './types.ts';

export interface Hack {
  readonly title: string;
  readonly cost: 'free' | 'low' | 'medium';
  readonly source: string;
  /** Whether the hack is worth suggesting for this day and household. */
  readonly fits: (day: DayOutlook, household: Household) => boolean;
}

const MAX_CANDIDATES = 10;
const POOR = bandRank('poor');

/** Some hour today is worse than the household should be outdoors in. */
const exceeds = (day: DayOutlook): boolean =>
  day.worst !== null && bandRank(day.worst.band) > bandRank(day.threshold);
const smoggy = (day: DayOutlook): boolean => day.worst !== null && bandRank(day.worst.band) >= POOR;
const always = (): boolean => true;

/** The curated catalogue the model must choose from, so every hack it shows has a known basis. */
export const HACKS: Readonly<Record<HackId, Hack>> = {
  wellFittedMask: {
    title: 'Wear a well-fitted N95 or FFP2 outdoors; cloth and surgical masks do little',
    cost: 'low',
    source: 'WHO and CPCB smog advisories',
    fits: exceeds,
  },
  sealGaps: {
    title: 'Close windows during the worst hours and block door gaps with a rolled towel',
    cost: 'free',
    source: 'US EPA guide to indoor air during smoke events',
    fits: smoggy,
  },
  cleanRoom: {
    title:
      'Make one clean room for the most vulnerable member: doors shut, purifier or filter running',
    cost: 'low',
    source: 'US EPA clean room guidance',
    fits: (day, household) => isVulnerable(household) && exceeds(day),
  },
  purifierRunTimes: {
    title: 'Run the purifier on high in the occupied room, doors closed, through the worst hours',
    cost: 'free',
    source: 'US EPA guide to air cleaners in the home',
    fits: (_day, household) => household.hasPurifier,
  },
  purifierSizing: {
    title:
      'If buying a purifier, pick a CADR of at least two thirds of the room area in square feet',
    cost: 'medium',
    source: 'AHAM sizing rule cited by the US EPA',
    fits: (_day, household) => !household.hasPurifier,
  },
  boxFanFilter: {
    title: 'Build a box fan filter: a fan with a MERV 13 filter taped to the back',
    cost: 'low',
    source: 'US EPA research on do-it-yourself air cleaners',
    fits: (day, household) => !household.hasPurifier && smoggy(day),
  },
  ventilateCleanHour: {
    title: 'Air the home for 10 to 15 minutes only during the cleanest window',
    cost: 'free',
    source: 'WHO indoor air quality guidelines',
    fits: (day) => day.best.some((window) => !window.leastBad),
  },
  carRecirculate: {
    title: 'Set the car to recirculate and replace the cabin air filter each winter',
    cost: 'low',
    source: 'Studies of in-vehicle exposure on congested roads',
    fits: (_day, household) => household.commute === 'car',
  },
  kitchenExhaust: {
    title: 'Use the kitchen exhaust or a lid, and avoid deep frying with windows shut',
    cost: 'free',
    source: 'WHO household air pollution guidance',
    fits: always,
  },
  noIncense: {
    title: 'Skip incense, mosquito coils and candles on smoggy days',
    cost: 'free',
    source: 'Indoor PM2.5 studies of incense and coils',
    fits: always,
  },
  wetMop: {
    title: 'Wet mop and damp dust instead of sweeping, which lifts settled dust',
    cost: 'free',
    source: 'US EPA indoor particle guidance',
    fits: always,
  },
  noBurning: {
    title: 'Keep warm with electric heaters, not wood, coal or waste fires',
    cost: 'free',
    source: 'CPCB winter action plan',
    fits: always,
  },
  plantsMyth: {
    title: 'House plants do not measurably clean smog; spend the money on a filter instead',
    cost: 'free',
    source: 'Review of potted plant air cleaning studies (2019)',
    fits: (_day, household) => !household.hasPurifier,
  },
};

/**
 * The hacks the model may choose from today, in catalogue priority order and capped at ten so
 * the prompt stays short. Always at least five, because the always-useful habits always fit.
 */
export function candidateHacks(day: DayOutlook, household: Household): readonly HackId[] {
  return HACK_IDS.filter((id) => HACKS[id].fits(day, household)).slice(0, MAX_CANDIDATES);
}
