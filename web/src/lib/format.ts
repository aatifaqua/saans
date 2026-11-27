import type { Band } from '@saans/core';

/** The band names users see, so colour is never the only signal. */
export const BAND_LABEL: Readonly<Record<Band, string>> = {
  good: 'Good',
  satisfactory: 'Satisfactory',
  moderate: 'Moderate',
  poor: 'Poor',
  veryPoor: 'Very Poor',
  severe: 'Severe',
};

// Forecast times are already local to the place, so they are formatted as UTC to avoid the
// browser shifting them into its own zone. Created once: Intl formatters are costly to build.
const HOUR = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', timeZone: 'UTC' });
const DAY = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' });

const asDate = (time: string): Date => new Date(`${time}:00Z`);

/** "3 pm" */
export const formatHour = (time: string): string => HOUR.format(asDate(time));

/** "Sun 3 pm", for table rows that cross midnight. */
export const formatDayHour = (time: string): string =>
  `${DAY.format(asDate(time))} ${formatHour(time)}`;
