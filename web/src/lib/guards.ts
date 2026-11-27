import type { HourReading, Place } from '@saans/core';

/** Runtime checks for data that crosses into the app: API answers and saved profiles. */

/** True for a plain object, the first check before reading any field. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** True for a string. */
export const isText = (value: unknown): value is string => typeof value === 'string';

const isReadingValue = (value: unknown): value is number | null =>
  value === null || typeof value === 'number';

/** True for a value shaped like a Place. */
export const isPlace = (value: unknown): value is Place =>
  isRecord(value) &&
  isText(value.name) &&
  typeof value.lat === 'number' &&
  typeof value.lon === 'number';

/** True for one forecast hour: a time and two concentrations, each a number or a gap. */
export const isReading = (value: unknown): value is HourReading =>
  isRecord(value) && isText(value.time) && isReadingValue(value.pm25) && isReadingValue(value.pm10);
