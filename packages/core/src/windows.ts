/** Turns hourly readings into the day's outlook: the current hour, the clean and worst windows, the peak and smog episodes. */
import { bandOf, bandRank, naqi } from './aqi.ts';
import { householdThreshold } from './household.ts';
import type { AirWindow, Band, DayOutlook, Household, HourAqi, HourReading } from './types.ts';

const HOUR_MS = 3_600_000;
const STRIP_HOURS = 48;
const DAY_HOURS = 24;
/** Outings are only proposed between 06:00 and 21:59 local time. */
const WAKING_START = 6;
const WAKING_END = 22;
const MAX_WINDOW_HOURS = 3;
const MAX_WINDOWS = 3;
/** A 24-hour mean at or above this is Very Poor or worse: a smog episode. */
const EPISODE_AQI = 301;

/** Adds whole hours to a local "YYYY-MM-DDTHH:00" time without involving any time zone. */
function addHours(time: string, hours: number): string {
  return new Date(Date.parse(`${time}:00Z`) + hours * HOUR_MS).toISOString().slice(0, 16);
}

/** The current hour at a place, as the local "YYYY-MM-DDTHH:00" time its forecast is keyed by. */
export function localHour(epochMs: number, utcOffsetSeconds: number): string {
  return `${new Date(epochMs + utcOffsetSeconds * 1000).toISOString().slice(0, 13)}:00`;
}

const isWaking = (hour: HourAqi): boolean => {
  const local = Number(hour.time.slice(11, 13));
  return local >= WAKING_START && local < WAKING_END;
};

/** Consecutive hours with no gap; never empty, so its first hour always exists. */
type Run = [HourAqi, ...HourAqi[]];

/** Splits the hours into runs of consecutive hours that all pass `keep`; a gap ends a run. */
function runs(slots: readonly (HourAqi | null)[], keep: (hour: HourAqi) => boolean): Run[] {
  const found: Run[] = [];
  let current: Run | null = null;
  for (const slot of slots) {
    if (slot === null || !keep(slot)) {
      current = null;
    } else if (current === null) {
      current = [slot];
      found.push(current);
    } else {
      current.push(slot);
    }
  }
  return found;
}

/** Which end of the scale a window search looks for. */
type WindowMode = 'cleanest' | 'dirtiest';

const sumAqi = (hours: readonly HourAqi[]): number =>
  hours.reduce((sum, hour) => sum + hour.aqi, 0);

/**
 * The cleanest (or dirtiest) stretch of up to three hours inside one run. Runs are at most 24
 * hours long, so trying each start costs at most 72 additions.
 */
function pickWindow(run: Run, mode: WindowMode): AirWindow {
  const size = Math.min(MAX_WINDOW_HOURS, run.length);
  let best = { first: run[0], sum: sumAqi(run.slice(0, size)) };
  for (let index = 1; index + size <= run.length; index += 1) {
    const span = run.slice(index, index + size);
    const sum = sumAqi(span);
    const better = mode === 'dirtiest' ? sum > best.sum : sum < best.sum;
    if (better && span[0] !== undefined) best = { first: span[0], sum };
  }
  const start = best.first.time;
  const meanAqi = Math.round(best.sum / size);
  return { start, end: addHours(start, size), meanAqi, band: bandOf(meanAqi), leastBad: false };
}

/**
 * Up to three of the cleanest waking-hour windows within the household's limit, best first. When
 * none qualifies, the single least bad waking hour, flagged so the plan stays indoor-first.
 */
function bestWindows(day: readonly (HourAqi | null)[], threshold: Band): readonly AirWindow[] {
  const limit = bandRank(threshold);
  const clean = runs(day, (hour) => isWaking(hour) && bandRank(hour.band) <= limit)
    .map((run) => pickWindow(run, 'cleanest'))
    .sort((a, b) => a.meanAqi - b.meanAqi)
    .slice(0, MAX_WINDOWS);
  if (clean.length > 0) return clean;
  let least: HourAqi | null = null;
  for (const hour of day) {
    if (hour !== null && isWaking(hour) && (least === null || hour.aqi < least.aqi)) least = hour;
  }
  return least === null ? [] : [{ ...pickWindow([least], 'cleanest'), leastBad: true }];
}

/** The dirtiest stretch of up to three hours in the next 24, so windows stay shut then. */
function worstWindow(day: readonly (HourAqi | null)[]): AirWindow | null {
  let worst: AirWindow | null = null;
  for (const run of runs(day, () => true)) {
    const candidate = pickWindow(run, 'dirtiest');
    if (worst === null || candidate.meanAqi > worst.meanAqi) worst = candidate;
  }
  return worst;
}

/**
 * Scores the forecast from the current hour on: 48 hours for the strip, and the next 24 for the
 * clean windows, the worst stretch and the smog-episode check. Missing readings become gaps.
 */
export function outlook(
  readings: readonly HourReading[],
  household: Household,
  nowIso: string,
): DayOutlook {
  const from = readings.findIndex((reading) => reading.time >= nowIso);
  const ahead = from === -1 ? [] : readings.slice(from, from + STRIP_HOURS);
  const slots = ahead.map((reading): HourAqi | null => {
    const aqi = naqi(reading.pm25, reading.pm10);
    return aqi === null ? null : { time: reading.time, aqi, band: bandOf(aqi) };
  });
  const day = slots.slice(0, DAY_HOURS);
  const dayHours = day.filter((hour) => hour !== null);
  const mean = sumAqi(dayHours) / Math.max(1, dayHours.length);
  const threshold = householdThreshold(household);
  const peak = dayHours.reduce<HourAqi | null>(
    (top, hour) => (top === null || hour.aqi > top.aqi ? hour : top),
    null,
  );
  return {
    // The current hour only: a gap stays a gap rather than borrowing a later reading.
    now: day[0] ?? null,
    peak,
    hours: slots.filter((hour) => hour !== null),
    best: bestWindows(day, threshold),
    worst: worstWindow(day),
    episode: mean >= EPISODE_AQI,
    threshold,
  };
}
