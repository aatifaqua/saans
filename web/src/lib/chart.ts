/**
 * Words for the forecast chart: its extremes in a sentence and the bands in its key, so the
 * picture is never the only way to read the next 48 hours.
 */
import { BANDS, type Band, type HourAqi } from '@saans/core';
import { BAND_LABEL, formatDayHour } from './format.ts';

const describeHour = (hour: HourAqi): string =>
  `${formatDayHour(hour.time)}, AQI ${String(hour.aqi)}, ${BAND_LABEL[hour.band]}`;

/** The cleanest and the most polluted hour of the chart, as one sentence each. */
export function forecastSummary(hours: readonly HourAqi[]): string {
  const [first] = hours;
  if (first === undefined) return 'No forecast hours are available.';
  let cleanest = first;
  let dirtiest = first;
  for (const hour of hours) {
    if (hour.aqi < cleanest.aqi) cleanest = hour;
    if (hour.aqi > dirtiest.aqi) dirtiest = hour;
  }
  return `Cleanest hour: ${describeHour(cleanest)}. Most polluted hour: ${describeHour(dirtiest)}.`;
}

/** The bands that appear in the chart, cleanest first, for its key. */
export function bandsShown(hours: readonly HourAqi[]): readonly Band[] {
  return BANDS.filter((band) => hours.some((hour) => hour.band === band));
}
